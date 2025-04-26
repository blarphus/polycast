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

  // Determine WebSocket URL dynamically
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use the same hostname the page is served from
  // ngrok maps the public hostname to your local machine
  const wsHost = window.location.hostname; 
  // Backend runs on port 8080, but ngrok usually maps standard ports (80/443)
  // Let's try connecting to the standard port via ngrok, assuming it maps correctly.
  // If the backend is exposed directly on a different port by ngrok, this needs adjustment.
  // For simplicity when ngrok maps http 8080 -> https public_host:443:
  const wsPort = (wsProtocol === 'wss:' && window.location.port === '') ? '' : `:${config.backendPort || 8080}`; // Use backend port only if not standard https

  // Construct URL - Use standard ports implicitly if using ngrok's https URL
  let wsBaseUrl = `${wsProtocol}//${wsHost}`;
  if (wsHost === 'localhost') {
      // Explicitly add port for local development
      wsBaseUrl += `:${config.backendPort || 8080}`;
  }
  // Add query params
  const socketUrl = `${wsBaseUrl}/?targetLangs=${languagesQueryParam}`;
  console.log("Constructed WebSocket URL:", socketUrl);

  const [messageHistory, setMessageHistory] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [englishSegments, setEnglishSegments] = useState([]); 
  const [translations, setTranslations] = useState({}); // Structure: { lang: [{ text: string, isNew: boolean }] }
  const [errorMessages, setErrorMessages] = useState([]); 
  const [showLiveEnglish, setShowLiveEnglish] = useState(true); // State for toggle
  const [isTextMode, setIsTextMode] = useState(false);
  const [modeError, setModeError] = useState(null);
  const modeRef = useRef(isTextMode);

  // Fetch mode from backend
  const fetchMode = useCallback(async () => {
    try {
      const res = await fetch('/mode');
      const data = await res.json();
      setIsTextMode(data.isTextMode);
      modeRef.current = data.isTextMode;
    } catch (err) {
      console.error('Failed to fetch mode:', err);
    }
  }, []);

  // Update mode on backend
  const updateMode = useCallback(async (value) => {
    setIsTextMode(value); // Optimistically update UI
    setModeError(null);
    try {
      const res = await fetch('/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTextMode: value })
      });
      if (!res.ok) throw new Error('Failed to update mode: ' + res.status);
      const data = await res.json();
      setIsTextMode(data.isTextMode);
      modeRef.current = data.isTextMode;
    } catch (err) {
      setModeError('Could not update mode: ' + err.message);
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

  // Handlers for recording controls (passed down to Controls)
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

  return (
    <div className="App">
      {/* Unified Toolbar/Header */}
      <header className="main-toolbar">
        <div className="toolbar-left">
          <img src="/logo192.png" alt="Polycast Logo" style={{ height: 44, marginRight: 14, verticalAlign: 'middle' }} />
          <span className="app-title">Polycast v0.1</span>
        </div>
        <div className="toolbar-center">
          <span className="toolbar-label">Target Languages:</span> {targetLanguages.join(', ')}
          <span className="toolbar-label" style={{ marginLeft: 18 }}>Connection:</span> {connectionStatus}
          <span className="toolbar-label" style={{ marginLeft: 18 }}>isTextMode:</span> <b>{String(isTextMode)}</b>
          <span className="toolbar-label" style={{ marginLeft: 18 }}>Mode:</span>
          <select
            value={isTextMode ? 'text' : 'audio'}
            onChange={e => handleSetIsTextMode(e.target.value === 'text')}
            style={{ minWidth: 90, fontSize: 15, padding: '2px 6px', borderRadius: 6, marginLeft: 4 }}
          >
            <option value="text">text mode</option>
            <option value="audio">audio mode</option>
          </select>
        </div>
      </header>
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
      <div style={{ marginTop: 24 }}>
        <div className="controls-container">
          {/* Pass sendMessage down to components that need to send audio */}
          <AudioRecorder
            sendMessage={sendMessage}
            isRecording={isRecording}
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
        <div className="display-container">
          <TranscriptionDisplay 
            englishSegments={englishSegments} 
            translations={translations} 
            targetLanguages={targetLanguages} 
            showLiveEnglish={showLiveEnglish} // Pass toggle state
          />
        </div>
      </div>
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
