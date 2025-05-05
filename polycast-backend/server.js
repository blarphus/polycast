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

// Initialize Express app
const app = express();

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

// === WebSocket Handling ===

const clientTextBuffers = new Map();
const clientTargetLanguages = new Map(); // Keep for language from URL, will store an array now
const clientAppMode = new Map();

// Modify connection handler to accept request object (req) and make it async
wss.on('connection', (ws, req) => {
    // 1. Parse target languages from connection URL query param
    let targetLangsArray = ['Spanish']; // Default
    try {
        const parsedUrl = url.parse(req.url, true); // true parses query string
        if (parsedUrl.query && parsedUrl.query.targetLangs) {
            // Split comma-separated string, decode, trim, filter empty
            targetLangsArray = parsedUrl.query.targetLangs
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
    clientTargetLanguages.set(ws, targetLangsArray); // Store the array
    clientTextBuffers.set(ws, { text: '', lastEndTimeMs: 0 }); // Ensure this uses correct state
    clientAppMode.set(ws, 'audio'); // Default to audio mode

    ws.on('message', async (message) => {
        // Log the raw message and its type for debugging
        console.log('[WS DEBUG] Raw message:', message);
        console.log('[WS DEBUG] typeof message:', typeof message);
        if (Buffer.isBuffer(message)) {
            // Try to parse as string first
            try {
                const msgString = message.toString('utf8');
                console.log('[WS DEBUG] Buffer as string:', msgString);
                const data = JSON.parse(msgString);
                if (data && data.type === 'text_submit') {
                    console.log('[WS DEBUG] Parsed text_submit from buffer:', data);
                    if (clientAppMode.get(ws) === 'text') {
                        const translateThis = data.text;
                        const sourceLang = data.lang;
                        const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                        // Always include English as a possible translation target
                        const allLangs = Array.from(new Set(['English', ...targetLangs]));
                        // Use textModeLLM for text mode, llmService for audio mode
                        if (clientAppMode.get(ws) === 'text') {
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
                    return; // Do not process as audio
                }
            } catch (err) {
                console.log('[WS DEBUG] Buffer is not JSON, treating as audio. Error:', err.message);
                // Not JSON, so treat as audio buffer
            }
            console.log(`[Server WS] Received audio buffer, size: ${message.length}`); // Log buffer reception
            try {
                // Detect MIME type from the first few bytes if possible (future improvement)
                // For now, always use 'audio.webm' as filename, but set contentType dynamically if possible
                const transcription = await transcribeAudio(message, 'audio.webm');
                if (transcription && ws.readyState === ws.OPEN) {
                    storeWordContext(transcription);
                    // Translate to all target languages (batch)
                    const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                    // Check appMode to determine which service to use
                    if (clientAppMode.get(ws) === 'text') {
                        console.log(`[Polycast] Calling Text Mode translation: '${transcription}' → ${targetLangs.join(', ')}`);
                        // Use textModeLLM for text mode
                        try {
                            const translations = await Promise.all(
                                targetLangs.map(lang => textModeLLM.translateText(transcription, 'English', lang))
                            );
                            
                            // Format as batch result
                            const transResult = {};
                            targetLangs.forEach((lang, i) => {
                                transResult[lang] = translations[i];
                            });
                            
                            ws.send(JSON.stringify({
                                type: 'translation',
                                text: transcription,
                                translations: transResult
                            }));
                        } catch (err) {
                            console.error(`[Polycast] Text Mode translation error:`, err);
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: `Translation error: ${err.message}`
                            }));
                        }
                    } else {
                        // Default to audio mode - use batch translation
                        console.log(`[Polycast] Calling Gemini for batch translation: '${transcription}' → ${targetLangs.join(', ')}`);
                        try {
                            const transResult = await llmService.batchTranslateText(transcription, targetLangs);
                            ws.send(JSON.stringify({
                                type: 'translation',
                                text: transcription,
                                translations: transResult
                            }));
                        } catch (transErr) {
                            console.error(`[Polycast] Gemini batch translation error:`, transErr);
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: `Translation error: ${transErr.message}`
                            }));
                        }
                    }
                    // Always send recognized as well
                    ws.send(JSON.stringify({ type: 'recognized', data: transcription }));
                }
            } catch (err) {
                console.error('Whisper transcription error:', err);
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Transcription failed: ' + err.message + ' (Try using Chrome or Edge)'}));
                }
            }
        } else if (typeof message === 'string') {
            console.log('[WS DEBUG] Received string message:', message);
            try {
                const data = JSON.parse(message);
                if (data.type === 'text_submit') {
                    console.log('[WS DEBUG] Parsed text_submit from string:', data);
                    if (clientAppMode.get(ws) === 'text') {
                        const translateThis = data.text;
                        const sourceLang = data.lang;
                        const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                        // Always include English as a possible translation target
                        const allLangs = Array.from(new Set(['English', ...targetLangs]));
                        // Use textModeLLM for text mode, llmService for audio mode
                        if (clientAppMode.get(ws) === 'text') {
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

    ws.on('close', () => {
        clientTextBuffers.delete(ws);
        clientTargetLanguages.delete(ws);
        clientAppMode.delete(ws);
        console.log('Client disconnected');
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clientTextBuffers.delete(ws);
        clientTargetLanguages.delete(ws);
        clientAppMode.delete(ws);
    });
    ws.send(JSON.stringify({ type: 'info', message: `Connected to Polycast backend (Targets: ${targetLangsArray.join(', ')})` }));
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
        const word = req.params.word;
        console.log(`[Dictionary API] Getting definition for: ${word}`);
        const definition = await llmService.getWordDefinition(word);
        res.json(definition);
    } catch (error) {
        console.error("Dictionary API error:", error);
        res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
});

// Text-to-Speech API route
app.get('/api/tts', async (req, res) => {
    try {
        const { text, voice } = req.query;
        
        if (!text) {
            return res.status(400).json({ error: 'Text parameter is required' });
        }
        
        console.log(`[TTS API] Generating speech for: "${text.substring(0, 50)}..."`);
        const audioBuffer = await llmService.generateSpeech(text, voice || 'alloy');
        
        // Cache headers
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
        });
        
        res.send(audioBuffer);
    } catch (error) {
        console.error("TTS API error:", error);
        res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
});

// Original context examples API
app.get('/api/context/:word', async (req, res) => {
    try {
        const word = req.params.word;
        console.log(`[Context API] Getting original context for: ${word}`);
        
        // Get original context examples from the transcript history
        // This is a placeholder - implement based on your data storage
        const examples = wordContextCache.get(word.toLowerCase()) || [];
        
        res.json({ examples });
    } catch (error) {
        console.error("Context API error:", error);
        res.status(500).json({ error: error.message || 'Unknown error occurred' });
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

// Global cache for word contexts from transcripts
const wordContextCache = new Map();

// Store word context when transcriptions come in
function storeWordContext(transcription) {
    if (!transcription || typeof transcription !== 'string') return;
    
    const words = transcription.match(/\b\w+\b/g) || [];
    const lowerTranscription = transcription.toLowerCase();
    
    words.forEach(word => {
        if (word.length < 2) return; // Skip very short words
        
        const lowerWord = word.toLowerCase();
        const contexts = wordContextCache.get(lowerWord) || [];
        
        // Avoid duplicates
        if (!contexts.includes(transcription)) {
            contexts.push(transcription);
            // Keep only the last 5 examples
            if (contexts.length > 5) {
                contexts.shift();
            }
            wordContextCache.set(lowerWord, contexts);
        }
    });
}

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
