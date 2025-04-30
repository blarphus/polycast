import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

const SUPPORTED_MIME_TYPE = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

function AudioRecorder({ sendMessage, isRecording, onAudioSent }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const isActuallyRecording = useRef(false); // Track the recorder's internal state

  // Function to initialize and start the recorder
  const startRecording = useCallback(async () => {
    if (isActuallyRecording.current) return; // Prevent double starts
    console.log('Attempting to start recording...');
    try {
      // 1. Get Stream if needed
      if (!streamRef.current) {
        console.log('Requesting microphone stream...');
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Stream acquired.');
      }

      // 2. Initialize MediaRecorder if needed
      if (!mediaRecorderRef.current) {
        console.log('Initializing MediaRecorder...');
        if (!MediaRecorder.isTypeSupported(SUPPORTED_MIME_TYPE)) {
          console.error(`AUDIO_RECORDER: Browser does not support ${SUPPORTED_MIME_TYPE} recording.`);
          return;
        }
        mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType: SUPPORTED_MIME_TYPE });

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            console.log('Data available, size:', event.data.size);
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          console.log('Recorder stopped. Processing chunks...');
          isActuallyRecording.current = false; // Update internal state tracker
          if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: SUPPORTED_MIME_TYPE });
            console.log('Sending audio blob, size:', audioBlob.size);
            sendMessage(audioBlob);
            if (onAudioSent) {
              onAudioSent();
            }
          } else {
            console.log('No audio chunks recorded.');
          }
          audioChunksRef.current = []; // Clear chunks after processing
        };

        mediaRecorderRef.current.onerror = (event) => {
          console.error('AUDIO_RECORDER: MediaRecorder Error:', event.error);
          isActuallyRecording.current = false;
        };
        console.log('MediaRecorder initialized.');
      }

      // 3. Start Recording if inactive
      if (mediaRecorderRef.current.state === 'inactive') {
        audioChunksRef.current = []; // Clear any stale chunks before starting
        mediaRecorderRef.current.start();
        isActuallyRecording.current = true; // Update internal state tracker
        console.log('MediaRecorder started. State:', mediaRecorderRef.current.state);
      } else {
        console.warn('Start called but recorder state is:', mediaRecorderRef.current.state);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [sendMessage, onAudioSent]);

  // Function to stop the recorder
  const stopRecording = useCallback(() => {
    if (!isActuallyRecording.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      console.log('Stop called but not actually recording or recorder invalid.');
      return; // Only stop if actually recording
    }
    console.log('Attempting to stop recording...');
    mediaRecorderRef.current.stop(); // The onstop handler will manage sending data
  }, []);

  // Effect hook to react to isRecording prop changes
  useEffect(() => {
    if (isRecording) {
      // Prop wants to record, start if not already
      startRecording();
    } else {
      // Prop wants to stop, stop if currently recording
      stopRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup effect on component unmount
  useEffect(() => {
    return () => {
      console.log('AudioRecorder unmounting: Cleaning up...');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('Stopping recorder on unmount.');
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        console.log('Releasing microphone stream on unmount.');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null; // Clear ref
    };
  }, []); // Empty dependency array means run only on unmount

  // This component doesn't render anything visual itself
  return null;
}

AudioRecorder.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  isRecording: PropTypes.bool.isRequired,
  onAudioSent: PropTypes.func,
};

export default AudioRecorder;
