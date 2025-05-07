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
                    const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
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
                                    
                                    // Also send translations to students
                                    for (const lang of targetLangs) {
                                        student.send(JSON.stringify({ 
                                            type: 'translation', 
                                            lang, 
                                            data: translations[lang] 
                                        }));
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

// Dictionary API route
app.get('/api/dictionary/:word', async (req, res) => {
    try {
        const { word } = req.params;
        const context = req.query.context || '';
        console.log(`[Dictionary API] Getting definition for: ${word}${context ? ' with context' : ''}`);
        const definition = await llmService.getWordDefinition(word, context);
        res.json(definition);
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
module.exports = { server, wss };
