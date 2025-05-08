import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LanguageSelectorScreen from './components/LanguageSelectorScreen.jsx';
import RoomSelectionScreen from './components/RoomSelectionScreen.jsx';
import './index.css'

function Main() {
  const [roomSetup, setRoomSetup] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState(null);

  // Step 1: Room selection
  if (!roomSetup) {
    return <RoomSelectionScreen onRoomSetup={setRoomSetup} />;
  }
  
  // Step 2: Language selection (only for hosts)
  if (roomSetup.isHost && !selectedLanguages) {
    return <LanguageSelectorScreen onLanguageSelected={setSelectedLanguages} />;
  } 
  
  // Step 3: Main app
  return (
    <App 
      targetLanguages={selectedLanguages || ['English']} // Default for students
      onReset={() => {
        setRoomSetup(null);
        setSelectedLanguages(null);
      }}
      roomSetup={roomSetup}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)
