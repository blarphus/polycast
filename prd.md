# Product Requirements Document: Polycast (v0.1 - Local Dev)

**Document Status:** Draft
**Version:** 0.1
**Date:** 2023-10-27
**Author:** AI Assistant (based on user input)

## 1. Introduction & Overview

Polycast (v0.1) is a browser-based web application designed for **local, personal use** by the developer. Its purpose is to capture live microphone audio (English), transcribe it in near real-time using OpenAI Whisper, segment the transcription into sentences, translate those sentences into a predefined set of languages using the DeepL API (Free Tier), and display the original English sentence alongside its translations on the screen. Updates should appear sentence-by-sentence with smooth scrolling.

This version explicitly prioritizes core functionality and developer debugging capabilities over deployment, multi-user features, security hardening, or advanced UI/UX elements.

## 2. Goals

*   Successfully capture microphone audio within the browser.
*   Stream audio chunks via WebSocket to a local backend server.
*   Transcribe received English audio chunks using the OpenAI Whisper API.
*   Buffer transcription results and segment them into complete sentences based on punctuation.
*   Translate each complete English sentence into Spanish (ES), Chinese (ZH), and Burmese (MY) using the DeepL API (Free Tier).
*   Display the original English sentence and its corresponding ES, ZH, and MY translations dynamically on the frontend.
*   Implement smooth scrolling for the display area.
*   Provide basic UI controls for starting/stopping recording, toggling language visibility, and switching display layout.
*   Ensure clear and explicit error reporting for debugging purposes.
*   Run entirely on the developer's local machine (frontend + backend).

## 3. Target Audience & User Profile

*   **Primary User:** The developer of the application.
*   **Environment:** Local development machine (Desktop/Laptop).
*   **Use Case:** Personal testing and experimentation with real-time transcription/translation workflow.

## 4. Core Features

### 4.1. Live Audio Capture
*   **Requirement:** The application must request and obtain microphone access using `navigator.mediaDevices.getUserMedia`.
*   **Requirement:** Use the `MediaRecorder` API to capture audio when recording is active.
*   **Requirement:** Provide basic visual feedback indicating whether recording is active or stopped.

### 4.2. Audio Chunking & Streaming
*   **Requirement:** Segment the captured audio into chunks (approx. 5-8 seconds duration).
*   **Requirement:** Send each audio chunk (as a Blob) via a WebSocket connection to the local backend server (`ws://localhost:PORT`).

### 4.3. Backend Orchestration (Local)
*   **Requirement:** A local backend server (Node.js/Express) must listen for WebSocket connections originating from `localhost`.
*   **Requirement:** The backend must receive audio chunks via WebSocket.
*   **Requirement:** The backend must call the OpenAI Whisper API with the received audio data to get transcriptions. Assume English source language.
*   **Requirement:** API keys (`OPENAI_API_KEY`, `DEEPL_AUTH_KEY`) must be loaded securely from a local `.env` file.

### 4.4. Sentence Segmentation
*   **Requirement:** The backend must buffer text fragments received from the Whisper API.
*   **Requirement:** Implement logic to detect sentence boundaries primarily based on terminal punctuation (`.`, `?`, `!`) followed by whitespace or end-of-string.
*   **Requirement:** Only *complete* sentences should be passed to the translation service.

### 4.5. Multi-Language Translation (DeepL)
*   **Requirement:** Use the DeepL API (Free Tier) for translation.
*   **Requirement:** The source language is fixed as English (`EN`).
*   **Requirement:** Translate each identified English sentence into the following target languages:
    *   Spanish (`ES`)
    *   Chinese (`ZH`) - Simplified assumed unless specified otherwise by DeepL default.
    *   Burmese (`MY`)
*   ***Note:*** *Amharic (`AM`) is NOT supported by the DeepL API (Free or Pro) at this time and is excluded.*
*   **Requirement:** Since DeepL requires separate API calls per target language, the backend must make concurrent requests for ES, ZH, and MY for each source sentence.
*   **Requirement:** Implement a simple in-memory cache on the backend to store translations (`key: sourceSentence_targetLang`, `value: translatedText`) for the duration of the session to minimize redundant DeepL API calls and conserve free tier quota.

### 4.6. Real-time Display
*   **Requirement:** The frontend must receive messages via WebSocket containing the original sentence and its translations (e.g., `{ original: '...', translations: { 'ES': '...', 'ZH': '...', 'MY': '...' } }`).
*   **Requirement:** Append each new sentence block (original + translations) to the main display area.
*   **Requirement:** Implement **smooth scrolling**: the display area must automatically scroll down to ensure the latest sentence block is visible.
*   **Requirement:** Provide a UI control to toggle the display layout between:
    *   **Vertical:** Languages stacked (EN, ES, ZH, MY one below the other).
    *   **Horizontal:** Languages side-by-side (wrapping as needed).

### 4.7. Language Selection Control
*   **Requirement:** Provide UI controls (e.g., checkboxes) to allow the user to toggle the visibility of each language stream independently:
    *   English (Original)
    *   Spanish (ES)
    *   Chinese (ZH)
    *   Burmese (MY)
*   **Requirement:** All languages should be visible by default.

## 5. User Interface (UI) / User Experience (UX)

*   **Layout:** Simple, functional layout suitable for desktop browser viewing.
*   **Main Display:** A clear, readable area showing the scrolling transcript/translations with language labels (EN:, ES:, etc.).
*   **Controls:** A dedicated panel for:
    *   Start/Stop Recording button.
    *   Language visibility toggles (EN, ES, ZH, MY).
    *   Layout switch (Vertical/Horizontal).
*   **Feedback:** Basic visual cues for recording status. Crucially, provide a dedicated area or mechanism (e.g., console logs, on-screen text area) for displaying **explicit and detailed error messages**.
*   **Interaction:** Smooth scrolling should be the default and only behavior for new content updates.

## 6. Technical Specifications

*   **Frontend:**
    *   Framework: React
    *   State Management: React Context API or Zustand
    *   Real-time: Native Browser WebSocket API
    *   Target Environment: Local development server (`npm start`)
*   **Backend:**
    *   Framework: Node.js with Express
    *   Real-time: `ws` library
    *   API Clients: `axios`/`node-fetch`, `deepl-node` library recommended.
    *   Target Environment: Local Node.js process (`node server.js` or `npm start`)
*   **APIs:**
    *   Transcription: OpenAI Whisper API
    *   Translation: DeepL API (Free Tier)

## 7. Error Handling & Debugging

*   **Requirement:** Errors related to microphone access must be clearly reported to the user/developer console.
*   **Requirement:** WebSocket connection errors (connection failure, unexpected disconnection) must be reported.
*   **Requirement:** Errors from the Whisper API (e.g., invalid request, API key issue, server error) must be caught by the backend and relayed explicitly to the frontend/console.
*   **Requirement:** Errors from the DeepL API (e.g., authentication failure, quota exceeded, invalid language code, server error) must be caught by the backend and relayed explicitly to the frontend/console.
*   **Requirement:** Any backend processing errors (e.g., audio conversion if added, sentence segmentation issues) should be logged clearly.
*   **Goal:** The developer should be able to easily diagnose issues originating from any part of the system by observing frontend error displays and backend console logs.

## 8. Excluded Features (for v0.1)

*   Deployment to cloud platforms (Vercel, Netlify, Render, Fly.io)
*   QR Code generation or sharing features
*   Remote viewing / Multiple simultaneous users / Session management
*   Transcript export functionality
*   User accounts or authentication
*   Data persistence across browser refreshes or sessions (`localStorage`)
*   Mobile responsiveness or mobile-specific UI
*   Advanced security hardening (beyond basic API key handling via `.env`)
*   Source language detection or selection (fixed to English)
*   Amharic translation
*   Fade-in display effect option
*   Advanced sentence boundary detection beyond basic punctuation.

## 9. Future Considerations (Post v0.1)

*   Investigate alternative translation services if Amharic support is critical.
*   Implement robust session management and persistence.
*   Add deployment configurations.
*   Implement QR code sharing for viewers.
*   Refine sentence boundary detection logic.
*   Add transcript export.
