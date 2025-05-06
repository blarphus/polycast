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
  const silenceDetectionEnabledRef = useRef(false);
  const hasSpeechRef = useRef(false);  // Track if speech occurred in current segment
  const inSilencePeriodRef = useRef(false);  // Track if we're in an extended silence

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

  // Silence detection function
  const detectSilence = useCallback(() => {
    if (!analyserRef.current || !silenceDetectionEnabledRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate volume level (average of frequency data)
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    
    const SILENCE_THRESHOLD = 15; // Adjust this value as needed
    const isSilent = average < SILENCE_THRESHOLD;
    
    if (!isSilent) {
      // Sound detected, update timestamp
      lastSoundDetectedTimeRef.current = Date.now();
      
      // If we were in a silence period and now detect speech, start a new segment
      if (inSilencePeriodRef.current) {
        console.log('Speech detected after silence period');
        inSilencePeriodRef.current = false;
        hasSpeechRef.current = true;
      }
      
      // Mark that we've detected speech in this segment
      hasSpeechRef.current = true;
    } else {
      // Check if silence duration exceeds threshold
      const silenceDuration = Date.now() - lastSoundDetectedTimeRef.current;
      const SILENCE_DURATION_THRESHOLD = 500; // 0.5 seconds in milliseconds
      
      // Only send audio chunk if:
      // 1. We've been silent for 0.5 seconds
      // 2. We're not already in a silence period
      // 3. We're recording
      // 4. We've detected speech in this segment
      if (silenceDuration >= SILENCE_DURATION_THRESHOLD && 
          !inSilencePeriodRef.current && 
          mediaRecorderRef.current && 
          mediaRecorderRef.current.state === 'recording' &&
          hasSpeechRef.current) {
        
        console.log('Silence detected after speech, sending audio chunk');
        // Stop current recording to trigger the onstop event which sends the data
        const currentMediaRecorder = mediaRecorderRef.current;
        mediaRecorderRef.current = null; // Prevent onstop from triggering a recursive call
        currentMediaRecorder.stop();
        
        // Mark that we're in a silence period now
        inSilencePeriodRef.current = true;
        hasSpeechRef.current = false;
        
        // Don't automatically start a new segment - wait for speech to resume
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
      // Only send if:
      // 1. Not stopping from Stop Recording 
      // 2. There are audio chunks
      // 3. At least one chunk has meaningful size
      // 4. We detected speech in this segment
      const hasContent = audioChunksRef.current.length > 0 && 
                         audioChunksRef.current.some(chunk => chunk.size > 500);
      
      if (!doNotSendRef.current && hasContent && hasSpeechRef.current) {
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
        console.log('Sending final audio blob:', audioBlob);
        sendMessage(audioBlob);
        if (onAudioSent) {
          onAudioSent();
        }
        audioChunksRef.current = [];
      } else {
        console.log('Not sending audio blob - insufficient content or no speech detected');
        // Always clear chunks
        audioChunksRef.current = [];
      }
      setSegmentActive(false);
    };
    mediaRecorderRef.current.start();
    console.log('MediaRecorder started');
    
    // Reset silence detection
    lastSoundDetectedTimeRef.current = Date.now();
    inSilencePeriodRef.current = false;
    hasSpeechRef.current = false;
    setSegmentActive(true);
  }, [sendMessage, onAudioSent]);

  // Start/stop MediaRecorder on isRecording change
  useEffect(() => {
    if (micError) return;
    
    if (isRecording) {
      if (streamRef.current) {
        startNewSegment();
        silenceDetectionEnabledRef.current = true;
        
        // Start silence detection interval
        if (silenceTimeoutRef.current) {
          clearInterval(silenceTimeoutRef.current);
        }
        silenceTimeoutRef.current = setInterval(detectSilence, 100); // Check every 100ms
      }
    } else {
      silenceDetectionEnabledRef.current = false;
      
      // Clear silence detection interval
      if (silenceTimeoutRef.current) {
        clearInterval(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
    // Don't clean up stream here
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
