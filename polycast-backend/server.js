// Basic server setup placeholder
require('dotenv').config(); // Ensure .env is loaded at the very top
console.log('Server starting...');

const fs = require('fs');
const path = require('path');
const MODE_FILE = path.join(__dirname, 'mode.json');

// Helper to load mode from disk
function loadModeFromDisk() {
    try {
        if (fs.existsSync(MODE_FILE)) {
            const data = JSON.parse(fs.readFileSync(MODE_FILE, 'utf8'));
            if (typeof data.isTextMode === 'boolean') {
                console.log(`[Mode] Loaded isTextMode=${data.isTextMode} from disk`);
                return data.isTextMode;
            }
        }
    } catch (e) {
        console.warn('[Mode] Failed to read mode.json:', e);
    }
    return false;
}

// Helper to save mode to disk
function saveModeToDisk(isTextMode) {
    try {
        fs.writeFileSync(MODE_FILE, JSON.stringify({ isTextMode }), 'utf8');
        console.log(`[Mode] Saved isTextMode=${isTextMode} to disk`);
    } catch (e) {
        console.error('[Mode] Failed to save mode.json:', e);
    }
}

// Debug: Print OpenAI API Key (should be defined, or print warning)
if (process.env.OPENAI_API_KEY) {
    console.log('OpenAI API Key loaded:', process.env.OPENAI_API_KEY.slice(0, 8) + '...');
} else {
    console.warn('OpenAI API Key is NOT loaded! Check your .env file and dotenv config.');
}

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const url = require('url'); // To parse connection URL
const config = require('./config/config');
const speechService = require('./services/speechService');
const llmService = require('./services/llmService');
const { transcribeAudio } = require('./services/whisperService');
const { generateImage } = require('./services/imageService');
const redisService = require('./services/redisService');

// Initialize Express app
const app = express();

// Add CORS middleware to enable cross-origin requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Enable CORS for frontend on Render
app.use(cors({
  origin: 'https://polycast-frontend.onrender.com',
  credentials: true
}));

// Enable JSON body parsing for POST requests
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
// Pass request object to connection handler
const wss = new WebSocket.Server({ server });

console.log(`WebSocket server created.`);

// === Room Management & WebSocket Handling ===

// Room management system
const activeRooms = new Map(); // Map of roomCode -> {hostWs, students, transcript}

// Track client connection attempts - prevent multiple connection spam
const connectionAttempts = new Map();

// Global list of all rejected room codes - to prevent reconnection attempts
const rejectedRoomCodes = new Set();

// Generate a unique 5-digit room code
async function generateRoomCode() {
    // Try up to 5 times to generate a unique code
    for (let attempts = 0; attempts < 5; attempts++) {
        const code = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit number
        
        // Check both in-memory map and Redis
        if (!activeRooms.has(code) && !(await redisService.roomExists(code))) {
            return code;
        }
    }
    
    // If we couldn't generate a unique code after 5 attempts, try a more systematic approach
    let code = 10000;
    while (code < 100000) {
        if (!activeRooms.has(code.toString()) && !(await redisService.roomExists(code.toString()))) {
            return code.toString();
        }
        code++;
    }
    
    throw new Error('Failed to generate a unique room code');
}

// Client tracking
const clientTextBuffers = new Map();
const clientTargetLanguages = new Map(); // Keep for language from URL, will store an array now
const clientRooms = new Map(); // Track which room each client belongs to

// Modify connection handler to accept request object (req) and make it async
wss.on('connection', (ws, req) => {
    // Parse URL parameters
    const parsedUrl = url.parse(req.url, true); // true parses query string
    const query = parsedUrl.query;
    
    // EARLY REJECTION: Immediately reject connection if trying to join a known bad room code
    if (query && query.roomCode && query.isHost === 'false' && rejectedRoomCodes.has(query.roomCode)) {
        console.log(`[Room] Immediately rejected student connection for known bad room code: ${query.roomCode}`);
        ws.send(JSON.stringify({
            type: 'room_error',
            message: 'This room does not exist or has expired. Please check the code and try again.'
        }));
        ws.close();
        return;
    }
    
    // Set a timeout for joining a room (60 seconds)
    // This prevents lingering connections that never successfully join a room
    const joinRoomTimeout = setTimeout(() => {
        // If the connection hasn't been added to a room by this time,
        // and it's still open, close it
        if (!clientRooms.has(ws) && ws.readyState === ws.OPEN) {
            console.log('[Room] Closing connection - timed out waiting to join a room');
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Connection timed out waiting to join a room.'
            }));
            ws.close();
        }
    }, 60000); // 60 seconds timeout
    
    // 1. Parse target languages
    let targetLangsArray = ['Spanish']; // Default
    try {
        if (query && query.targetLangs) {
            // Split comma-separated string, decode, trim, filter empty
            targetLangsArray = query.targetLangs
                .split(',')
                .map(lang => decodeURIComponent(lang.trim()))
                .filter(lang => lang.length > 0);
            
            if (targetLangsArray.length === 0) {
                targetLangsArray = ['Spanish']; // Fallback if parsing results in empty array
                console.log(`Client connected. Invalid targetLangs in URL, defaulting to ${targetLangsArray[0]}`);
            } else {
                 console.log(`Client connected. Target languages from URL: ${targetLangsArray.join(', ')}`);
            }
        } else {
            console.log(`Client connected. No targetLangs in URL, defaulting to ${targetLangsArray[0]}`);
        }
    } catch (e) {
        console.error('Error parsing connection URL for target languages:', e);
        // Proceed with default
    }
    
    // 2. Handle room functionality
    let roomCode = null;
    let isHost = false;
    
    try {
        if (query && query.roomCode) {
            roomCode = query.roomCode;
            isHost = query.isHost === 'true';
            
            // Verify room exists
            if (!activeRooms.has(roomCode)) {
                if (isHost) {
                    // Create room if host is connecting and room doesn't exist yet
                    activeRooms.set(roomCode, {
                        hostWs: ws,
                        students: [],
                        transcript: [],
                        createdAt: Date.now()
                    });
                    console.log(`[Room] Host created room on connect: ${roomCode}`);
                } else {
                    // Reject connection if student tries to join non-existent room
                    console.log(`[Room] Rejected student - room not found: ${roomCode}`);
                    
                    // Add to rejected rooms set to prevent future reconnection attempts
                    rejectedRoomCodes.add(roomCode);
                    
                    ws.send(JSON.stringify({ 
                        type: 'room_error', 
                        message: 'Room not found. Please check the code and try again.' 
                    }));
                    ws.close();
                    return;
                }
            } else {
                // Room exists
                const room = activeRooms.get(roomCode);
                
                if (isHost) {
                    // Update host connection
                    room.hostWs = ws;
                    console.log(`[Room] Host joined existing room: ${roomCode}`);
                } else {
                    // Add student to room
                    room.students.push(ws);
                    console.log(`[Room] Student joined room: ${roomCode} (total students: ${room.students.length})`);
                    
                    // Send current transcript to newly joined student
                    if (room.transcript.length > 0) {
                        ws.send(JSON.stringify({
                            type: 'transcript_history',
                            data: room.transcript
                        }));
                    }
                }
            }
            
            // Track which room this client belongs to
            clientRooms.set(ws, {
                roomCode,
                isHost
            });
            
            // Clear the join room timeout since connection has successfully joined a room
            clearTimeout(joinRoomTimeout);
            
            // Confirmation message
            ws.send(JSON.stringify({
                type: 'room_joined',
                roomCode,
                isHost,
                message: isHost ? 
                    `You are hosting room ${roomCode}` : 
                    `You joined room ${roomCode} as a student`
            }));
        }
    } catch (e) {
        console.error('Error handling room connection:', e);
    }
    
    clientTargetLanguages.set(ws, targetLangsArray); // Store the array
    clientTextBuffers.set(ws, { text: '', lastEndTimeMs: 0 }); // Ensure this uses correct state

    ws.on('message', async (message) => {
        // Log the raw message and its type for debugging
        console.log('[WS DEBUG] Raw message:', message);
        console.log('[WS DEBUG] typeof message:', typeof message);
        
        // Check if client is in a room
        const clientRoom = clientRooms.get(ws);
        const isInRoom = !!clientRoom;
        const isRoomHost = isInRoom && clientRoom.isHost;
        
        // Students aren't allowed to send audio/text for processing
        if (isInRoom && !isRoomHost) {
            console.log(`[Room] Rejected message from student in room ${clientRoom.roomCode}`);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Students cannot send audio or text for transcription' 
            }));
            return;
        }
        
        if (Buffer.isBuffer(message)) {
            // Try to parse as string first
            try {
                const msgString = message.toString('utf8');
                console.log('[WS DEBUG] Buffer as string:', msgString);
                const data = JSON.parse(msgString);
                if (data && data.type === 'text_submit') {
                    console.log('[WS DEBUG] Parsed text_submit from buffer:', data);
                    if (isTextMode) {
                        const translateThis = data.text;
                        const sourceLang = data.lang;
                        const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                        // Always include English as a possible translation target
                        const allLangs = Array.from(new Set(['English', ...targetLangs]));
                        
                        // Use textModeLLM with sourceLang and targetLangs
                        const textModeLLM = require('./services/textModeLLM');
                        const translations = await textModeLLM.translateTextBatch(translateThis, sourceLang, allLangs);
                        
                        // Prepare response for host
                        const hostResponse = { 
                            type: 'recognized', 
                            lang: sourceLang, 
                            data: translateThis 
                        };
                        
                        // Send to host
                        ws.send(JSON.stringify(hostResponse));
                        
                        // Broadcast to students if this is a host in a room
                        if (isRoomHost) {
                            const room = activeRooms.get(clientRoom.roomCode);
                            if (room) {
                                // Store the transcript and translations for late joiners
                                room.transcript.push({
                                    text: translateThis,
                                    timestamp: Date.now()
                                });
                                
                                // Keep only the most recent 50 items
                                if (room.transcript.length > 50) {
                                    room.transcript = room.transcript.slice(-50);
                                }
                                
                                // Broadcast to all students in room
                                room.students.forEach(student => {
                                    if (student.readyState === WebSocket.OPEN) {
                                        student.send(JSON.stringify(hostResponse));
                                        
                                        // Also send translations to students
                                        for (const lang of allLangs) {
                                            if (lang !== sourceLang) {
                                                student.send(JSON.stringify({ 
                                                    type: 'translation', 
                                                    lang, 
                                                    data: translations[lang] 
                                                }));
                                            }
                                        }
                                    }
                                });
                            }
                        }
                        
                        // Send translations to host
                        for (const lang of allLangs) {
                            if (lang !== sourceLang) {
                                ws.send(JSON.stringify({ 
                                    type: 'translation', 
                                    lang, 
                                    data: translations[lang] 
                                }));
                            }
                        }
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Text submissions are only allowed in text mode.' }));
                    }
                    return; // Do not process as audio
                }
            } catch (err) {
                console.log('[WS DEBUG] Buffer is not JSON, treating as audio. Error:', err.message);
                // Not JSON, so treat as audio buffer
            }
            console.log(`[Server WS] Received audio buffer, size: ${message.length}`); // Log buffer reception
            try {
                // Process audio and get transcription
                const transcription = await transcribeAudio(message, 'audio.webm');
                if (transcription && ws.readyState === ws.OPEN) {
                    // Translate to all target languages (batch)
                    let targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                    
                    // Check if this is a host with students in the room - ensure Spanish is included for students
                    if (isRoomHost) {
                        const room = activeRooms.get(clientRoom.roomCode);
                        if (room && room.students && room.students.length > 0) {
                            // Only add Spanish if it's not already in the target languages
                            if (!targetLangs.includes('Spanish')) {
                                targetLangs = [...targetLangs, 'Spanish'];
                                console.log(`[Polycast] Added Spanish translation for students in room ${clientRoom.roomCode}`);
                            }
                        }
                    }
                    
                    console.log(`[Polycast] Calling Gemini for batch translation: '${transcription}' -> ${targetLangs.join(', ')}`);
                    const translations = await llmService.translateTextBatch(transcription, targetLangs);
                    
                    // Prepare recognized response
                    const recognizedResponse = { 
                        type: 'recognized', 
                        data: transcription 
                    };
                    
                    // Send to host
                    ws.send(JSON.stringify(recognizedResponse));
                    
                    // Broadcast to students if this is a host in a room
                    if (isRoomHost) {
                        const room = activeRooms.get(clientRoom.roomCode);
                        if (room) {
                            // Store the transcript for late joiners
                            room.transcript.push({
                                text: transcription,
                                timestamp: Date.now()
                            });
                            
                            // Keep only the most recent 50 items
                            if (room.transcript.length > 50) {
                                room.transcript = room.transcript.slice(-50);
                            }
                            
                            // Broadcast to all students in room
                            room.students.forEach(student => {
                                if (student.readyState === WebSocket.OPEN) {
                                    student.send(JSON.stringify(recognizedResponse));
                                    
                                    // Send Spanish translation to students, regardless of what other languages are available
                                    if (translations['Spanish']) {
                                        student.send(JSON.stringify({ 
                                            type: 'translation', 
                                            lang: 'Spanish', 
                                            data: translations['Spanish'] 
                                        }));
                                    } else {
                                        // Fallback: send the first available translation if Spanish isn't available
                                        const availableLangs = Object.keys(translations);
                                        if (availableLangs.length > 0) {
                                            const firstLang = availableLangs[0];
                                            student.send(JSON.stringify({ 
                                                type: 'translation', 
                                                lang: 'Spanish', // Still label it as Spanish for the student UI
                                                data: translations[firstLang] 
                                            }));
                                        }
                                    }
                                }
                            });
                            
                            // Persist transcript update to Redis
                            redisService.updateTranscript(clientRoom.roomCode, room.transcript)
                                .catch(err => console.error(`[Redis] Failed to update transcript for room ${clientRoom.roomCode}:`, err));
                        }
                    }
                    
                    // Send translations to host
                    for (const lang of targetLangs) {
                        ws.send(JSON.stringify({ 
                            type: 'translation', 
                            lang, 
                            data: translations[lang] 
                        }));
                    }
                }
            } catch (err) {
                console.error('Whisper transcription error:', err);
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Transcription failed: ' + err.message + ' (Try using Chrome or Edge)'
                    }));
                }
            }
        } else if (typeof message === 'string') {
            console.log('[WS DEBUG] Received string message:', message);
            try {
                const data = JSON.parse(message);
                if (data.type === 'text_submit') {
                    console.log('[WS DEBUG] Parsed text_submit from string:', data);
                    if (isTextMode) {
                        const translateThis = data.text;
                        const sourceLang = data.lang;
                        const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                        // Always include English as a possible translation target
                        const allLangs = Array.from(new Set(['English', ...targetLangs]));
                        // Use textModeLLM for text mode, llmService for audio mode
                        if (isTextMode) {
                            // Use textModeLLM with sourceLang and targetLangs
                            const textModeLLM = require('./services/textModeLLM');
                            const translations = await textModeLLM.translateTextBatch(translateThis, sourceLang, allLangs);
                            for (const lang of allLangs) {
                                if (lang !== sourceLang) {
                                    ws.send(JSON.stringify({ type: 'translation', lang, data: translations[lang] }));
                                }
                            }
                        } else {
                            // Use llmService for audio mode (default prompt)
                            const llmService = require('./services/llmService');
                            for (const lang of allLangs) {
                                if (lang !== sourceLang) {
                                    const translation = await llmService.translateText(translateThis, lang);
                                    ws.send(JSON.stringify({ type: 'translation', lang, data: translation }));
                                }
                            }
                        }
                        ws.send(JSON.stringify({ type: 'recognized', lang: sourceLang, data: translateThis }));
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Text submissions are only allowed in text mode.' }));
                    }
                }
            } catch (err) {
                console.error('Failed to parse or handle text_submit:', err);
            }
        } else {
            console.warn('[Server] Received unexpected non-buffer message, ignoring.');
        }
    });

    ws.on('close', async () => {
        // Clear the join room timeout to prevent memory leaks
        clearTimeout(joinRoomTimeout);
        
        // Check if the client was in a room
        const clientRoom = clientRooms.get(ws);
        if (clientRoom) {
            const { roomCode, isHost } = clientRoom;
            
            // Get room data
            const room = activeRooms.get(roomCode);
            if (room) {
                if (isHost) {
                    // Host disconnected - notify all students and close room
                    console.log(`[Room] Host disconnected from room: ${roomCode}, closing room`);
                    
                    // Notify all students that host has ended the session
                    room.students.forEach(student => {
                        if (student.readyState === WebSocket.OPEN) {
                            student.send(JSON.stringify({
                                type: 'host_disconnected',
                                message: 'The host has ended the session.'
                            }));
                        }
                    });
                    
                    // Delete room data from Redis
                    try {
                        await redisService.deleteRoom(roomCode);
                        console.log(`[Room] Successfully deleted room ${roomCode} from Redis`);
                    } catch (error) {
                        console.error(`[Room] Failed to delete room ${roomCode} from Redis:`, error);
                    }
                    
                    // Remove from in-memory room map
                    activeRooms.delete(roomCode);
                } else {
                    // Student disconnected - remove from room's student list
                    console.log(`[Room] Student disconnected from room: ${roomCode}`);
                    
                    // Remove student from room's student list
                    room.students = room.students.filter(student => student !== ws);
                    console.log(`[Room] Room ${roomCode} now has ${room.students.length} student(s)`);
                    
                    // Update Redis with current room state (student count)
                    try {
                        await redisService.saveRoom(roomCode, room);
                    } catch (error) {
                        console.error(`[Room] Failed to update room ${roomCode} in Redis after student disconnect:`, error);
                    }
                }
            }
            
            // Remove client's room tracking
            clientRooms.delete(ws);
        }
        
        // Clean up other client data
        clientTextBuffers.delete(ws);
        clientTargetLanguages.delete(ws);
        console.log('Client disconnected');
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clientTextBuffers.delete(ws);
        clientTargetLanguages.delete(ws);
    });
    ws.send(JSON.stringify({ type: 'info', message: `Connected to Polycast backend (Targets: ${targetLangsArray.join(', ')})` }));
});

// === Room Management API Endpoints ===

// Create a new room (HOST endpoint)
app.post('/api/create-room', async (req, res) => {
    try {
        const roomCode = await generateRoomCode();
        
        // Initialize the room with empty values
        const roomData = {
            hostWs: null,  // Will be set when host connects via WebSocket
            students: [],  // List of student WebSocket connections
            transcript: [], // Current transcript data
            createdAt: Date.now() // Timestamp for cleanup later
        };
        
        // Set in memory
        activeRooms.set(roomCode, roomData);
        
        // Persist in Redis
        await redisService.saveRoom(roomCode, roomData);
        
        console.log(`[Room] Created new room: ${roomCode}`);
        res.status(201).json({ roomCode });
    } catch (error) {
        console.error('[Room] Error creating room:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

// Check if a room exists (STUDENT endpoint)
app.get('/api/check-room/:roomCode', async (req, res) => {
    const { roomCode } = req.params;
    
    // Check if room exists in memory
    if (activeRooms.has(roomCode)) {
        console.log(`[Room] Room check success (memory): ${roomCode}`);
        res.status(200).json({ exists: true });
        return;
    }
    
    // If not in memory, check Redis
    try {
        const exists = await redisService.roomExists(roomCode);
        if (exists) {
            // Room exists in Redis, get its data
            const roomData = await redisService.getRoom(roomCode);
            
            // Initialize the room in memory
            activeRooms.set(roomCode, {
                hostWs: null,
                students: [],
                transcript: roomData.transcript || [],
                createdAt: roomData.createdAt || Date.now()
            });
            
            console.log(`[Room] Room check success (redis): ${roomCode}`);
            res.status(200).json({ exists: true });
        } else {
            console.log(`[Room] Room check failed - not found: ${roomCode}`);
            res.status(404).json({ exists: false, message: 'Room not found' });
        }
    } catch (error) {
        console.error(`[Room] Error checking room ${roomCode}:`, error);
        res.status(500).json({ error: 'Failed to check room' });
    }
});

// === Polycast Mode State ===
let isTextMode = loadModeFromDisk();

// Set PORT from env, config, or fallback to 3000
const PORT = process.env.PORT || config.port || 3000;

// API routes
app.get('/api/translate/:language/:text', async (req, res) => {
    try {
        const { language, text } = req.params;
        const translatedText = await llmService.translateText(decodeURIComponent(text), language);
        res.json({ translation: translatedText });
    } catch (error) {
        console.error("Translation API error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Dictionary API route - provides a contextual definition for a word
app.get('/api/dictionary/:word', async (req, res) => {
    try {
        const { word } = req.params;
        const context = req.query.context || '';
        console.log(`[Dictionary API] Getting definition for: ${word}${context ? ' with context: "' + context + '"' : ''}`);
        
        // Create a prompt that asks for a single contextual definition
        const prompt = `You are an expert language teacher helping a student understand a word in its specific context.

The word "${word}" appears in this context: "${context}"

Your task is to provide the SINGLE best definition that applies to how this word is used in this specific context.

Output ONLY a JSON object with these fields:
{
  "translation": "Spanish translation of the word as used in this specific context",
  "partOfSpeech": "The part of speech of the word in this context (noun, verb, adjective, etc.)",
  "definition": "A clear and concise definition appropriate for how the word is used in this context only",
  "example": "A simple example sentence showing a similar usage to the context"
}

Do NOT provide multiple definitions or explanations outside the JSON.`;
        
        // Log prompt for debugging
        console.log('[Dictionary API] Prompt:', prompt.substring(0, 200) + '...');
        
        // Generate the response using Gemini with low temperature for consistency
        const llmResponse = await generateTextWithGemini(prompt, 0.2);
        
        try {
            // Extract JSON from response
            const jsonMatch = llmResponse.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                const parsedResponse = JSON.parse(jsonStr);
                
                // Format for backward compatibility with existing frontend
                const formattedResponse = {
                    translation: parsedResponse.translation || '',
                    partOfSpeech: parsedResponse.partOfSpeech || '',
                    definition: parsedResponse.definition || '',
                    definitions: [{
                        text: parsedResponse.definition || '',
                        example: parsedResponse.example || ''
                    }],
                    isContextual: true
                };
                
                res.json(formattedResponse);
            } else {
                throw new Error('Could not extract JSON from LLM response');
            }
        } catch (parseError) {
            console.error('[Dictionary API] Error parsing response:', parseError);
            res.status(500).json({ error: 'Failed to parse definition', raw: llmResponse });
        }
    } catch (error) {
        console.error("Dictionary API error:", error);
        res.status(500).json({ error: error.message });
    }
});

// === IMAGE GENERATION ENDPOINT ===
app.get('/api/generate-image', async (req, res) => {
    const prompt = req.query.prompt || '';
    const size = req.query.size || '1024x1024';
    const moderation = req.query.moderation || 'auto';
    
    console.log(`[Image Generation] Request received. Prompt: "${prompt.substring(0, 30)}...", Size: ${size}, Moderation: ${moderation}`);
    
    try {
        const imgPayload = await generateImage(prompt, size, moderation);

        // imgPayload is now a data-URI (or the file URL you create)
        console.log('[Image Generation] Success! Image payload ready');
        res.json({ url: imgPayload });
    } catch (error) {
        console.error('[Image Generation] Error:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to generate image.' });
    }
});

// Endpoint to get current mode
app.get('/mode', (req, res) => {
    res.json({ isTextMode });
});

// Endpoint to set current mode
app.post('/mode', (req, res) => {
    if (typeof req.body.isTextMode === 'boolean') {
        isTextMode = req.body.isTextMode;
        saveModeToDisk(isTextMode);
        res.json({ isTextMode });
    } else {
        res.status(400).json({ error: 'Missing or invalid isTextMode' });
    }
});

// Start the HTTP server
server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

// Room cleanup - run every minute
setInterval(() => {
    console.log('[Cleanup] Running room cleanup check');
    const now = Date.now();
    const MAX_ROOM_AGE_MS = 60 * 60 * 1000; // 60 minutes
    
    // Check each active room
    for (const [roomCode, roomData] of activeRooms.entries()) {
        const roomAge = now - roomData.createdAt;
        
        // If room is older than MAX_ROOM_AGE_MS, clean it up
        if (roomAge > MAX_ROOM_AGE_MS) {
            console.log(`[Cleanup] Removing inactive room: ${roomCode} (age: ${Math.floor(roomAge / 60000)} minutes)`);
            
            // Close all connections in this room
            if (roomData.hostWs && roomData.hostWs.readyState === WebSocket.OPEN) {
                roomData.hostWs.send(JSON.stringify({
                    type: 'room_expired',
                    message: 'This room has expired due to inactivity.'
                }));
                roomData.hostWs.close();
            }
            
            roomData.students.forEach(studentWs => {
                if (studentWs.readyState === WebSocket.OPEN) {
                    studentWs.send(JSON.stringify({
                        type: 'room_expired',
                        message: 'This room has expired due to inactivity.'
                    }));
                    studentWs.close();
                }
            });
            
            // Remove room data
            activeRooms.delete(roomCode);
            redisService.deleteRoom(roomCode).catch(console.error);
        }
    }
}, 60000); // Run every minute

// Global cleanup admin endpoint - clears all rejected rooms and force-disconnects problematic connections
app.post('/api/admin/global-cleanup', async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    
    // Basic authentication
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        // Count of all connections before
        const connectionsBefore = wss.clients.size;
        let closedConnections = 0;
        
        // Force close all problematic WebSocket connections
        wss.clients.forEach(client => {
            const clientRoom = clientRooms.get(client);
            
            // Close connections that either:
            // 1. Have no room association (lingering)
            // 2. Are students trying to connect to a room in the rejected list
            if (!clientRoom || 
                (clientRoom && !clientRoom.isHost && rejectedRoomCodes.has(clientRoom.roomCode))) {
                
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'admin_terminated',
                        message: 'Your connection has been terminated by an administrator.'
                    }));
                    client.close();
                    closedConnections++;
                }
            }
        });
        
        // Count of rejected rooms before
        const rejectedBefore = rejectedRoomCodes.size;
        
        // Clear all rejected room codes
        rejectedRoomCodes.clear();
        
        return res.status(200).json({
            success: true,
            message: `Global cleanup completed. Closed ${closedConnections} of ${connectionsBefore} connections. Cleared ${rejectedBefore} rejected room codes.`
        });
    } catch (error) {
        console.error('[Admin] Error performing global cleanup:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Force-terminate a room (admin endpoint)
app.post('/api/admin/terminate-room/:roomCode', async (req, res) => {
    const { roomCode } = req.params;
    const adminKey = req.headers['x-admin-key'];
    
    // Basic authentication
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        if (activeRooms.has(roomCode)) {
            const roomData = activeRooms.get(roomCode);
            
            // Close all connections
            let disconnectedClients = 0;
            
            if (roomData.hostWs && roomData.hostWs.readyState === WebSocket.OPEN) {
                roomData.hostWs.send(JSON.stringify({
                    type: 'room_terminated',
                    message: 'This room has been terminated by an administrator.'
                }));
                roomData.hostWs.close();
                disconnectedClients++;
            }
            
            roomData.students.forEach(studentWs => {
                if (studentWs.readyState === WebSocket.OPEN) {
                    studentWs.send(JSON.stringify({
                        type: 'room_terminated',
                        message: 'This room has been terminated by an administrator.'
                    }));
                    studentWs.close();
                    disconnectedClients++;
                }
            });
            
            // Remove from memory and Redis
            activeRooms.delete(roomCode);
            await redisService.deleteRoom(roomCode);
            
            return res.status(200).json({ 
                success: true, 
                message: `Room ${roomCode} terminated. ${disconnectedClients} active connections closed.` 
            });
        } else {
            // Check if room exists in Redis
            const exists = await redisService.roomExists(roomCode);
            
            if (exists) {
                await redisService.deleteRoom(roomCode);
                return res.status(200).json({ 
                    success: true, 
                    message: `Room ${roomCode} deleted from persistent storage. No active connections.` 
                });
            } else {
                return res.status(404).json({ 
                    success: false, 
                    message: `Room ${roomCode} not found` 
                });
            }
        }
    } catch (error) {
        console.error(`[Admin] Error terminating room ${roomCode}:`, error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Basic health check endpoint (optional)
app.get('/', (req, res) => {
    res.status(200).send('Polycast Backend Server is running.');
});

// Graceful shutdown (optional but good practice)
process.on('SIGTERM', () => {
    console.info('SIGTERM signal received: closing HTTP server');
    wss.close(() => {
        console.log('WebSocket server closed');
    });
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Export for testing purposes
// === Dictionary API Endpoints ===

// Endpoint to get definition from local JSON dictionary files
app.get('/api/local-dictionary/:letter/:word', async (req, res) => {
    const { letter, word } = req.params;
    const contextSentence = req.query.context || '';
    
    // Validate letter is a single character a-z
    if (!/^[a-z]$/.test(letter)) {
        return res.status(400).json({ error: 'Letter parameter must be a single letter a-z' });
    }
    
    try {
        // Create a prompt that asks for a dictionary-style definition and examples, but ONLY for the specific context
        const prompt = `You are creating dictionary entries for non-native English speakers who are learning English. 
    
Your job is to explain the English word "${word}" in a simple, clear way that helps beginners understand it.
The word appears in this context: "${contextSentence}". Your definition and example should be specific to how the word is used in this context ONLY.
Your response must be in JSON format with these fields:
{
  "translation": "Spanish translation of the word as used in this specific context",
  "partOfSpeech": "The part of speech (noun, verb, adjective, etc.) of the word in this context",
  "frequencyRating": "A number from 1 to 5 representing how common this word is in everyday English in this sense",
  "definition": "VERY SIMPLE and SHORT explanation in simple English for how the word is used in this context (1-2 short sentences max)",
  "example": "A simple example sentence in English that uses this word in a similar way to the context."
}

IMPORTANT: ONLY provide the definition of the word as it is used in the context sentence. DO NOT provide multiple definitions or alternative meanings.
Only return the JSON object, nothing else.`;
        
        // Log the prompt for debugging
        console.log('--- LLM Definition Prompt ---');
        console.log(prompt);
        console.log('--- End LLM Definition Prompt ---');
        
        // If this is a test or development environment, return mock data
        if (process.env.NODE_ENV === 'test' || process.env.MOCK_LLM === 'true') {
            console.log('Using mock LLM data for dictionary');
            return res.json(mockDictionaryResponse(word));
        }
        
        // Generate the response directly with Gemini
        const llmResponse = await generateTextWithGemini(prompt, 0.3);
        
        // Parse the JSON response
        try {
            // Extract JSON object if it's embedded in text
            const jsonMatch = llmResponse.match(/\{[\s\S]*?\}/); // Find first JSON-like object
            
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                console.log(`Extracted JSON response for ${word}:`, jsonStr);
                
                const parsedResponse = JSON.parse(jsonStr);
                
                // Normalize the response format
                const normalizedResponse = {
                    translation: parsedResponse.translation || '',
                    partOfSpeech: parsedResponse.partOfSpeech || '',
                    frequencyRating: parsedResponse.frequencyRating || 3,
                    definitions: [{
                        text: parsedResponse.definition || '',
                        example: parsedResponse.example || ''
                    }],
                    isContextual: true
                };
                
                res.json(normalizedResponse);
            } else {
                throw new Error('Could not extract JSON from LLM response');
            }
        } catch (parseError) {
            console.error(`Error parsing LLM response for ${word}:`, parseError);
            throw new Error('Failed to parse LLM response');
        }
    } catch (error) {
        console.error(`Error getting definition for ${word}:`, error);
        res.status(500).json({ error: 'Failed to get definition', message: error.message });
    }
});

// New endpoint for disambiguating word definitions using Gemini
app.post('/api/disambiguate-word', async (req, res) => {
    try {
        const { word, contextSentence, definitions, existingFlashcardSenseIds = [] } = req.body;
        
        if (!word || !contextSentence || !definitions || !Array.isArray(definitions)) {
            return res.status(400).json({ 
                error: 'Missing required parameters (word, contextSentence, definitions)' 
            });
        }
        
        console.log(`\n[WORD SENSE DISAMBIGUATION] Processing '${word}' in context: "${contextSentence}"`);
        console.log(`[WORD SENSE DISAMBIGUATION] Found ${definitions.length} possible definitions in dictionary`);
        
        // The context sentence may have the target word emphasized with asterisks
        // Example: "I am going to *charge* my phone"
        console.log(`Context received with emphasis: ${contextSentence}`);

        // Create a prompt for the LLM to use context to disambiguate
        const prompt = `You are an expert language teacher. I need you to determine the correct definition of the word "${word}" in this specific context: "${contextSentence}". 

Possible definitions:
${definitions.map((def, idx) => `${idx + 1}. (${def.partOfSpeech}) ${def.definition}`).join('\n')}

The word is emphasized with asterisks (*) in the context. Analyze the context carefully to determine how the word is being used.

Output ONLY a JSON object with these fields: {"partOfSpeech": the part of speech, "definition": the full exact definition text that best matches the word in this context}. Do NOT create new definitions.`;
        
        console.log(`[WORD SENSE DISAMBIGUATION] Sending prompt to Gemini for disambiguation`);
        
        // Call Gemini API with a custom function since llmService doesn't have generateText
        // We'll create our own direct call to the model
        const response = await generateTextWithGemini(prompt, 0.1);
        
        // Find the most closely matching definition from the response
        const bestMatch = findBestMatchingDefinition(response, definitions);
        
        if (bestMatch) {
            console.log(`[WORD SENSE DISAMBIGUATION] Gemini identified definition: (${bestMatch.partOfSpeech}) ${bestMatch.definition}`);
            
            // Create a unique sense ID for this definition
            const definitionHash = bestMatch.definition.substring(0, 8).replace(/\W+/g, '');
            const wordSenseId = `${word.toLowerCase()}_${bestMatch.partOfSpeech}_${definitionHash}`;
            
            // Check if we already have a flashcard for this sense
            if (existingFlashcardSenseIds.includes(wordSenseId)) {
                console.log(`[WORD SENSE DISAMBIGUATION] ⚠️ This sense of '${word}' already exists in flashcards. No new card needed.`);
                return res.json({
                    word,
                    contextSentence,
                    disambiguatedDefinition: bestMatch,
                    wordSenseId,
                    existingFlashcard: true,
                    rawLlmResponse: response
                });
            } else {
                console.log(`[WORD SENSE DISAMBIGUATION] ✓ New sense of '${word}' identified! Creating new flashcard with ID: ${wordSenseId}`);
                return res.json({
                    word,
                    contextSentence,
                    disambiguatedDefinition: bestMatch,
                    wordSenseId,
                    existingFlashcard: false,
                    rawLlmResponse: response
                });
            }
        } else {
            console.log(`[WORD SENSE DISAMBIGUATION] ⚠️ Failed to identify best matching definition`);
            return res.json({
                word,
                contextSentence,
                allDefinitions: definitions,
                disambiguatedDefinition: null,
                rawLlmResponse: response,
                error: 'Could not determine best definition match'
            });
        }
    } catch (error) {
        console.error('[WORD SENSE DISAMBIGUATION] Error:', error);
        return res.status(500).json({ error: 'Error disambiguating definition' });
    }
});

// Helper function to find the best matching definition from the LLM response
function findBestMatchingDefinition(llmResponse, definitions) {
    if (!llmResponse || !definitions || !definitions.length) {
        console.log('[WORD SENSE DISAMBIGUATION] Empty response or definitions');
        return null;
    }
    
    console.log('[WORD SENSE DISAMBIGUATION] Parsing response:', llmResponse.substring(0, 200));
    
    // First try to parse JSON from the response
    try {
        // Extract JSON object if it's embedded in text
        const jsonMatch = llmResponse.match(/\{[\s\S]*?\}/); // Find first JSON-like object
        
        if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            console.log('[WORD SENSE DISAMBIGUATION] Found JSON:', jsonStr);
            
            const parsedResponse = JSON.parse(jsonStr);
            
            if (parsedResponse.partOfSpeech && parsedResponse.definition) {
                // Find the definition that matches both part of speech and definition
                const exactMatch = definitions.find(def => 
                    def.partOfSpeech.toLowerCase() === parsedResponse.partOfSpeech.toLowerCase() && 
                    def.definition.toLowerCase() === parsedResponse.definition.toLowerCase()
                );
                
                if (exactMatch) {
                    console.log('[WORD SENSE DISAMBIGUATION] Found exact match from JSON response');
                    return exactMatch;
                }
                
                // If no exact match, find the closest match
                let bestMatch = null;
                let highestSimilarity = 0;
                
                for (const def of definitions) {
                    // Check part of speech first
                    if (def.partOfSpeech.toLowerCase() === parsedResponse.partOfSpeech.toLowerCase()) {
                        const similarity = calculateSimilarity(parsedResponse.definition, def.definition);
                        
                        if (similarity > highestSimilarity) {
                            highestSimilarity = similarity;
                            bestMatch = def;
                        }
                    }
                }
                
                if (bestMatch) {
                    console.log('[WORD SENSE DISAMBIGUATION] Found best match from JSON by similarity');
                    return bestMatch;
                }
            }
        }
    } catch (e) {
        console.log('[WORD SENSE DISAMBIGUATION] Error parsing JSON:', e.message);
        // Fall back to the original method if JSON parsing fails
    }
    
    // Fallback: Try to find exact text matches
    for (const def of definitions) {
        const fullDefinition = `(${def.partOfSpeech}) ${def.definition}`;
        if (llmResponse.includes(fullDefinition)) {
            console.log('[WORD SENSE DISAMBIGUATION] Found match by exact text');
            return def;
        }
    }
    
    // If no exact match, use partial matching on the definition text
    let bestMatch = null;
    let highestSimilarity = 0;
    
    for (const def of definitions) {
        // Simple similarity check - how much of the definition is in the response
        const similarity = calculateSimilarity(llmResponse, def.definition);
        
        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = def;
        }
    }
    
    console.log('[WORD SENSE DISAMBIGUATION] Found match by text similarity');
    return bestMatch;
}

// Simple function to calculate text similarity
function calculateSimilarity(text1, text2) {
    const text1Lower = text1.toLowerCase();
    const text2Lower = text2.toLowerCase();
    
    // Count how many words from text2 appear in text1
    const words = text2Lower.split(/\s+/);
    let matches = 0;
    
    for (const word of words) {
        if (word.length > 3 && text1Lower.includes(word)) { // Only check words longer than 3 chars
            matches++;
        }
    }
    
    return matches / words.length; // Return percentage of matching words
}

/**
 * A simple function to generate text using Gemini
 * Since llmService doesn't have a direct generateText function,
 * we'll implement our own here using the same initialization pattern
 * @param {string} prompt The prompt to send to Gemini
 * @param {number} temperature The temperature setting (0-1)
 * @returns {Promise<string>} The generated text response
 */
async function generateTextWithGemini(prompt, temperature = 0.7) {
    try {
        // Make sure we have initialized the Gemini model through llmService
        // This calls the same initialization used in other llmService functions
        if (!llmService._isInitialized) {
            // See if we can call an existing function to make sure model is initialized
            await llmService.translateText('test', 'Spanish'); // This will initialize if needed
        }
        
        console.log(`[GEMINI] Generating text with prompt: ${prompt.substring(0, 50)}...`);
        
        // Use the raw Google API directly instead of going through llmService
        // We're using require at this point to avoid needing to move this to llmService.js
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });
        
        // Generate content with the provided temperature
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: temperature }
        });
        
        const response = result.response;
        const text = response.text();
        
        console.log(`[GEMINI] Generated ${text.length} chars of text`);
        return text;
    } catch (error) {
        console.error('[GEMINI] Error generating text:', error);
        throw error;
    }
}

module.exports = { server, wss };
