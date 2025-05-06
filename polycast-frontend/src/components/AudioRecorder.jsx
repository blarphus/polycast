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
  const significantSpeechDetectedRef = useRef(false);
  const speechDurationRef = useRef(0);
  const lastVolumeCheckTimeRef = useRef(Date.now());

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
    const currentTime = Date.now();
    const timeSinceLastCheck = currentTime - lastVolumeCheckTimeRef.current;
    lastVolumeCheckTimeRef.current = currentTime;
    
    if (!isSilent) {
      // Sound detected, update timestamp
      lastSoundDetectedTimeRef.current = currentTime;
      
      // Accumulate speech duration
      speechDurationRef.current += timeSinceLastCheck;
      
      // Check if we've had enough speech to consider this a "real" sentence
      const MIN_SPEECH_DURATION = 700; // 0.7 seconds of actual speech required
      if (speechDurationRef.current >= MIN_SPEECH_DURATION && !significantSpeechDetectedRef.current) {
        console.log('Significant speech detected, duration:', speechDurationRef.current);
        significantSpeechDetectedRef.current = true;
      }
    } else {
      // Check if silence duration exceeds threshold AND we've detected significant speech
      const silenceDuration = currentTime - lastSoundDetectedTimeRef.current;
      const SILENCE_DURATION_THRESHOLD = 500; // 0.5 seconds in milliseconds
      
      // Debug the current state
      if (silenceDuration > 200) {
        console.log(`Silence: ${silenceDuration}ms, Speech significant: ${significantSpeechDetectedRef.current}, Speech duration: ${speechDurationRef.current}ms`);
      }
      
      if (silenceDuration >= SILENCE_DURATION_THRESHOLD && 
          significantSpeechDetectedRef.current && 
          mediaRecorderRef.current && 
          mediaRecorderRef.current.state === 'recording') {
        
        console.log('Silence detected after significant speech, sending audio chunk');
        
        // Stop current recording to trigger the onstop event which sends the data
        const currentMediaRecorder = mediaRecorderRef.current;
        mediaRecorderRef.current = null; // Prevent onstop from triggering a recursive call
        currentMediaRecorder.stop();
        
        // Reset speech detection flags - this doesn't take effect immediately due to the 
        // async nature of the MediaRecorder.stop(), so we reset again in startNewSegment
        significantSpeechDetectedRef.current = false;
        speechDurationRef.current = 0;
        
        // Start a new recording segment after a brief delay
        setTimeout(() => {
          if (isRecording) {
            startNewSegment();
          }
        }, 50);
      }
    }
  }, [isRecording, startNewSegment]);

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
      // Only send if not stopping from Stop Recording and there's data
      if (!doNotSendRef.current && audioChunksRef.current.length > 0 && audioChunksRef.current.some(chunk => chunk.size > 0)) {
        const audioBlob = new Blob(audioChunksRef.current, { type: SUPPORTED_MIME_TYPE });
        // Debug info
        const reader = new FileReader();
        reader.onloadend = () => {
          const arr = new Uint8Array(reader.result);
          const hex = Array.from(arr.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          console.log('[Polycast Debug] Final blob type:', audioBlob.type);
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
        // Always clear chunks
        audioChunksRef.current = [];
      }
      setSegmentActive(false);
    };
    mediaRecorderRef.current.start();
    console.log('MediaRecorder started');
    
    // Reset silence detection
    lastSoundDetectedTimeRef.current = Date.now();
    lastVolumeCheckTimeRef.current = Date.now();
    significantSpeechDetectedRef.current = false;
    speechDurationRef.current = 0;
    console.log('Started new recording segment, reset speech detection');
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
