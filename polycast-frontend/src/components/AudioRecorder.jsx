import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording, onAudioSent }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null); 
  const [segmentActive, setSegmentActive] = useState(false);
  const doNotSendRef = useRef(false); 
  const [micError, setMicError] = useState(null);
  
  // Refs for audio processing
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  
  // State machine: 'idle' -> 'recording' -> 'paused'
  const recorderStateRef = useRef('idle');
  const speechDetectedRef = useRef(false);
  const lastSoundTimeRef = useRef(0);
  
  // Debug logger that doesn't spam the console
  const debugLog = useCallback((message) => {
    // Only log state transitions and important events
    if (message.includes('State') || message.includes('speech') || message.includes('silence')) {
      console.log(message);
    }
  }, []);

  // Acquire microphone stream on mount
  useEffect(() => {
    async function getStream() {
      try {
        if (!streamRef.current) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicError(null);
          
          // Set up audio context and analyzer for silence detection
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          
          const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
          source.connect(analyserRef.current);
        }
      } catch (err) {
        setMicError('Microphone access denied or unavailable. Please allow microphone access.');
        streamRef.current = null;
      }
    }
    getStream();
    
    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (silenceTimeoutRef.current) {
        clearInterval(silenceTimeoutRef.current);
      }
    };
  }, []);

  // Start a new MediaRecorder
  const startRecording = useCallback(() => {
    if (!streamRef.current || mediaRecorderRef.current) return;
    
    const SUPPORTED_MIME_TYPE = 'audio/webm;codecs=opus';
    let mimeType = SUPPORTED_MIME_TYPE;
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.error('AUDIO_RECORDER: Browser does not support audio/webm recording.');
        return;
      }
    }
    
    mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType });
    audioChunksRef.current = [];
    
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    
    mediaRecorderRef.current.onstop = () => {
      // Only send if there's meaningful content (min 1KB) and this wasn't manually stopped
      const hasContent = audioChunksRef.current.length > 0 && 
                         audioChunksRef.current.some(chunk => chunk.size > 1024);
      
      if (!doNotSendRef.current && hasContent && speechDetectedRef.current) {
        const audioBlob = new Blob(audioChunksRef.current, { type: SUPPORTED_MIME_TYPE });
        debugLog(`Sending audio blob: ${audioBlob.size} bytes`);
        
        // File debug info
        if (audioBlob.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const arr = new Uint8Array(reader.result);
            const hex = Array.from(arr.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            debugLog(`Audio blob type: ${audioBlob.type}, size: ${audioBlob.size}, first 16 bytes: ${hex}`);
          };
          reader.readAsArrayBuffer(audioBlob);
          
          sendMessage(audioBlob);
          if (onAudioSent) {
            onAudioSent();
          }
        }
      } else {
        debugLog('Not sending audio: ' + 
          (!hasContent ? 'insufficient content' : 
           doNotSendRef.current ? 'manually stopped' : 
           !speechDetectedRef.current ? 'no speech detected' : 'unknown reason'));
      }
      
      // Clear state
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      recorderStateRef.current = 'idle';
      speechDetectedRef.current = false;
      setSegmentActive(false);
    };
    
    mediaRecorderRef.current.start();
    recorderStateRef.current = 'recording';
    debugLog('State transition: idle -> recording (MediaRecorder started)');
    setSegmentActive(true);
  }, [sendMessage, onAudioSent, debugLog]);

  // Process audio data to detect speech and silence
  const processAudio = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const THRESHOLD = 10; // Volume threshold (1-255)
    const isSpeaking = average >= THRESHOLD;
    
    const now = Date.now();
    
    // State machine logic
    switch (recorderStateRef.current) {
      case 'idle':
        // When in idle state and speech detected, start recording
        if (isSpeaking) {
          debugLog('Speech detected while idle, starting recorder');
          speechDetectedRef.current = true;
          lastSoundTimeRef.current = now;
          startRecording();
        }
        break;
        
      case 'recording':
        // In recording state
        if (isSpeaking) {
          // Reset last sound time whenever we hear something
          lastSoundTimeRef.current = now;
          // Mark that real speech was detected (not just background noise)
          speechDetectedRef.current = true;
        } else {
          // Check for silence duration
          const silenceDuration = now - lastSoundTimeRef.current;
          
          // If silent for >500ms and we had detected speech before, stop recording
          if (silenceDuration > 500 && speechDetectedRef.current) {
            debugLog(`Silence detected for ${silenceDuration}ms after speech, stopping recorder`);
            
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
            }
          }
        }
        break;
    }
  }, [isRecording, startRecording, debugLog]);

  // Main effect: manage recording state based on user starting/stopping
  useEffect(() => {
    if (micError) return;
    
    if (isRecording) {
      // Start the audio processing interval
      if (silenceTimeoutRef.current) {
        clearInterval(silenceTimeoutRef.current);
      }
      
      // Set initial state to idle but ready to detect speech
      if (recorderStateRef.current === 'idle' && !mediaRecorderRef.current) {
        debugLog('Ready to detect speech');
      }
      
      silenceTimeoutRef.current = setInterval(processAudio, 100);
    } else {
      // User stopped recording - clean up
      if (silenceTimeoutRef.current) {
        clearInterval(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      if (mediaRecorderRef.current) {
        debugLog('User stopped recording, closing recorder');
        mediaRecorderRef.current.stop();
      }
      
      // Reset state
      recorderStateRef.current = 'idle';
    }
  }, [isRecording, processAudio, micError, debugLog]);

  if (micError) {
    return <div style={{ color: 'red', marginTop: 20, textAlign: 'center', fontWeight: 'bold' }}>{micError}</div>;
  }
  
  return (
    <div className="audio-recorder">
    </div>
  );
}

AudioRecorder.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  isRecording: PropTypes.bool.isRequired,
  onAudioSent: PropTypes.func,
};

export default AudioRecorder;
