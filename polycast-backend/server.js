// Basic server setup placeholder
require('dotenv').config(); // Ensure .env is loaded at the very top
console.log('Server starting...');

// Debug: Print OpenAI API Key (should be defined, or print warning)
if (process.env.OPENAI_API_KEY) {
    console.log('OpenAI API Key loaded:', process.env.OPENAI_API_KEY.slice(0, 8) + '...');
} else {
    console.warn('OpenAI API Key is NOT loaded! Check your .env file and dotenv config.');
}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const url = require('url'); // To parse connection URL
const config = require('./config/config');
const speechService = require('./services/speechService');
const llmService = require('./services/llmService');
const { transcribeAudio } = require('./services/whisperService');

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
// Pass request object to connection handler
const wss = new WebSocket.Server({ server });

console.log(`WebSocket server created.`);

// === WebSocket Handling ===

const clientTextBuffers = new Map();
const clientTargetLanguages = new Map(); // Keep for language from URL, will store an array now

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

    ws.on('message', async (message) => {
        // Only process buffers (audio)
        if (Buffer.isBuffer(message)) {
            console.log(`[Server WS] Received audio buffer, size: ${message.length}`); // Log buffer reception
            try {
                // Detect MIME type from the first few bytes if possible (future improvement)
                // For now, always use 'audio.webm' as filename, but set contentType dynamically if possible
                const transcription = await transcribeAudio(message, 'audio.webm');
                if (transcription && ws.readyState === ws.OPEN) {
                    // Translate to all target languages
                    const targetLangs = clientTargetLanguages.get(ws) || ['Spanish'];
                    for (const lang of targetLangs) {
                        try {
                            console.log(`[Polycast] Calling Gemini for translation: '${transcription}' -> ${lang}`);
                            const translation = await llmService.translateText(transcription, lang);
                            console.log(`[Polycast] Gemini translation result [${lang}]:`, translation);
                            ws.send(JSON.stringify({ type: 'translation', lang, data: translation }));
                        } catch (transErr) {
                            console.error(`[Polycast] Gemini translation error for ${lang}:`, transErr);
                            ws.send(JSON.stringify({ type: 'translation_error', lang, message: transErr.message }));
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
        } else {
            // Ignore non-buffer messages
            console.warn('[Server] Received unexpected non-buffer message, ignoring.');
        }
    });

    ws.on('close', () => {
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

// === Polycast Mode State ===
let isTextMode = false;

// Endpoint to get current mode
app.get('/mode', (req, res) => {
    res.json({ isTextMode });
});

// Endpoint to set mode
app.post('/mode', express.json(), (req, res) => {
    if (typeof req.body.isTextMode === 'boolean') {
        isTextMode = req.body.isTextMode;
        res.json({ isTextMode });
    } else {
        res.status(400).json({ error: 'isTextMode must be boolean' });
    }
});

// Start the HTTP server
server.listen(config.port, () => {
    console.log(`HTTP server listening on port ${config.port}`);
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
