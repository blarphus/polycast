import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording, onAudioSent }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null); 
  const [segmentActive, setSegmentActive] = useState(false);
  const [restartSegment, setRestartSegment] = useState(false); 
  const doNotSendRef = useRef(false); 

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
      // Only send if not stopping from Stop Recording
      if (!doNotSendRef.current && audioChunksRef.current.length > 0) {
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
      // Don't start new segment here—let useEffect handle it
      setSegmentActive(false);
    };
    mediaRecorderRef.current.start();
    console.log('MediaRecorder started');
  }, [sendMessage, onAudioSent]);

  // Robustly restart segment after stop if requested
  useEffect(() => {
    if (restartSegment && isRecording) {
      setRestartSegment(false);
      startNewSegment();
    }
  }, [restartSegment, isRecording, startNewSegment]);

  useEffect(() => {
    async function setupAudio() {
      if (isRecording && !segmentActive) {
        doNotSendRef.current = false; // Allow sending
        try {
          if (!streamRef.current) {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
          startNewSegment();
        } catch (error) {
          console.error('AUDIO_RECORDER: Error during setupAudio:', error);
        }
      } else if (!isRecording) {
        // On stop, do NOT send any audio chunk. Just clean up.
        doNotSendRef.current = true;
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.onstop = null; // Prevent sending on stop
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
      }
    }
    setupAudio();
    return () => {
    };
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('Stopping MediaRecorder');
      mediaRecorderRef.current.stop(); // This triggers the 'stop' event listener
      // The 'stop' listener will handle sending the blob and calling onAudioSent
    }
  }, [onAudioSent]); // Include onAudioSent if it's used inside, though it's called in 'stop' event

  useEffect(() => {
    // Stop recorder only when isRecording goes from true to false
    if (!isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      stopRecording();
    }
    // Start recorder only when isRecording goes from false to true
    else if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      startNewSegment();
    }
  }, [isRecording, startNewSegment, stopRecording]);

  // Cleanup: stop recorder and stream on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
