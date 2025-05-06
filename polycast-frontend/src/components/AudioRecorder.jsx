import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording, onAudioSent }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null); 
  const [micError, setMicError] = useState(null);
  
  // Simple audio detection
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceDetectorRef = useRef(null);
  const lastSoundTimeRef = useRef(0);
  
  // Get microphone access on mount
  useEffect(() => {
    async function getStream() {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Set up audio analyzer for detecting volume
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        source.connect(analyserRef.current);
        
        setMicError(null);
      } catch (err) {
        setMicError('Microphone access denied or unavailable');
        console.error('Mic error:', err);
      }
    }
    
    getStream();
    
    return () => {
      // Clean up on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // Handle recording state changes
  useEffect(() => {
    if (!streamRef.current || micError) return;
    
    if (isRecording) {
      // Start recording
      console.log('Starting recorder');
      
      const recorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        // Send the audio data when recorder stops
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('Sending audio chunk, size:', blob.size);
          sendMessage(blob);
          if (onAudioSent) onAudioSent();
        }
      };
      
      // Start recording
      recorder.start();
      lastSoundTimeRef.current = Date.now();
      
      // Start silence detection
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
      }
      
      silenceDetectorRef.current = setInterval(() => {
        if (!analyserRef.current || !mediaRecorderRef.current) return;
        
        // Get audio data
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        
        if (avg > 10) {
          // Sound detected, update timestamp
          lastSoundTimeRef.current = Date.now();
        } else {
          // Check if we've had silence for >500ms
          const silenceDuration = Date.now() - lastSoundTimeRef.current;
          
          if (silenceDuration >= 500 && mediaRecorderRef.current.state === 'recording') {
            // Stop current recorder to send chunk
            console.log(`Pause detected (${silenceDuration}ms), sending chunk`);
            const currentRecorder = mediaRecorderRef.current;
            
            // Stop current recorder
            currentRecorder.stop();
            
            // Create new recorder after a small delay
            setTimeout(() => {
              if (isRecording) {
                const newRecorder = new MediaRecorder(streamRef.current);
                mediaRecorderRef.current = newRecorder;
                audioChunksRef.current = [];
                
                newRecorder.ondataavailable = (e) => {
                  if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                  }
                };
                
                newRecorder.onstop = () => {
                  if (audioChunksRef.current.length > 0) {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    console.log('Sending audio chunk, size:', blob.size);
                    sendMessage(blob);
                    if (onAudioSent) onAudioSent();
                  }
                };
                
                newRecorder.start();
                lastSoundTimeRef.current = Date.now();
              }
            }, 50);
          }
        }
      }, 100);
      
    } else {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('Stopping recorder (user released key)');
        mediaRecorderRef.current.stop();
      }
      
      // Clear silence detector
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
        silenceDetectorRef.current = null;
      }
    }
  }, [isRecording, sendMessage, onAudioSent, micError]);
  
  return (
    <div className="audio-recorder">
      {micError && <div style={{ color: 'red' }}>{micError}</div>}
    </div>
  );
}

AudioRecorder.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  isRecording: PropTypes.bool.isRequired,
  onAudioSent: PropTypes.func,
};

export default AudioRecorder;
