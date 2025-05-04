import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types'; // Add PropTypes import
import useWebSocket, { ReadyState } from 'react-use-websocket';
import './App.css'

// Import planned components (will be created next)
import AudioRecorder from './components/AudioRecorder';
import Controls from './components/Controls';
import TranscriptionDisplay from './components/TranscriptionDisplay';

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
  const [showLiveEnglish, setShowLiveEnglish] = useState(true); // State for toggle
  const [mode, setMode] = useState('audio'); // Use a single 'mode' state: 'audio', 'text', or 'dictionary'
  const [modeError, setModeError] = useState(null);
  const [textInputs, setTextInputs] = useState({}); // Lifted state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationOpacity, setNotificationOpacity] = useState(1);
  const notificationTimeoutRef = useRef(null);
  const isRecordingRef = useRef(isRecording); // Ref to track recording state in handlers

  // Update refs when state changes
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

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
      setMode(data.mode);
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
    setMode(value); // Optimistically update UI
    setModeError(null);

    // Clear text inputs when switching from text to audio mode
    if (value === 'audio') { 
      setTextInputs({});
    }

    try {
      const res = await fetch(`${BACKEND_HTTP_BASE}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: value })
      });
      const debugInfo = {
        url: res.url,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        requestBody: { mode: value },
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
      setMode(data.mode);
    } catch (err) {
      setModeError(`Could not update mode: ${err && err.message ? err.message : err}. Debug: ${JSON.stringify({
        mode: 'updateMode',
        error: err && err.stack ? err.stack : err,
        frontendLocation: window.location.href,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
        backendUrl: `${BACKEND_HTTP_BASE}/mode`,
        requestBody: { mode: value }
      })}`);
      setMode('audio'); // Revert UI if error
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
      if (event.code === 'Space' && mode !== 'text' && !isRecordingRef.current && !spacebarPressed) {
        event.preventDefault(); // Prevent scrolling
        spacebarPressed = true;
        console.log("Spacebar DOWN - Starting recording");
        setIsRecording(true);
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === 'Space' && mode !== 'text' && isRecordingRef.current) {
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
            // Only keep the most recent 3 segments
            const updatedSegments = [
              ...currentLangSegments.map(seg => ({ ...seg, isNew: false })),
              { text: parsedData.data, isNew: true }
            ];
            newTranslations[lang] = updatedSegments.slice(-3);
            return newTranslations;
          });
          // Update textInputs in text mode
          if (mode === 'text') {
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
  const handleSetMode = useCallback((value) => {
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

  // Get selectedWords from sessionStorage and pass to dictionary table
  const [selectedWords, setSelectedWords] = useState([]);

  // Sync selectedWords with sessionStorage, and listen for changes from TranscriptionDisplay
  useEffect(() => {
    const saved = sessionStorage.getItem('polycast_selected_words');
    if (saved) {
      try {
        setSelectedWords(JSON.parse(saved));
      } catch {}
    }
    // Listen for changes from other tabs/windows (shouldn't matter much for sessionStorage, but for robustness)
    const handleStorage = () => {
      const updated = sessionStorage.getItem('polycast_selected_words');
      if (updated) setSelectedWords(JSON.parse(updated));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  useEffect(() => {
    sessionStorage.setItem('polycast_selected_words', JSON.stringify(selectedWords));
  }, [selectedWords]);

  // Only show flagged words in dictionary mode
  const flaggedWordSet = new Set(selectedWords.map(w => w.toLowerCase()));
  const wordToSentences = {};
  englishSegments.forEach(seg => {
    const tokens = seg.text.match(/([\p{L}\p{M}\d']+|[.,!?;:]+|\s+)/gu) || [];
    tokens.forEach(token => {
      if (/^[\p{L}\p{M}\d']+$/u.test(token) && flaggedWordSet.has(token.toLowerCase())) {
        const key = token.toLowerCase();
        if (!wordToSentences[key]) wordToSentences[key] = [];
        if (!wordToSentences[key].includes(seg.text)) wordToSentences[key].push(seg.text);
      }
    });
  });
  const uniqueWords = selectedWords.filter((w, i, arr) => arr.findIndex(x => x.toLowerCase() === w.toLowerCase()) === i);

  // Render Table in Dictionary Mode
  const renderDictionaryTable = () => (
    <div style={{ width: '100%', marginTop: 32, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#23233a', color: '#fff' }}>
        <thead>
          <tr>
            <th style={{ padding: 8, borderBottom: '2px solid #444', fontWeight: 700 }}>Word</th>
            <th style={{ padding: 8, borderBottom: '2px solid #444', fontWeight: 700 }}>Spanish Definition</th>
            <th style={{ padding: 8, borderBottom: '2px solid #444', fontWeight: 700 }}>Sentence Used In</th>
          </tr>
        </thead>
        <tbody>
          {uniqueWords.map(word => (
            <tr key={word}>
              <td style={{ padding: 8, borderBottom: '1px solid #333', fontWeight: 600 }}>{word}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #333' }}>{/* TODO: Fetch and display definition */}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #333' }}>{(wordToSentences[word.toLowerCase()]||[])[0]||''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="App">
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
          {mode !== 'text' && isRecording && (
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
            <AudioRecorder
              sendMessage={sendMessage}
              isRecording={isRecording}
              onAudioSent={onAudioSent}
            />
            <Controls
              readyState={readyState}
              isRecording={isRecording}
              mode={mode}
              setMode={handleSetMode}
              // ...other props
            />
          </div>
          {/* Audio mode note below tools row */}
          {mode !== 'text' && (
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
        {mode === 'dictionary' ? renderDictionaryTable() : (
          <TranscriptionDisplay 
            englishSegments={englishSegments} 
            translations={translations} 
            targetLanguages={targetLanguages} 
            showLiveEnglish={showLiveEnglish} // Pass toggle state
            isTextMode={mode === 'text'}
            onTextSubmit={(lang, text) => {
              // Send text submission for translation to backend
              sendMessage(JSON.stringify({ type: 'text_submit', lang, text }));
            }}
            textInputs={textInputs}
            setTextInputs={setTextInputs}
            selectedWords={selectedWords}
            setSelectedWords={setSelectedWords}
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
