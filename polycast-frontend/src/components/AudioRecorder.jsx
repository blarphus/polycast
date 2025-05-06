import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording, onAudioSent }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null); 
  const [micError, setMicError] = useState(null);
  
  // Audio processing refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceDetectorRef = useRef(null);
  const lastSoundTimeRef = useRef(0);
  const speechDetectedRef = useRef(false); // Track if real speech was detected
  
  // Adaptive noise floor tracking
  const noiseFloorRef = useRef(null);  // running average of silence energy
  const dynamicThreshRef = useRef(0);  // noise + margin
  
  // Audio visualization state
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSilent, setIsSilent] = useState(true);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [zeroCrossings, setZeroCrossings] = useState(0);
  
  // Zero crossing rate calculation function
  function zeroCrossingRate(array) {
    let crossings = 0;
    for (let i = 1; i < array.length; i++) {
      const v1 = array[i - 1] - 128;
      const v2 = array[i] - 128;
      if ((v1 >= 0 && v2 < 0) || (v1 < 0 && v2 >= 0)) crossings++;
    }
    return crossings / array.length; // 0...0.5
  }
  
  // Get microphone access on mount
  useEffect(() => {
    async function getStream() {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Set up audio analyzer for detecting volume
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 1024; // Increased for better resolution
        
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        
        // Create band-pass: 300 Hz – 3400 Hz (speech frequencies)
        const hp = audioContextRef.current.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 300;
        
        const lp = audioContextRef.current.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3400;
        
        // wire: mic → HP → LP → analyser
        source.connect(hp);
        hp.connect(lp);
        lp.connect(analyserRef.current);
        
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
      
      // Reset speech detection for this segment
      speechDetectedRef.current = false;
      lastSoundTimeRef.current = Date.now();
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        // Send the audio data when recorder stops
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('Sending audio chunk, size:', blob.size, 'bytes, speech detected:', speechDetectedRef.current);
          sendMessage(blob);
          if (onAudioSent) onAudioSent();
        }
      };
      
      // Start recording
      recorder.start();
      
      // Start silence detection
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
      }
      
      silenceDetectorRef.current = setInterval(() => {
        if (!analyserRef.current || !mediaRecorderRef.current) return;
        
        // Get time-domain audio data
        const dataArray = new Uint8Array(analyserRef.current.fftSize);
        analyserRef.current.getByteTimeDomainData(dataArray);
        
        // Calculate RMS (root mean square) for better energy representation
        const rms = Math.sqrt(dataArray.reduce((sum, val) => {
          const n = (val - 128) / 128;  // convert to -1...1
          return sum + n * n;
        }, 0) / dataArray.length);
        
        // Calculate zero crossing rate
        const zcr = zeroCrossingRate(dataArray);
        setZeroCrossings(zcr.toFixed(3));
        
        // Scale for UI (0-100)
        setAudioLevel(rms * 100);
        
        // Update noise floor whenever the mic has been silent for a while
        if (isSilent) {
          const α = 0.05;  // smoothing factor
          noiseFloorRef.current = noiseFloorRef.current === null
            ? rms
            : (1 - α) * noiseFloorRef.current + α * rms;
        }
        
        // Dynamic threshold: noise floor + 6 dB (×2 in power)
        if (noiseFloorRef.current !== null) {
          dynamicThreshRef.current = noiseFloorRef.current * 2;
        }
        
        // Require BOTH: energy > threshold AND zcr > 0.05
        // This checks for both volume AND the modulation characteristic of speech
        if (rms > dynamicThreshRef.current && zcr > 0.05) {
          // Sound detected, update timestamp
          lastSoundTimeRef.current = Date.now();
          setIsSilent(false);
          setSilenceDuration(0);
          
          // Mark as speech
          if (!speechDetectedRef.current) {
            console.log(`Speech detected! RMS: ${(rms * 100).toFixed(1)}, ZCR: ${zcr.toFixed(3)}, Threshold: ${(dynamicThreshRef.current * 100).toFixed(1)}`);
            speechDetectedRef.current = true;
          }
        } else {
          // We're in silence
          setIsSilent(true);
          
          // Check how long we've been silent
          const duration = Date.now() - lastSoundTimeRef.current;
          setSilenceDuration(duration);
          
          // Add explicit debug logging for silence
          if (duration > 400) {
            console.log(`In silence for ${duration}ms, speech detected: ${speechDetectedRef.current}`);
          }
          
          // Only send if speech was detected and we've been silent for 500ms
          if (duration >= 500 && 
              mediaRecorderRef.current.state === 'recording' && 
              speechDetectedRef.current) {
            
            console.log(`PAUSE DETECTED after speech (${duration}ms), sending chunk`);
            const currentRecorder = mediaRecorderRef.current;
            
            try {
              // Stop current recorder
              currentRecorder.stop();
              
              // Create new recorder after a small delay
              setTimeout(() => {
                if (isRecording) {
                  try {
                    const newRecorder = new MediaRecorder(streamRef.current);
                    mediaRecorderRef.current = newRecorder;
                    audioChunksRef.current = [];
                    
                    // Reset speech detection for new segment
                    speechDetectedRef.current = false;
                    
                    newRecorder.ondataavailable = (e) => {
                      if (e.data.size > 0) {
                        audioChunksRef.current.push(e.data);
                      }
                    };
                    
                    newRecorder.onstop = () => {
                      if (audioChunksRef.current.length > 0) {
                        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                        console.log('Sending audio chunk, size:', blob.size, 'bytes, speech detected:', speechDetectedRef.current);
                        sendMessage(blob);
                        if (onAudioSent) onAudioSent();
                      }
                    };
                    
                    newRecorder.start();
                    console.log('Started new recorder after pause');
                    lastSoundTimeRef.current = Date.now();
                  } catch (e) {
                    console.error('Error creating new recorder:', e);
                  }
                }
              }, 50);
            } catch (e) {
              console.error('Error stopping recorder:', e);
            }
          }
        }
      }, 100);
      
    } else {
      // Stop recording if user releases key
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        // Always send the final chunk when user stops recording
        console.log('Stopping recorder (user released key)');
        mediaRecorderRef.current.stop();
      }
      
      // Clear silence detector
      if (silenceDetectorRef.current) {
        clearInterval(silenceDetectorRef.current);
        silenceDetectorRef.current = null;
      }
      
      // Reset UI
      setAudioLevel(0);
      setIsSilent(true);
      setSilenceDuration(0);
    }
  }, [isRecording, sendMessage, onAudioSent, micError]);
  
  return (
    <div className="audio-recorder">
      {micError && <div style={{ color: 'red' }}>{micError}</div>}
      
      {/* Audio level meter for debugging */}
      {isRecording && (
        <div style={{ 
          position: 'fixed', 
          bottom: '20px', 
          right: '20px', 
          padding: '10px', 
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          borderRadius: '5px',
          zIndex: 9999,
          fontSize: '12px',
          width: '180px'
        }}>
          <div>Level: {audioLevel.toFixed(1)}</div>
          <div>ZCR: {zeroCrossings}</div>
          <div>Floor: {noiseFloorRef.current ? (noiseFloorRef.current * 100).toFixed(1) : 'Learning...'}</div>
          <div style={{ 
            height: '10px', 
            width: '100%', 
            background: '#333',
            marginTop: '5px'
          }}>
            <div style={{ 
              height: '100%', 
              width: `${Math.min(100, audioLevel)}%`, 
              background: isSilent ? '#f55' : '#5f5',
              transition: 'width 0.1s'
            }}></div>
          </div>
          <div style={{ marginTop: '5px' }}>
            {isSilent ? `Silent: ${silenceDuration}ms` : 'Speech detected'}
          </div>
          <div>
            Speech: {speechDetectedRef.current ? 'YES' : 'NO'}
          </div>
        </div>
      )}
    </div>
  );
}

AudioRecorder.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  isRecording: PropTypes.bool.isRequired,
  onAudioSent: PropTypes.func,
};

export default AudioRecorder;
