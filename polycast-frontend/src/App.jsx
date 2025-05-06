import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types'; // Add PropTypes import
import useWebSocket, { ReadyState } from 'react-use-websocket';
import './App.css'

// Import planned components (will be created next)
import AudioRecorder from './components/AudioRecorder';
import Controls from './components/Controls';
import TranscriptionDisplay from './components/TranscriptionDisplay';
import DictionaryTable from './components/DictionaryTable';
import FlashcardMode from './components/FlashcardMode';

// App now receives an array of target languages as a prop
function App({ targetLanguages, onReset }) {
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
  const [showLiveTranscript, setShowLiveTranscript] = useState(true); 
  const [showTranslation, setShowTranslation] = useState(true); 
  const [appMode, setAppMode] = useState('audio'); // Options: 'audio', 'text', 'dictionary', 'flashcard'
  const [selectedWords, setSelectedWords] = useState([]); // Selected words for dictionary
  const [wordDefinitions, setWordDefinitions] = useState({}); // Cache for word definitions
  const [modeError, setModeError] = useState(null);
  const [textInputs, setTextInputs] = useState({}); // Lifted state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOpacity, setNotificationOpacity] = useState(1);
  const [autoSend, setAutoSend] = useState(true); // Controls auto-sending of audio chunks
  const [showNoiseLevel, setShowNoiseLevel] = useState(false); // Controls visibility of noise level display
  const notificationTimeoutRef = useRef(null);
  const modeRef = useRef(appMode === 'text');
  const isRecordingRef = useRef(isRecording); // Ref to track recording state in handlers

  // Ensure mutual exclusivity between transcript and translation checkboxes
  useEffect(() => {
    if (!showLiveTranscript && !showTranslation) {
      setShowTranslation(true);
    }
  }, [showLiveTranscript, showTranslation]);

  // === Iguana Image State ===
  // const [iguanaImageUrl, setIguanaImageUrl] = useState(null);
  // const [iguanaLoading, setIguanaLoading] = useState(false);
  // useEffect(() => {
  //   if (appMode === 'audio') {
  //     console.log('Audio mode detected - fetching iguana image');
  //     setIguanaLoading(true);
      
  //     // Debug logging
  //     fetch('https://polycast-server.onrender.com/api/generate-image?prompt=A big, realistic photo of an iguana, natural background, standard quality, photorealistic', { 
  //       cache: 'no-cache',
  //       mode: 'cors'
  //     })
  //       .then(res => {
  //         console.log('Image API Response status:', res.status);
  //         if (!res.ok) throw new Error(`Failed with status: ${res.status}`);
  //         return res.json();
  //       })
  //       .then(data => {
  //         console.log('Image data received:', data);
  //         setIguanaImageUrl(data.url);
  //       })
  //       .catch(err => {
  //         console.error('Error fetching iguana image:', err);
  //         setIguanaImageUrl(null);
  //       })
  //       .finally(() => setIguanaLoading(false));
  //   } else {
  //     setIguanaImageUrl(null);
  //   }
  // }, [appMode]);

  // Update refs when state changes
  useEffect(() => { modeRef.current = appMode === 'text'; }, [appMode]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // --- FIX: Only listen for spacebar in audio mode ---
  useEffect(() => {
    let spacebarPressed = false;
    if (appMode !== 'audio') return; // Only add listeners in audio mode

    const handleKeyDown = (event) => {
      if (event.code === 'Space' && !isRecordingRef.current && !spacebarPressed) {
        event.preventDefault();
        spacebarPressed = true;
        setIsRecording(true);
      }
    };
    const handleKeyUp = (event) => {
      if (event.code === 'Space' && isRecordingRef.current) {
        event.preventDefault();
        spacebarPressed = false;
        setIsRecording(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [appMode]);

  // Add Page Up/Page Down recording hotkeys
  useEffect(() => {
    function handlePageKey(e) {
      if (e.repeat) return; // Prevent holding key from triggering repeatedly
      if (e.key === "PageUp") {
        e.preventDefault();
        handleStartRecording && handleStartRecording();
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        handleStopRecording && handleStopRecording();
      }
    }
    window.addEventListener("keydown", handlePageKey);
    return () => window.removeEventListener("keydown", handlePageKey);
  }, []);

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
      // Only update appMode if not currently in dictionary or flashcard mode
      setAppMode(current => (
        current === 'dictionary' || current === 'flashcard'
          ? current
          : (data.isTextMode ? 'text' : 'audio')
      ));
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
    
    // For dictionary mode, we just update the local state without backend call
    if (value === 'dictionary') {
      setAppMode('dictionary');
      return;
    }
    
    setAppMode(value === 'text' ? 'text' : 'audio'); // Optimistically update UI
    setModeError(null);

    // Clear text inputs when switching from text to audio mode
    if (value !== 'text' && previousMode) { 
      setTextInputs({});
    }

    try {
      const res = await fetch(`${BACKEND_HTTP_BASE}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTextMode: value === 'text' })
      });
      const debugInfo = {
        url: res.url,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        requestBody: { isTextMode: value === 'text' },
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
      setAppMode(data.isTextMode ? 'text' : 'audio');
      modeRef.current = data.isTextMode;
    } catch (err) {
      setModeError(`Could not update mode: ${err && err.message ? err.message : err}. Debug: ${JSON.stringify({
        mode: 'updateMode',
        error: err && err.stack ? err.stack : err,
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
        backendUrl: `${BACKEND_HTTP_BASE}/mode`,
        requestBody: { isTextMode: value === 'text' }
      })}`);
      setAppMode(previousMode ? 'text' : 'audio'); // Revert UI if error
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

  // --- FIX: Prevent text submission error in text mode ---
  // (No code needed here, but ensure isTextMode is derived from appMode === 'text')

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
           if (showLiveTranscript) {
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
            // Only keep the most recent 3 segments
            const updatedSegments = [
              ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
              { text: parsedData.data, isNew: true }
            ];
            newTranslations[lang] = updatedSegments.slice(-3);
            return newTranslations;
          });
          // Update textInputs in text mode
          if (appMode === 'text') {
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
                const currentLangSegments = newTranslations[lang] || [];
                const updatedSegments = [
                  ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
                  { text: parsedData.data[lang], isNew: true }
                ];
                newTranslations[lang] = updatedSegments.slice(-3);
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
  }, [lastMessage, showLiveTranscript]); // Update dependency array

  // Listen for toggleLiveTranscript event from Controls
  useEffect(() => {
    function handler(e) { setShowLiveTranscript(!!e.detail); }
    window.addEventListener('toggleLiveTranscript', handler);
    return () => window.removeEventListener('toggleLiveTranscript', handler);
  }, []);

  // Provide a global getter for Controls to read the toggle state
  useEffect(() => {
    window.showLiveTranscript = () => showLiveTranscript;
    return () => { delete window.showLiveTranscript; };
  }, [showLiveTranscript]);

  // Handlers for recording controls (passed down to components that need to send audio)
  const handleStartRecording = useCallback(() => {
    console.log('APP: Start Recording');
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

  const setIsTextMode = useCallback((value) => {
    setAppMode(value ? 'text' : 'audio');
  }, []);

  // Handle app mode changes from dropdown menu
  const handleAppModeChange = useCallback((newMode) => {
    if (newMode === 'dictionary') {
      // Just update local state for dictionary mode
      setAppMode('dictionary');
    } else if (newMode === 'flashcard') {
      // Just update local state for flashcard mode
      setAppMode('flashcard');
    } else {
      // Call updateMode for audio/text modes to sync with backend
      updateMode(newMode);
    }
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
      {/* Remove the iguana overlay for audio mode 
      {appMode === 'audio' && (
        <div className="iguana-debug" style={{
          position: 'fixed',
          zIndex: 999,
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          pointerEvents: 'none'
        }}>
          {iguanaLoading ? 'Loading iguana...' : (iguanaImageUrl ? 'Iguana loaded!' : 'Failed to load iguana')}
        </div>
      )}
      {appMode === 'audio' && iguanaImageUrl && (
        <div className="iguana-bg" style={{
          backgroundImage: `url(${iguanaImageUrl})`,
          position: 'fixed',
          zIndex: 1,
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.93,
          transition: 'opacity 0.6s',
          pointerEvents: 'none',
        }} />
      )} */}
      {/* Big Polycast Title */}
      <h1
        className="polycast-title"
        style={{
          color: '#fff',
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '0.06em',
          textAlign: 'center',
          margin: '24px 0 12px 0',
          textShadow: '0 4px 24px #0008',
          cursor: 'pointer', // Show pointer
          transition: 'opacity 0.2s',
        }}
        onClick={() => typeof onReset === 'function' && onReset()}
        onMouseOver={e => (e.currentTarget.style.opacity = 0.85)}
        onMouseOut={e => (e.currentTarget.style.opacity = 1)}
      >
        Polycast
      </h1>
      <div className="controls-container" style={{ marginBottom: 4 }}>
        {/* Main Toolbar */}
        <div className="main-toolbar" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginBottom: 0 }}>
          {/* Absolutely positioned Recording indicator in circled space */}
          {appMode !== 'text' && isRecording && (
            <div style={{
              position: 'absolute',
              top: 100,
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#ff5733',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              textShadow: '0 1px 3px #fff',
              pointerEvents: 'none',
              letterSpacing: 0.2,
              opacity: 0.98,
              zIndex: 2,
            }}>
              Recording...
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Pass sendMessage down to components that need to send audio */}
            {appMode === 'audio' && (
              <AudioRecorder
                sendMessage={sendMessage}
                isRecording={isRecording}
                onAudioSent={onAudioSent}
                autoSend={autoSend}
                showNoiseLevel={showNoiseLevel}
              />
            )}
            <Controls
              readyState={readyState}
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              isTextMode={appMode === 'text'}
              setIsTextMode={setIsTextMode}
              appMode={appMode}
              setAppMode={handleAppModeChange}
              autoSend={autoSend}
              setAutoSend={setAutoSend}
              showNoiseLevel={showNoiseLevel}
              setShowNoiseLevel={setShowNoiseLevel}
              showLiveTranscript={showLiveTranscript}
              setShowLiveTranscript={checked => {
                setShowLiveTranscript(checked);
                if (!checked && !showTranslation) setShowTranslation(true);
              }}
              showTranslation={showTranslation}
              setShowTranslation={checked => {
                setShowTranslation(checked);
                if (!checked && !showLiveTranscript) setShowLiveTranscript(true);
              }}
            />
          </div>
          {/* Audio mode note below tools row */}
          {appMode === 'audio' && (
            <div style={{
              marginTop: -45,
              marginBottom: 0,
              width: '100%',
              textAlign: 'center',
              color: '#ffb84d',
              fontWeight: 600,
              fontSize: '1.05rem',
              letterSpacing: 0.1,
              textShadow: '0 1px 2px #2228',
              opacity: 0.96,
              userSelect: 'none',
            }}>
              Hold Spacebar to record.  Release Spacebar to send.
            </div>
          )}
        </div>
      </div>
      {/* Remove the floating Recording indicator entirely */}
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
      {/* Notification Pop-up */} 
      {showNotification && (
        <div 
          className="notification-popup" 
          style={{ opacity: notificationOpacity }}
        >
          Audio sent for transcription
        </div>
      )}
      <div className="display-container">
        {appMode === 'dictionary' ? (
          <DictionaryTable 
            selectedWords={selectedWords}
            englishSegments={englishSegments}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
          />
        ) : appMode === 'flashcard' ? (
          <FlashcardMode 
            selectedWords={selectedWords}
            wordDefinitions={wordDefinitions}
            englishSegments={englishSegments}
          />
        ) : (
          <TranscriptionDisplay 
            englishSegments={englishSegments} 
            translations={translations} 
            targetLanguages={targetLanguages} 
            showLiveTranscript={showLiveTranscript}
            showTranslation={showTranslation}
            isTextMode={appMode === 'text'}
            onTextSubmit={(lang, text) => {
              // Send text submission for translation to backend
              sendMessage(JSON.stringify({ type: 'text_submit', lang, text }));
            }}
            textInputs={textInputs}
            setTextInputs={setTextInputs}
            selectedWords={selectedWords}
            setSelectedWords={setSelectedWords}
            wordDefinitions={wordDefinitions}
            setWordDefinitions={setWordDefinitions}
          />
        )}
      </div>
    </div>
  )
}

// Update PropTypes
App.propTypes = {
    targetLanguages: PropTypes.arrayOf(PropTypes.string).isRequired,
    onReset: PropTypes.func,
};

// Define backend port in a config object or hardcode if simple
const config = {
    backendPort: 8080
};

export default App
