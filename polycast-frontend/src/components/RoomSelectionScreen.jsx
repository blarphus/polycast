import React, { useState } from 'react';
import PropTypes from 'prop-types';

function RoomSelectionScreen({ onRoomSetup }) {
  const [mode, setMode] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleHostClick = async () => {
    setIsLoading(true);
    try {
      // Generate a room code from the backend
      const response = await fetch('https://polycast-server.onrender.com/api/create-room', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create room: ${response.statusText}`);
      }
      
      const data = await response.json();
      onRoomSetup({ 
        isHost: true, 
        roomCode: data.roomCode 
      });
    } catch (err) {
      setError(`Failed to create room: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Clean the room code (remove any whitespace and non-digit characters)
    const cleanedRoomCode = roomCode.replace(/[^0-9]/g, '').trim();
    
    // Basic validation for room code format (5 digits)
    if (cleanedRoomCode.length !== 5) {
      setError('Room code must be 5 digits');
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(`Attempting to join room: ${cleanedRoomCode}`);
      
      // Check if room exists
      const response = await fetch(`https://polycast-server.onrender.com/api/check-room/${cleanedRoomCode}`);
      const data = await response.json();
      
      if (!response.ok || !data.exists) {
        console.log('Room check response:', { status: response.status, data });
        throw new Error(data.message || 'Room not found');
      }
      
      onRoomSetup({ 
        isHost: false, 
        roomCode: cleanedRoomCode 
      });
    } catch (err) {
      console.error('Error joining room:', err);
      setError(`Failed to join room: ${err.message || 'Room not found. Please check the code and try again.'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="room-selection-container">
      <div className="room-selection-card">
        <h1>PolyCast</h1>
        <h2>Choose Your Role</h2>
        
        {!mode ? (
          <div className="room-buttons">
            <button 
              onClick={() => setMode('host')} 
              className="room-btn host-btn"
              disabled={isLoading}
            >
              Host
            </button>
            <button 
              onClick={() => setMode('student')} 
              className="room-btn student-btn"
              disabled={isLoading}
            >
              Student
            </button>
          </div>
        ) : mode === 'host' ? (
          <div className="mode-container">
            <p>Create a new room as Host</p>
            <button 
              onClick={handleHostClick} 
              className="room-btn host-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Room...' : 'Create Room'}
            </button>
            <button 
              onClick={() => setMode(null)} 
              className="back-btn"
              disabled={isLoading}
            >
              Back
            </button>
          </div>
        ) : (
          <div className="mode-container">
            <p>Enter a 5-digit room code to join as Student</p>
            <form onSubmit={handleStudentSubmit}>
              <input
                type="text"
                placeholder="5-digit room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                maxLength={5}
                pattern="\\d{5}"
                required
                disabled={isLoading}
              />
              <button 
                type="submit" 
                className="room-btn student-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Joining...' : 'Join Room'}
              </button>
            </form>
            <button 
              onClick={() => setMode(null)} 
              className="back-btn"
              disabled={isLoading}
            >
              Back
            </button>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}

RoomSelectionScreen.propTypes = {
  onRoomSetup: PropTypes.func.isRequired
};

export default RoomSelectionScreen;
