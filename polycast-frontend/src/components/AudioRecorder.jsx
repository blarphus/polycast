import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

function AudioRecorder({ sendMessage, isRecording }) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('Idle'); // e.g., Idle, Requesting Mic, Recording, Stopping, Error

  useEffect(() => {
    console.log(`AUDIO_RECORDER: useEffect running. isRecording: ${isRecording}`); // Log
    async function setupAudio() {
      if (isRecording) {
        console.log("AUDIO_RECORDER: useEffect -> calling startRecording"); // Log
        try {
          console.log("AUDIO_RECORDER: Requesting Mic..."); // Log
          setStatus('Requesting Mic');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setStatus('Recording');

          mediaRecorderRef.current = new MediaRecorder(stream);
          audioChunksRef.current = []; // Clear previous chunks

          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
              console.log('Sending audio chunk:', event.data);
              sendMessage(event.data); // Send Blob directly
              // audioChunksRef.current.push(event.data); // Store chunks if needed locally
            }
          };

          mediaRecorderRef.current.onstop = () => {
            console.log('MediaRecorder stopped.');
            setStatus('Idle');
            // Optionally process combined chunks if needed:
            // const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            // const audioUrl = URL.createObjectURL(audioBlob);
            // console.log('Recording complete, URL:', audioUrl);
          };

          // Start recording, sending data every 0.5 seconds (500ms)
          mediaRecorderRef.current.start(500);
          console.log('MediaRecorder started');

        } catch (err) {
          console.error('Error accessing microphone or starting recorder:', err);
          setStatus(`Error: ${err.message}`);
          // Clean up if getUserMedia failed but we got partway
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
        }
      } else {
        console.log("AUDIO_RECORDER: useEffect -> calling stopRecording (inner)"); // Log
        const stopRecording = (isCleanup = false) => {
          console.log(`AUDIO_RECORDER: stopRecording (inner) called. Cleanup: ${isCleanup}, Current Status: ${status}, Recorder State: ${mediaRecorderRef.current?.state}`); // Log
          if (status === 'Idle' || status === 'Stopping') {
            console.log("AUDIO_RECORDER: (inner) Already Idle or Stopping. Skipping stop logic."); // Log
            return;
          }
          setStatus('Stopping');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('Attempting to stop MediaRecorder...');
            mediaRecorderRef.current.stop();
          }
          if (streamRef.current) {
            console.log('Stopping media stream tracks...');
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          if (status !== 'Idle' && !status.startsWith('Error')) {
            setStatus('Idle'); // Only reset status if not already idle or error
          }
        };
        stopRecording(); // Call the inner function
      }
    }

    setupAudio();

    // Cleanup function: ensures resources are released when component unmounts
    // or before the effect runs again if isRecording changes before stop completes.
    return () => {
      console.log('Cleanup: Stopping recorder and stream');
      const stopRecording = (isCleanup = true) => {
        console.log(`AUDIO_RECORDER: stopRecording called. Cleanup: ${isCleanup}, Current Status: ${status}, Recorder State: ${mediaRecorderRef.current?.state}`); // Log
        if (status === 'Idle' || status === 'Stopping') {
          console.log("AUDIO_RECORDER: Already Idle or Stopping. Skipping stop logic."); // Log
          return;
        }
        setStatus('Stopping');
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('Attempting to stop MediaRecorder...');
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          console.log('Stopping media stream tracks...');
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
        if (status !== 'Idle' && !status.startsWith('Error')) {
          setStatus('Idle'); // Only reset status if not already idle or error
        }
      };
      stopRecording(true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, sendMessage]); // Re-run effect when isRecording changes

  return (
    <div className="audio-recorder">
      <div>Status: {status}</div>
      {/* Maybe add a visual indicator for recording? */}
    </div>
  );
}

AudioRecorder.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  isRecording: PropTypes.bool.isRequired,
};

export default AudioRecorder;
