import { OpenAIVoiceSession } from './openai-voice-session.ts';

// Audio manager state interface
export interface AudioManagerState {
  // Audio devices
  availableAudioDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  hasMicrophone: boolean;
  
  // Voice configuration  
  availableVoices: string[];
  selectedVoice: string;
  
  // Audio contexts
  inputAudioContext: AudioContext | null;
  outputAudioContext: AudioContext | null;
  inputNode: AudioNode | null;
  outputNode: GainNode | null;
  
  // Recording state
  openAIVoiceSession: OpenAIVoiceSession | null;
  videoMediaRecorder: MediaRecorder | null;
  videoAudioContext: AudioContext | null;
  
  // UI state
  showMicrophoneSelector: boolean;
  microphonePopupX: number;
  microphonePopupY: number;
  showVoiceSelector: boolean;
  isInitializingSession: boolean;
  isRecording: boolean;
}

// Callbacks interface for communication with main component
export interface AudioManagerCallbacks {
  // State updates
  onStateUpdate: (state: Partial<AudioManagerState>) => void;
  onStatusUpdate: (status: string) => void;
  onErrorUpdate: (error: string) => void;
  
  // Session callbacks
  onSessionConnected: () => void;
  onSessionDisconnected: () => void;
  onRecordingStateChange: (isRecording: boolean) => void;
  onInitSession: () => void;
  
  // Audio processing callbacks
  onAudioProcessed: (audioBlob: Blob) => void;
  onTranscriptReceived: (transcript: any) => void;
  
  // Profile callbacks
  getCurrentProfile: () => string;
}

export class AudioManager {
  private state: AudioManagerState;
  private callbacks: AudioManagerCallbacks;
  
  constructor(initialState: AudioManagerState, callbacks: AudioManagerCallbacks) {
    this.state = { ...initialState };
    this.callbacks = callbacks;
  }
  
  // Getter for current state
  getState(): AudioManagerState {
    return { ...this.state };
  }
  
  // Private helper to update state and notify component
  private updateState(updates: Partial<AudioManagerState>) {
    Object.assign(this.state, updates);
    this.callbacks.onStateUpdate(updates);
  }
  
  // ============================================
  // AUDIO DEVICE MANAGEMENT METHODS
  // ============================================
  
  initAudio() {
    if (this.state.outputAudioContext) {
      // this.nextStartTime = this.state.outputAudioContext.currentTime; // TODO: Handle nextStartTime
    }
    // Check for microphone devices on audio init
    this.enumerateAudioDevices();
  }

  async enumerateAudioDevices() {
    try {
      // First check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn('MediaDevices API not supported');
        this.updateState({ hasMicrophone: false });
        return;
      }

      // Get all media devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter((device) => device.kind === 'audioinput');

      audioInputDevices.forEach((device) => {
      });

      this.updateState({ 
        availableAudioDevices: audioInputDevices,
        hasMicrophone: audioInputDevices.length > 0
      });

      // If no devices found, try requesting permission first
      if (audioInputDevices.length === 0 || audioInputDevices.every((d) => !d.label)) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop the stream immediately, we just needed permission
          stream.getTracks().forEach((track) => track.stop());

          // Re-enumerate with permission granted
          const devicesWithLabels = await navigator.mediaDevices.enumerateDevices();
          const audioInputsWithLabels = devicesWithLabels.filter(
            (device) => device.kind === 'audioinput'
          );

          this.updateState({ 
            availableAudioDevices: audioInputsWithLabels,
            hasMicrophone: audioInputsWithLabels.length > 0
          });

        } catch (permissionError) {
          console.error('❌ Microphone permission denied:', permissionError);
          this.updateState({ hasMicrophone: false });
        }
      }

      // Set default device if none selected
      if (!this.state.selectedAudioDeviceId && this.state.availableAudioDevices.length > 0) {
        this.updateState({ selectedAudioDeviceId: this.state.availableAudioDevices[0].deviceId });
      }

    } catch (error) {
      console.error('❌ Error enumerating audio devices:', error);
      this.updateState({ hasMicrophone: false });
    }
  }

  async selectAudioDevice(deviceId: string) {
    this.updateState({
      selectedAudioDeviceId: deviceId,
      showMicrophoneSelector: false
    });

    // If session is active, reconnect with new device
    if (this.state.openAIVoiceSession && this.state.openAIVoiceSession.connected) {
      await this.state.openAIVoiceSession.disconnect();
      // Small delay to ensure cleanup
      setTimeout(() => {
        this.callbacks.onInitSession();
      }, 500);
    }
  }

  handleMicrophoneButtonClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.state.hasMicrophone) {
      this.callbacks.onStatusUpdate('No microphone detected. Please connect a microphone and refresh the page.');
      return;
    }

    if (this.state.showMicrophoneSelector) {
      this.closeMicrophoneSelector();
      return;
    }

    // Position the popup near the button
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const popupWidth = 350; // Max popup width
    const popupHeight = 250; // Estimated popup height

    // Default to bottom-left of button
    let x = rect.left;
    let y = rect.bottom + 8;

    // Adjust horizontal position if popup would go off the right edge
    if (x + popupWidth > window.innerWidth) {
      x = window.innerWidth - popupWidth - 20; // 20px margin from edge
    }

    // Ensure minimum left margin
    if (x < 20) {
      x = 20;
    }

    // Adjust vertical position if popup would go off the bottom edge
    if (y + popupHeight > window.innerHeight) {
      y = rect.top - popupHeight - 8; // Show above button

      // If still off screen, position at top with margin
      if (y < 20) {
        y = 20;
      }
    }

    this.updateState({
      microphonePopupX: x,
      microphonePopupY: y,
      showMicrophoneSelector: true
    });

    // Refresh device list when opening
    this.enumerateAudioDevices();
  }

  closeMicrophoneSelector() {
    this.updateState({ showMicrophoneSelector: false });
  }

  // ============================================
  // VOICE SELECTION METHODS
  // ============================================

  initializeAvailableVoices() {
    // Available OpenAI voices
    const availableVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
    this.updateState({ availableVoices });

    // Load saved voice preference for current profile
    const currentProfile = this.callbacks.getCurrentProfile();
    const savedVoice = localStorage.getItem(`${currentProfile}_selectedVoice`);
    if (savedVoice && availableVoices.includes(savedVoice)) {
      this.updateState({ selectedVoice: savedVoice });
    } else {
      // Default to 'alloy' and save it
      this.updateState({ selectedVoice: 'alloy' });
      localStorage.setItem(`${currentProfile}_selectedVoice`, 'alloy');
    }
  }

  toggleVoiceSelector() {
    this.updateState({ showVoiceSelector: !this.state.showVoiceSelector });
  }

  selectVoice(voiceName: string) {
    this.updateState({ selectedVoice: voiceName });

    // Save preference for current profile
    const currentProfile = this.callbacks.getCurrentProfile();
    localStorage.setItem(`${currentProfile}_selectedVoice`, voiceName);

    // If session is active, reconnect with new voice
    if (this.state.openAIVoiceSession && this.state.openAIVoiceSession.connected) {
      this.state.openAIVoiceSession.disconnect();
      // Small delay to ensure cleanup
      setTimeout(() => {
        this.callbacks.onInitSession();
      }, 500);
    }
  }

  handleClickOutsideVoiceSelector(event: MouseEvent) {
    const target = event.target as Element;

    // Check if click is outside voice popup (but we need to check for popup overlay)
    if (this.state.showVoiceSelector && target.classList.contains('popup-overlay')) {
      this.updateState({ showVoiceSelector: false });
    }
  }
}