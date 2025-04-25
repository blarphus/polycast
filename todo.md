# Polycast v0.1 - Local Development Build Plan

This plan outlines the steps to build the core functionality for local testing.

## Phase 1: Backend Setup & Core API Integration (Node.js/Express)

*   [ ] **1.1. Project Setup:**
    *   [ ] Create a new directory for the backend (e.g., `polycast-backend`).
    *   [ ] `cd polycast-backend`
    *   [ ] Run `npm init -y` to create `package.json`.
    *   [ ] Install core dependencies: `npm install express ws dotenv axios deepl-node`
    *   [ ] Install development dependency (optional but recommended): `npm install --save-dev nodemon` (for auto-restarting server during development).
    *   [ ] Create basic project structure (e.g., `server.js`, `config/`, `services/`).
*   [ ] **1.2. Environment Configuration:**
    *   [ ] Create a `.env` file in the root of `polycast-backend`.
    *   [ ] Add `OPENAI_API_KEY=YOUR_OPENAI_KEY` and `DEEPL_AUTH_KEY=YOUR_DEEPL_FREE_KEY` to `.env`.
    *   [ ] Create a `.gitignore` file and add `.env` and `node_modules/` to it.
    *   [ ] Create a `config/config.js` file to load these variables using `dotenv`.
*   [ ] **1.3. Basic Express & WebSocket Server:**
    *   [ ] In `server.js`, set up a basic Express app.
    *   [ ] Create an HTTP server using Node's `http` module, passing the Express app to it.
    *   [ ] Create a WebSocket server using `ws`, attaching it to the HTTP server.
    *   [ ] Define a basic WebSocket connection handler (`wss.on('connection', ws => { ... })`).
    *   [ ] Implement logic for the server to listen on a specific port (e.g., 8080) loaded from `.env` or defaulted.
    *   [ ] Add basic logging for client connections/disconnections.
*   [ ] **1.4. Whisper Service Module:**
    *   [ ] Create `services/whisperService.js`.
    *   [ ] Implement an async function `transcribeAudio(audioBuffer)` that:
        *   Takes an audio buffer/blob.
        *   Creates `FormData` suitable for the Whisper API (likely needs the audio data and `model='whisper-1'`).
        *   Uses `axios` to POST the data to the OpenAI Whisper API endpoint (`https://api.openai.com/v1/audio/transcriptions`).
        *   Includes the `Authorization: Bearer YOUR_OPENAI_KEY` header.
        *   Handles the response, returning the transcribed text.
        *   Includes basic `try...catch` error handling, logging errors.
*   [ ] **1.5. DeepL Service Module:**
    *   [ ] Create `services/deeplService.js`.
    *   [ ] Initialize the `deepl-node` translator using your auth key from config.
    *   [ ] Implement an async function `translateSentence(text, targetLang)` that:
        *   Takes the source text (English) and a target language code (e.g., 'ES', 'ZH', 'MY').
        *   Calls the DeepL API using the `deepl-node` client.
        *   Specifies `sourceLang: 'EN'`.
        *   Handles the response, returning the translated text.
        *   Includes basic `try...catch` error handling (especially for unsupported languages or quota errors), logging errors.
*   [ ] **1.6. WebSocket Message Handling (Audio Input):**
    *   [ ] In `server.js`'s WebSocket connection handler, add logic for `ws.on('message', message => { ... })`.
    *   [ ] Assume incoming messages are audio Blobs/Buffers initially.
    *   [ ] **Test:** Call `whisperService.transcribeAudio` with the received audio data.
    *   [ ] Log the transcription result to the console for now.

## Phase 2: Frontend Setup & Audio Capture

*   [ ] **2.1. Project Setup:**
    *   [ ] Create a new directory for the frontend (e.g., `polycast-frontend`) *outside* the backend directory.
    *   [ ] Use Create React App or Vite to initialize the project:
        *   `npx create-react-app polycast-frontend` OR `npm create vite@latest polycast-frontend -- --template react`
    *   [ ] `cd polycast-frontend`
    *   [ ] Install any necessary state management libraries if not using built-in Context (e.g., `npm install zustand`).
*   [ ] **2.2. Basic App Structure:**
    *   [ ] Clean up default boilerplate in `src/App.js`.
    *   [ ] Create basic component structure (e.g., `components/AudioRecorder`, `components/TranscriptionDisplay`, `components/Controls`).
*   [ ] **2.3. WebSocket Hook/Provider:**
    *   [ ] Create a custom hook (`hooks/useWebSocket.js`) or context provider to manage the WebSocket connection.
    *   [ ] Implement connect (`new WebSocket('ws://localhost:BACKEND_PORT')`), disconnect, send message logic.
    *   [ ] Handle `onopen`, `onclose`, `onerror`, and `onmessage` events.
    *   [ ] Store connection status and received messages in React state.
*   [ ] **2.4. Audio Recorder Component (`AudioRecorder.js`):**
    *   [ ] Implement state for recording status (`isRecording`).
    *   [ ] Add a button to trigger recording.
    *   [ ] On button click:
        *   Request microphone permission using `navigator.mediaDevices.getUserMedia({ audio: true })`.
        *   Handle permission success: Create `MediaRecorder` instance from the stream. Set `isRecording` state.
        *   Handle permission failure: Show an error message.
    *   [ ] Configure `MediaRecorder`:
        *   Set up `ondataavailable` handler: Collect audio data chunks (`event.data`).
        *   Set up `timeslice` option in `mediaRecorder.start(5000)` (e.g., 5000ms for 5-second chunks).
        *   In `ondataavailable`, if data size > 0, send the `event.data` Blob using the WebSocket hook/provider's send function.
    *   [ ] Implement Stop button logic: Call `mediaRecorder.stop()`, update `isRecording` state, potentially clean up stream/recorder.
*   [ ] **2.5. Basic Display Component (`TranscriptionDisplay.js`):**
    *   [ ] Create a component that receives an array of message objects (initially just raw text from backend test) from props or context.
    *   [ ] Render the received messages as a simple list.
*   [ ] **2.6. Controls Component (`Controls.js`):**
    *   [ ] Render the `AudioRecorder` component.
    *   [ ] (Placeholder for later controls).
*   [ ] **2.7. Integration & Initial Test:**
    *   [ ] Wire up the components in `App.js`.
    *   [ ] Ensure the WebSocket hook connects to the backend.
    *   [ ] Start the backend server (`nodemon server.js` or `node server.js`).
    *   [ ] Start the frontend dev server (`npm start`).
    *   [ ] **Test:** Click Start, speak, check backend console for transcription logs. Check frontend console for WebSocket messages.

## Phase 3: Backend Sentence Processing & Translation Workflow

*   [ ] **3.1. Sentence Buffer/Processor:**
    *   [ ] Create `services/sentenceProcessor.js` or add logic within the WebSocket handler.
    *   [ ] Maintain a buffer string per WebSocket connection (`let transcriptionBuffer = '';`).
    *   [ ] When new text arrives from Whisper, append it to the buffer (`transcriptionBuffer += ' ' + newText;`).
    *   [ ] Implement sentence detection logic:
        *   Use regex (e.g., `/^(.+?[.?!])\s+/`) to find the first complete sentence at the start of the buffer.
        *   If a sentence is found:
            *   Extract the sentence.
            *   Remove it from the start of the buffer (`transcriptionBuffer = transcriptionBuffer.substring(sentence.length).trim();`).
            *   Return the extracted sentence.
        *   Repeat until no more complete sentences are found at the start of the buffer.
*   [ ] **3.2. Translation Cache:**
    *   [ ] Create a simple in-memory cache using a `Map` object in the backend (e.g., `const translationCache = new Map();`).
*   [ ] **3.3. Concurrent Translation Orchestration:**
    *   [ ] Define target languages: `const targetLangs = ['ES', 'ZH', 'MY'];`.
    *   [ ] When a full sentence is extracted by the `sentenceProcessor`:
        *   Create an array of Promises for translation tasks.
        *   For each `lang` in `targetLangs`:
            *   Generate cache key: `const cacheKey = sentence + '_' + lang;`
            *   Check if `translationCache.has(cacheKey)`.
            *   If cached, add `Promise.resolve({ lang, text: translationCache.get(cacheKey) })` to the promises array.
            *   If not cached, add `deeplService.translateSentence(sentence, lang).then(text => ({ lang, text })).catch(error => ({ lang, error: true, message: error.message }))` to the promises array.
        *   Use `Promise.all(promisesArray)` to run translations concurrently.
        *   Once `Promise.all` resolves:
            *   Process results: Build a `translations` object `{ ES: '...', ZH: '...', MY: '...' }`. Handle potential errors for individual languages.
            *   Cache successful results: Iterate through results, if no error, `translationCache.set(sentence + '_' + result.lang, result.text)`.
            *   Construct the final message object: `{ original: sentence, translations: translationsObject }`.
*   [ ] **3.4. Update WebSocket Broadcast:**
    *   [ ] Modify the WebSocket message handler: Instead of just logging transcription, feed it to the `sentenceProcessor`.
    *   [ ] When the `sentenceProcessor` yields a sentence, trigger the translation orchestration (3.3).
    *   [ ] Send the final message object (`{ original, translations }`) back to the originating client via `ws.send(JSON.stringify(messageObject))`.
*   [ ] **3.5. Explicit Error Handling:**
    *   [ ] Ensure Whisper/DeepL service errors are caught.
    *   [ ] Send specific error messages back via WebSocket (e.g., `ws.send(JSON.stringify({ error: true, type: 'DeepL', message: 'Quota exceeded' }))`).

## Phase 4: Frontend Display & Controls

*   [ ] **4.1. State Management Refinement:**
    *   [ ] Define state shape in context/Zustand:
        *   `sentences: [{ id: number, original: string, translations: { ES: string, ZH: string, MY: string } }]`
        *   `visibleLanguages: ['EN', 'ES', 'ZH', 'MY']` (or similar)
        *   `layout: 'vertical' | 'horizontal'`
        *   `errorMessages: []`
        *   `isRecording: boolean`
        *   `isConnected: boolean`
    *   [ ] Update WebSocket `onmessage` handler to parse JSON. If it's a sentence object, add it to the `sentences` array. If it's an error object, add it to `errorMessages`.
*   [ ] **4.2. Update `TranscriptionDisplay` Component:**
    *   [ ] Receive `sentences`, `visibleLanguages`, and `layout` from state.
    *   [ ] Map over the `sentences` array.
    *   [ ] For each sentence object, conditionally render language lines based on `visibleLanguages`.
        *   Always show `EN: {sentence.original}` if 'EN' is visible.
        *   Show `ES: {sentence.translations.ES}` if 'ES' is visible and translation exists.
        *   Repeat for ZH, MY.
    *   [ ] Apply CSS classes based on the `layout` state (`display-vertical` or `display-horizontal`).
    *   [ ] Add CSS rules for `.display-vertical` (e.g., `display: block` for language lines) and `.display-horizontal` (e.g., `display: inline-block` or `flexbox`).
*   [ ] **4.3. Implement Smooth Scrolling:**
    *   [ ] In `TranscriptionDisplay`, get a ref to the scrollable container element.
    *   [ ] Use a `useEffect` hook that triggers when the `sentences` array changes.
    *   [ ] Inside the effect, set `scrollableContainerRef.current.scrollTop = scrollableContainerRef.current.scrollHeight;`.
*   [ ] **4.4. Update `Controls` Component:**
    *   [ ] Add checkboxes for EN, ES, ZH, MY. Link their `checked` state to `visibleLanguages` in global state and their `onChange` handler to update that state.
    *   [ ] Add a button or toggle switch for Layout (Vertical/Horizontal). Link its state/onChange to the `layout` property in global state.
*   [ ] **4.5. Error Display:**
    *   [ ] Create an `ErrorDisplay` component or section in `App.js`.
    *   [ ] Receive `errorMessages` from state.
    *   [ ] Render the list of error messages clearly.
*   [ ] **4.6. Integration & Testing:**
    *   [ ] Connect all state updates and props correctly.
    *   [ ] **Test:**
        *   Start backend & frontend.
        *   Start recording, speak clearly.
        *   Verify English appears, followed by ES, ZH, MY translations.
        *   Verify smooth scrolling.
        *   Test language visibility checkboxes.
        *   Test layout switch.
        *   Test stopping and restarting recording.
        *   Try to trigger errors (e.g., stop backend while frontend records) and check error display.
        *   Check DeepL free tier usage if possible.

## Phase 5: Refinement & Cleanup

*   [ ] **5.1. Code Cleanup:** Review code for clarity, consistency, remove unused variables/logs.
*   [ ] **5.2. Styling:** Add basic CSS for better readability and layout.
*   [ ] **5.3. Final Testing:** Perform thorough testing of all features.
