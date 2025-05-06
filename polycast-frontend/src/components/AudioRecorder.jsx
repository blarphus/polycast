import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording, onAudioSent }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null); 
  const [segmentActive, setSegmentActive] = useState(false);
  const [restartSegment, setRestartSegment] = useState(false); 
  const doNotSendRef = useRef(false); 
  const [micError, setMicError] = useState(null);
  
  // Refs for silence detection
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const lastSoundDetectedTimeRef = useRef(Date.now());
  
  // Simpler refs for tracking state
  const isSilentRef = useRef(true);
  const pauseDurationRef = useRef(0);

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
          // Don't connect to destination to avoid feedback
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

  // Simpler silence detection function that works with running averages
  const detectSilence = useCallback(() => {
    if (!analyserRef.current || !isRecording || !mediaRecorderRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate volume level (average of frequency data)
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    
    // More forgiving silence threshold
    const SILENCE_THRESHOLD = 10;
    const currentlySilent = average < SILENCE_THRESHOLD;
    
    if (!currentlySilent) {
      // Reset silence duration when sound is detected
      pauseDurationRef.current = 0;
      isSilentRef.current = false;
      lastSoundDetectedTimeRef.current = Date.now();
    } else {
      // If we're currently silent, increment the pause duration
      if (!isSilentRef.current) {
        // We just transitioned from speech to silence
        pauseDurationRef.current = Date.now() - lastSoundDetectedTimeRef.current;
      } else {
        // We're continuing to be silent
        pauseDurationRef.current = Date.now() - lastSoundDetectedTimeRef.current;
      }
      
      isSilentRef.current = true;
      
      // If we've been silent for 0.5 seconds and we're still recording, send the chunk
      if (pauseDurationRef.current >= 500 && 
          mediaRecorderRef.current && 
          mediaRecorderRef.current.state === 'recording') {
        
        console.log(`Silence detected for ${pauseDurationRef.current}ms - sending audio chunk`);
        
        // Stop current recording to trigger onstop event
        const currentMediaRecorder = mediaRecorderRef.current;
        mediaRecorderRef.current = null;
        currentMediaRecorder.stop();
        
        // After stopping, don't immediately start a new segment
        // The next speech will trigger a new segment in the isRecording useEffect
      }
    }
  }, [isRecording]);

  // Helper to start a new segment (reuse stream)
  const startNewSegment = useCallback(() => {
    if (!streamRef.current) return;
    const SUPPORTED_MIME_TYPE = 'audio/webm;codecs=opus';
    let mimeType = SUPPORTED_MIME_TYPE;
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.error('AUDIO_RECORDER: Browser does not support audio/webm recording. Please use Chrome or Edge.');
        return;
      }
    }
    mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType });
    audioChunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    mediaRecorderRef.current.onstop = () => {
      // Only send if there's some meaningful content (just a very small threshold)
      const hasContent = audioChunksRef.current.length > 0 && 
                         audioChunksRef.current.some(chunk => chunk.size > 100);
      
      if (!doNotSendRef.current && hasContent) {
        const audioBlob = new Blob(audioChunksRef.current, { type: SUPPORTED_MIME_TYPE });
        // Debug info
        const reader = new FileReader();
        reader.onloadend = () => {
          const arr = new Uint8Array(reader.result);
          const hex = Array.from(arr.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          console.log('[Polycast Debug] Final blob type:', audioBlob.type, 'size:', audioBlob.size);
          console.log('[Polycast Debug] Final first 16 bytes:', hex);
        };
        reader.readAsArrayBuffer(audioBlob);
        console.log('Sending audio blob:', audioBlob);
        sendMessage(audioBlob);
        if (onAudioSent) {
          onAudioSent();
        }
      } else if (!hasContent) {
        console.log('Not sending audio blob - insufficient content');
      }
      
      // Always clear chunks
      audioChunksRef.current = [];
      setSegmentActive(false);
      
      // Reset silence detection state
      lastSoundDetectedTimeRef.current = Date.now();
      pauseDurationRef.current = 0;
      
      // If still recording but no mediaRecorder, start a new one
      if (isRecording && !mediaRecorderRef.current) {
        setTimeout(() => {
          if (isRecording) {
            startNewSegment();
          }
        }, 50); // Small delay to avoid rapid starting/stopping
      }
    };
    
    mediaRecorderRef.current.start();
    console.log('MediaRecorder started');
    
    // Reset silence detection
    lastSoundDetectedTimeRef.current = Date.now();
    pauseDurationRef.current = 0;
    isSilentRef.current = true;
    setSegmentActive(true);
  }, [isRecording, sendMessage, onAudioSent]);

  // Start/stop MediaRecorder on isRecording change
  useEffect(() => {
    if (micError) return;
    
    if (isRecording) {
      if (streamRef.current && !mediaRecorderRef.current) {
        startNewSegment();
        
        // Start silence detection interval
        if (silenceTimeoutRef.current) {
          clearInterval(silenceTimeoutRef.current);
        }
        silenceTimeoutRef.current = setInterval(detectSilence, 100); // Check every 100ms
      }
    } else {
      // Clear silence detection interval
      if (silenceTimeoutRef.current) {
        clearInterval(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        // If we're stopping recording entirely, set this flag so onstop doesn't try to restart
        doNotSendRef.current = false; // Always send the final chunk when stopping manually
        mediaRecorderRef.current.stop();
      }
    }
  }, [isRecording, startNewSegment, detectSilence, micError]);

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
