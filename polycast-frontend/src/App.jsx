import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types'; // Add PropTypes import
import useWebSocket, { ReadyState } from 'react-use-websocket';
import './App.css'

// Import planned components (will be created next)
import AudioRecorder from './components/AudioRecorder';
import Controls from './components/Controls';
import TranscriptionDisplay from './components/TranscriptionDisplay';

// App now receives an array of target languages as a prop
function App({ targetLanguages }) {
  const languagesQueryParam = targetLanguages.map(encodeURIComponent).join(',');

  // Construct the WebSocket URL for Render backend
  const wsBaseUrl = `wss://polycast-server.onrender.com`;
  const socketUrl = `${wsBaseUrl}/?targetLangs=${languagesQueryParam}`;
  console.log("Constructed WebSocket URL:", socketUrl);

  const [messageHistory, setMessageHistory] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [englishSegments, setEnglishSegments] = useState([]); 
  const [translations, setTranslations] = useState({}); // Structure: { lang: [{ text: string, isNew: boolean }] }
  const [errorMessages, setErrorMessages] = useState([]); 
  const [showLiveEnglish, setShowLiveEnglish] = useState(true); // State for toggle
  const [isTextMode, setIsTextMode] = useState(false); // Default to audio mode
  const [modeError, setModeError] = useState(null);
  const [textInputs, setTextInputs] = useState({}); // Lifted state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOpacity, setNotificationOpacity] = useState(1);
  const notificationTimeoutRef = useRef(null);
  const modeRef = useRef(isTextMode);
  const isRecordingRef = useRef(isRecording); // Ref to track recording state in handlers

  // Update refs when state changes
  useEffect(() => { modeRef.current = isTextMode; }, [isTextMode]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Backend base URL for /mode endpoints
  const BACKEND_HTTP_BASE = 'https://polycast-server.onrender.com';

  // Fetch mode from backend
  const fetchMode = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP_BASE}/mode`);
      const debugInfo = {
        url: res.url,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        mode: 'fetchMode',
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
      };
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setModeError(`Could not fetch mode: JSON parse error (${jsonErr.message}). Debug: ${JSON.stringify(debugInfo)}`);
        throw jsonErr;
      }
      setIsTextMode(data.isTextMode);
      modeRef.current = data.isTextMode;
    } catch (err) {
      setModeError(`Could not fetch mode: ${err && err.message ? err.message : err}. Debug: ${JSON.stringify({
        mode: 'fetchMode',
        error: err && err.stack ? err.stack : err,
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
        backendUrl: `${BACKEND_HTTP_BASE}/mode`,
      })}`);
      console.error('Failed to fetch mode:', err);
    }
  }, []);

  // Update mode on backend
  const updateMode = useCallback(async (value) => {
    const previousMode = modeRef.current;
    setIsTextMode(value); // Optimistically update UI
    setModeError(null);

    // Clear text inputs when switching from text to audio mode
    if (!value && previousMode) { 
      setTextInputs({});
    }

    try {
      const res = await fetch(`${BACKEND_HTTP_BASE}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTextMode: value })
      });
      const debugInfo = {
        url: res.url,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        requestBody: { isTextMode: value },
        mode: 'updateMode',
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
      };
      if (!res.ok) {
        setModeError(`Could not update mode: HTTP ${res.status} ${res.statusText}. Debug: ${JSON.stringify(debugInfo)}`);
        throw new Error('Failed to update mode: ' + res.status);
      }
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setModeError(`Could not update mode: JSON parse error (${jsonErr.message}). Debug: ${JSON.stringify(debugInfo)}`);
        throw jsonErr;
      }
      setIsTextMode(data.isTextMode);
      modeRef.current = data.isTextMode;
    } catch (err) {
      setModeError(`Could not update mode: ${err && err.message ? err.message : err}. Debug: ${JSON.stringify({
        mode: 'updateMode',
        error: err && err.stack ? err.stack : err,
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
        backendUrl: `${BACKEND_HTTP_BASE}/mode`,
        requestBody: { isTextMode: value }
      })}`);
      setIsTextMode(modeRef.current); // Revert UI if error
      console.error('Failed to update mode:', err);
    }
  }, []);

  // On mount, fetch initial mode
  useEffect(() => { fetchMode(); }, [fetchMode]);

  // Poll mode every 5s to keep in sync
  useEffect(() => {
    const interval = setInterval(fetchMode, 5000);
    return () => clearInterval(interval);
  }, [fetchMode]);

  // Spacebar listener for recording
  useEffect(() => {
    let spacebarPressed = false; // Prevent repeated starts on key hold

    const handleKeyDown = (event) => {
      if (event.code === 'Space' && !modeRef.current && !isRecordingRef.current && !spacebarPressed) {
        event.preventDefault(); // Prevent scrolling
        spacebarPressed = true;
        console.log("Spacebar DOWN - Starting recording");
        setIsRecording(true);
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === 'Space' && !modeRef.current && isRecordingRef.current) {
        event.preventDefault();
        spacebarPressed = false;
        console.log("Spacebar UP - Stopping recording");
        setIsRecording(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Cleanup listeners on component unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    onOpen: () => {
      console.log('WebSocket connection opened with URL:', socketUrl);
      // Initialize translation state with empty arrays for selected languages
      const initialTranslations = {};
      targetLanguages.forEach(lang => { initialTranslations[lang] = []; }); // Init with empty arrays
      setTranslations(initialTranslations);
    },
    onClose: () => console.log('WebSocket connection closed'),
    onError: (event) => {
      console.error('WebSocket error:', event);
      setErrorMessages(prev => [...prev, `WebSocket error: ${event.type}`]);
    },
    // Reconnect automatically if the connection is closed
    shouldReconnect: (closeEvent) => true,
    reconnectInterval: 3000, // Attempt reconnect every 3 seconds
    // Optional: Filter out initial info message if needed
    // filter: (message) => {
    //   try {
    //     const data = JSON.parse(message.data);
    //     return data.type !== 'info'; // Ignore the initial connection message
    //   } catch (e) {
    //     return true; // Keep non-JSON messages
    //   }
    // },
  });

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage !== null) {
      let parsedData;
      try {
        parsedData = JSON.parse(lastMessage.data);
        console.log('Received parsed message:', parsedData);

        // Check message type and update state accordingly
        if (parsedData.type === 'recognized') {
          // Replace any existing interim segment with the final one
          setEnglishSegments(prevSegments => [
            // Find the index of the last segment (which might be an interim one)
            // Keep all segments *except* the last one if it was interim, then add final.
            // OR simpler: just mark all as old and add final.
            ...prevSegments.map(seg => ({ ...seg, isNew: false })),
            { text: parsedData.data, isNew: true }
          ]);
        } else if (parsedData.type === 'recognizing_interim') { 
           // Only update if toggle is on
           if (showLiveEnglish) {
             setEnglishSegments([{ text: parsedData.data, isNew: false }]); 
           }
        } else if (parsedData.type === 'error') {
          console.error('Backend Error:', parsedData.message);
          setErrorMessages(prev => [...prev, `Backend Error: ${parsedData.message}`]);
        } else if (parsedData.type === 'info') {
          console.log('Backend Info:', parsedData.message);
          // Optionally display info messages somewhere
        } else if (parsedData.type === 'translation') {
          // Handle single translation (non-batch)
          setTranslations(prevTranslations => {
            const newTranslations = { ...prevTranslations };
            const lang = parsedData.lang;
            const currentLangSegments = newTranslations[lang] || [];
            newTranslations[lang] = [
              ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
              { text: parsedData.data, isNew: true }
            ];
            return newTranslations;
          });
          // Update textInputs in text mode
          if (isTextMode) {
            setTextInputs(inputs => ({
              ...inputs,
              [parsedData.lang]: parsedData.data
            }));
          }
        } else if (parsedData.type === 'translations_batch') {
          console.log('Received Translation Batch:', parsedData.data);
          // Update multiple translations
          setTranslations(prevTranslations => {
            const newTranslations = { ...prevTranslations };
            for (const lang in parsedData.data) {
              if (parsedData.data.hasOwnProperty(lang)) {
                 // Ensure the language array exists
                 const currentLangSegments = newTranslations[lang] || [];
                 newTranslations[lang] = [
                    // Mark all previous segments as old
                    ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
                    // Add the new segment, marked as new
                    { text: parsedData.data[lang], isNew: true }
                 ];
              }
            }
            return newTranslations;
          });
        } else {
            console.warn('Received unknown message type:', parsedData.type);
        }

      } catch (e) {
        console.error('Failed to parse message or unknown message format:', lastMessage.data);
        // Add raw message to history if parsing fails
        // setMessageHistory((prev) => prev.concat(lastMessage));
      }
    }
  }, [lastMessage, showLiveEnglish]); // Add showLiveEnglish to dependency array

  // Listen for toggleLiveEnglish event from Controls
  useEffect(() => {
    function handler(e) { setShowLiveEnglish(!!e.detail); }
    window.addEventListener('toggleLiveEnglish', handler);
    return () => window.removeEventListener('toggleLiveEnglish', handler);
  }, []);

  // Provide a global getter for Controls to read the toggle state
  useEffect(() => {
    window.showLiveEnglish = () => showLiveEnglish;
    return () => { delete window.showLiveEnglish; };
  }, [showLiveEnglish]);

  // Handlers for recording controls (passed down to components that need to send audio)
  const handleStartRecording = useCallback(() => {
    console.log('APP: Start Recording');
    // Reset states
    setEnglishSegments([]); // Reset to empty array
    const initialTranslations = {};
    targetLanguages.forEach(lang => { initialTranslations[lang] = []; }); // Reset with empty arrays
    setTranslations(initialTranslations);
    setErrorMessages([]); 
    setIsRecording(true);
  }, [targetLanguages]);

  const handleStopRecording = useCallback(() => {
    console.log('APP: Stop Recording');
    setIsRecording(false);
  }, []);

  const onAudioSent = useCallback(() => {
    console.log("Audio chunk sent");
    setShowNotification(true);
    setNotificationOpacity(1); // Ensure it's fully visible initially

    // Clear any existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    // Set new timeout for fade and hide
    notificationTimeoutRef.current = setTimeout(() => {
      setNotificationOpacity(0); // Start fading out
      notificationTimeoutRef.current = setTimeout(() => {
        setShowNotification(false); // Hide after fade
      }, 1000); // Fade duration
    }, 1000); // Initial display duration
  }, []);

  // Pass mode state and update logic to Controls
  const handleSetIsTextMode = useCallback((value) => {
    updateMode(value); // Update backend and local state
  }, [updateMode]);

  // Get connection status string
  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Connected',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Closed',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="App">
      {/* Big Polycast Title */}
      <h1 className="polycast-title" style={{
        color: '#fff',
        fontSize: '3rem',
        fontWeight: 900,
        letterSpacing: '0.06em',
        textAlign: 'center',
        margin: '24px 0 12px 0',
        textShadow: '0 4px 24px #0008',
      }}>
        Polycast
      </h1>
      <div className="controls-container" style={{ marginBottom: 18 }}>
        {/* Pass sendMessage down to components that need to send audio */}
        <AudioRecorder
          sendMessage={sendMessage}
          isRecording={isRecording}
          onAudioSent={onAudioSent}
        />
        <Controls
          readyState={readyState}
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          isTextMode={isTextMode}
          setIsTextMode={handleSetIsTextMode}
        />
      </div>
      {/* Remove the display-container wrapper and use a full-width transcript box */}
      {/* Absolutely position the Recording... indicator so it doesn't push content */}
      <div style={{ position: 'relative', width: '100%' }}>
        {(!isTextMode && isRecording) && (
          <div style={{
            position: 'absolute',
            top: '-36px', // Just below the toolbar
            left: 0,
            width: '100%',
            color: 'red',
            fontWeight: 'bold',
            fontSize: '1.3rem',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            Recording...
          </div>
        )}
        <div style={{
          width: '100vw',
          margin: 0,
          padding: 0,
          background: '#16182a',
          borderRadius: '12px',
          border: '2px solid #2b2e4a',
          boxShadow: '0 2px 16px 0 rgba(0,0,0,0.12)',
          minHeight: 120,
          maxWidth: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}>
          <TranscriptionDisplay
            englishSegments={englishSegments}
            translations={translations}
            targetLanguages={targetLanguages}
            showLiveEnglish={showLiveEnglish}
            isTextMode={isTextMode}
            onTextSubmit={(lang, text) => {
              sendMessage(JSON.stringify({ type: 'text_submit', lang, text }));
            }}
            textInputs={textInputs}
            setTextInputs={setTextInputs}
          />
        </div>
      </div>
      {/* Notification Pop-up */} 
      {showNotification && (
        <div 
          className="notification-popup" 
          style={{ opacity: notificationOpacity }}
        >
          Audio sent for transcription
        </div>
      )}
      {modeError && (
        <div style={{ color: 'red', fontWeight: 500, marginBottom: 8 }}>
          {modeError}
        </div>
      )}
      {errorMessages.length > 0 && (
        <div className="error-display">
          <h3>Errors:</h3>
          <ul>
            {errorMessages.map((err, index) => <li key={index}>{err}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

// Update PropTypes
App.propTypes = {
    targetLanguages: PropTypes.arrayOf(PropTypes.string).isRequired,
};

// Define backend port in a config object or hardcode if simple
const config = {
    backendPort: 8080
};

export default App
