import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording, onAudioSent }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null); // <-- this will persist for the session
  const [status, setStatus] = useState('Idle');
  const [sendNotice, setSendNotice] = useState(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const fadeTimeoutRef = useRef(null);
  const fadeAnimTimeoutRef = useRef(null);
  const [segmentActive, setSegmentActive] = useState(false);
  const [restartSegment, setRestartSegment] = useState(false); // NEW
  const doNotSendRef = useRef(false); // NEW

  // Helper: show a fading message
  const showSendNotice = (msg) => {
    setSendNotice(msg);
    setNoticeVisible(true);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    if (fadeAnimTimeoutRef.current) clearTimeout(fadeAnimTimeoutRef.current);
    // Show for 1s, then fade out over 1s
    fadeTimeoutRef.current = setTimeout(() => {
      setNoticeVisible(false); // triggers fade
    }, 1000);
    fadeAnimTimeoutRef.current = setTimeout(() => setSendNotice(null), 2000); // Remove after fade completes
  };

  // Handle space bar to flush segment
  useEffect(() => {
    if (!isRecording) return;
    const handleSpace = (e) => {
      if (e.code === 'Space' && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setSegmentActive(true);
        setRestartSegment(true); // Signal to restart after stop
      }
    };
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [isRecording]);

  // Helper to start a new segment (reuse stream)
  const startNewSegment = useCallback(() => {
    if (!streamRef.current) return;
    const SUPPORTED_MIME_TYPE = 'audio/webm;codecs=opus';
    let mimeType = SUPPORTED_MIME_TYPE;
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        setStatus('Error: Browser does not support audio/webm recording. Please use Chrome or Edge.');
        alert('Your browser does not support audio/webm recording. Please use Chrome or Edge.');
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
      setStatus('Idle');
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
        showSendNotice('Audio sent for transcription');
        audioChunksRef.current = [];
      } else {
        // Always clear chunks
        audioChunksRef.current = [];
      }
      // Don't start new segment here—let useEffect handle it
      setSegmentActive(false);
    };
    mediaRecorderRef.current.start();
    setStatus('Recording');
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
          setStatus('Requesting Mic');
          if (!streamRef.current) {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
          startNewSegment();
        } catch (error) {
          setStatus('Error: ' + error.message);
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
        if (status !== 'Idle' && !status.startsWith('Error')) {
          setStatus('Idle');
        }
      }
    }
    setupAudio();
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (fadeAnimTimeoutRef.current) clearTimeout(fadeAnimTimeoutRef.current);
    };
  }, [isRecording, sendMessage, segmentActive, startNewSegment, status]);

  return (
    <div className="audio-recorder">
      <div>Status: {status}</div>
      {sendNotice && (
        <div style={{
          position: 'fixed',
          top: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(60, 180, 255, 0.9)',
          color: '#fff',
          padding: '10px 24px',
          borderRadius: 8,
          fontWeight: 500,
          fontSize: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
          zIndex: 9999,
          opacity: noticeVisible ? 1 : 0,
          transition: 'opacity 1s',
          pointerEvents: 'none',
        }}>{sendNotice}</div>
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
