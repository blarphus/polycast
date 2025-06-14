import { html, TemplateResult } from 'lit';

export interface UIRendererState {
  // Video state
  leftPanelMode: 'ai' | 'video';
  videoStream: MediaStream | null;
  isVideoLoading: boolean;
  isCameraStopped: boolean;  // True when user manually stopped camera
  videoLayout: 'vertical' | 'horizontal' | 'pip';
  pipPosition: { x: number; y: number };
  isDraggingPip: boolean;
  
  // Video calling state
  callStatus: 'idle' | 'hosting' | 'joining' | 'connected' | 'error';
  callCode: string | null;
  remoteVideoStream: MediaStream | null;
  localStream: MediaStream | null;
  onlineProfiles: string[];
  selectedProfile: string;
  currentProfile: string;
  profiles: readonly string[];
  incomingCall: { callId: string; callerProfile: string } | null;
  
  // Video speech recognition state
  videoInterimTranscript: string;
  isVideoMicMuted: boolean;
  videoConnectionStatus: string;
  selectedVideoLanguage: string;
  
  // Audio state (for AI sphere)
  inputNode?: AudioNode;
  outputNode?: GainNode;
}

export interface UIRendererCallbacks {
  // Video control callbacks
  startWebcam: () => void;
  stopWebcam: () => void;
  toggleVideoMic: () => void;
  handleVideoLayoutChange: (layout: 'vertical' | 'horizontal' | 'pip') => void;
  handlePipDragStart: (e: MouseEvent) => void;
  
  // Video calling callbacks
  requestOnlineProfiles: () => void;
  handleCallProfile: () => void;
  handleEndCall: () => void;
  handleAcceptCall: () => void;
  handleRejectCall: () => void;
}

export class UIRenderer {
  private state: UIRendererState;
  private callbacks: UIRendererCallbacks;

  constructor(state: UIRendererState, callbacks: UIRendererCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
  }

  updateState(newState: Partial<UIRendererState>) {
    Object.assign(this.state, newState);
    
    // Debug: Log what message should be displayed
    let displayMessage = '';
    if (this.state.isVideoLoading) {
      displayMessage = 'Starting camera...';
    } else if (this.state.videoStream) {
      displayMessage = 'Video feed active';
    } else if (this.state.isCameraStopped) {
      displayMessage = 'Camera off';
    } else {
      displayMessage = 'Camera not available';
    }
    
    console.log('🎨 UIRenderer state updated:', {
      videoStream: !!this.state.videoStream,
      isVideoLoading: this.state.isVideoLoading,
      isCameraStopped: this.state.isCameraStopped,
      shouldDisplay: displayMessage,
      buttonText: this.state.videoStream ? 'Stop Camera' : 'Start Camera'
    });
  }

  /**
   * Renders the complete video interface including layout selector, screens, and controls
   */
  renderVideoInterface(): TemplateResult {
    return html`
      <div class="video-interface">
        ${this.renderVideoLayoutSelector()}
        <div class="video-container ${this.state.videoLayout}">
          ${this.renderVideoScreens()}
        </div>
        ${this.renderVideoControls()}
      </div>
    `;
  }

  /**
   * Renders the video layout selector buttons
   */
  private renderVideoLayoutSelector(): TemplateResult {
    return html`
      <div class="video-layout-selector">
        <button
          class="layout-option vertical ${this.state.videoLayout === 'vertical' ? 'active' : ''}"
          @click=${() => this.callbacks.handleVideoLayoutChange('vertical')}
          title="Vertical layout"
        ></button>
        <button
          class="layout-option horizontal ${this.state.videoLayout === 'horizontal' ? 'active' : ''}"
          @click=${() => this.callbacks.handleVideoLayoutChange('horizontal')}
          title="Side by side"
        ></button>
        <button
          class="layout-option pip ${this.state.videoLayout === 'pip' ? 'active' : ''}"
          @click=${() => this.callbacks.handleVideoLayoutChange('pip')}
          title="Picture-in-picture"
        ></button>
      </div>
    `;
  }

  /**
   * Renders all video screens including webcam, waiting screen, and PiP layout
   */
  private renderVideoScreens(): TemplateResult {
    const waitingScreen = html`
      <div class="video-screen waiting-screen">
        <div class="waiting-content">
          ${this.state.callStatus !== 'idle'
            ? html`
                <!-- Remote video area during calls -->
                <div class="remote-video-container">
                  ${this.state.remoteVideoStream
                    ? html`
                        <video id="remote-video" class="remote-video" autoplay playsinline></video>
                        <div class="video-label remote-label">Remote User</div>
                      `
                    : html`
                        <div class="video-placeholder remote-placeholder">
                          <div class="placeholder-content">
                            ${this.state.callStatus === 'hosting'
                              ? html`
                                  <div class="call-status">
                                    <div class="call-code-display">
                                      <span class="call-code-label">Share this code:</span>
                                      <span class="call-code-value">${this.state.callCode}</span>
                                    </div>
                                    <div class="waiting-text">Waiting for someone to join...</div>
                                  </div>
                                `
                              : this.state.callStatus === 'joining'
                                ? html`
                                    <div class="call-status">
                                      <div class="connecting-text">Connecting to call...</div>
                                    </div>
                                  `
                                : this.state.callStatus === 'connected'
                                  ? html`
                                      <div class="call-status">
                                        <div class="connecting-text">
                                          Establishing video connection...
                                        </div>
                                      </div>
                                    `
                                  : html` <div class="no-call-text">No active call</div> `}
                          </div>
                        </div>
                      `}
                </div>
              `
            : html`
                <!-- AI sphere when no call is active -->
                <div class="ai-visual-placeholder">
                  <gdm-live-audio-visuals-3d
                    .inputNode=${this.state.inputNode}
                    .outputNode=${this.state.outputNode}
                  ></gdm-live-audio-visuals-3d>
                </div>
              `}
        </div>
      </div>
    `;

    const renderWebcamWithSubtitles = (isPip: boolean = false) => html`
      ${this.state.isVideoLoading
        ? html`
            <div class="video-loading">
              <div class="loading-spinner"></div>
              <span>Starting camera...</span>
            </div>
          `
        : this.state.videoStream
          ? html`
              <video
                id="${isPip ? 'webcam-video-pip' : 'webcam-video'}"
                class="webcam-video"
                autoplay
                muted
                playsinline
              ></video>
              ${this.state.leftPanelMode === 'video' && this.state.videoInterimTranscript && !isPip
                ? html`
                    <div class="video-subtitle-overlay interim">
                      <div class="video-subtitle-text">${this.state.videoInterimTranscript}</div>
                    </div>
                  `
                : ''}
            `
          : this.state.isCameraStopped
            ? html`
                <div class="video-loading">
                  <span>Camera off</span>
                </div>
              `
            : html`
                <div class="video-loading">
                  <span>Camera not available</span>
                </div>
              `}
    `;

    // Local video for video calling
    const renderLocalVideo = () => {
      // Call active & layout NOT pip -> full size video fits container
      if (this.state.callStatus !== 'idle' && this.state.videoLayout !== 'pip') {
        return html`
          <video id="local-video" class="webcam-video" autoplay muted playsinline></video>
          ${this.state.videoInterimTranscript
            ? html`
                <div class="video-call-subtitle-overlay">
                  <div class="video-call-subtitle-text">${this.state.videoInterimTranscript}</div>
                </div>
              `
            : ''}
        `;
      }

      // Otherwise (idle or pip layout) -> small overlay container
      return html`
        <div class="local-video-container">
          ${this.state.localStream
            ? html`
                <video id="local-video" class="local-video" autoplay muted playsinline></video>
                <div class="video-label local-label">You</div>
              `
            : this.state.videoStream
              ? html`
                  <video
                    id="local-video-fallback"
                    class="local-video"
                    autoplay
                    muted
                    playsinline
                  ></video>
                  <div class="video-label local-label">You</div>
                `
              : html`
                  <div class="local-video-placeholder">
                    <span>Camera off</span>
                  </div>
                `}
        </div>
      `;
    };

    const webcamScreen = html`
      <div class="video-screen ${this.state.videoLayout === 'pip' ? 'main' : ''} webcam-screen">
        ${this.state.callStatus !== 'idle' ? renderLocalVideo() : renderWebcamWithSubtitles(false)}
      </div>
    `;

    // During video calls, always use two-screen layout regardless of PiP setting
    if (this.state.callStatus !== 'idle') {
      console.log(
        '🎥 [RENDER] Video call active, using two-screen layout. Call status:',
        this.state.callStatus
      );
      return html` ${waitingScreen} ${webcamScreen} `;
    }

    // Only show PiP layout when NOT in a call and layout is set to pip
    if (this.state.videoLayout === 'pip' && this.state.callStatus === 'idle') {
      console.log('🎥 [RENDER] No call active, using PiP layout');
      return html`
        ${waitingScreen}
        <div
          class="video-screen pip-overlay webcam-screen ${this.state.isDraggingPip ? 'dragging' : ''}"
          style="left: ${this.state.pipPosition.x}px; top: ${this.state.pipPosition.y}px;"
          @mousedown=${this.callbacks.handlePipDragStart}
        >
          ${renderWebcamWithSubtitles(true)}
        </div>
      `;
    } else {
      // Regular layouts (horizontal, vertical) or fallback when call is active
      console.log(
        '🎥 [RENDER] Using regular two-screen layout. Video layout:',
        this.state.videoLayout,
        'Call status:',
        this.state.callStatus
      );
      return html` ${waitingScreen} ${webcamScreen} `;
    }
  }

  /**
   * Renders video controls including camera, mic, and calling controls
   */
  private renderVideoControls(): TemplateResult {
    return html`
      <div class="video-controls">
        <select
          class="video-language-select"
          .value=${this.state.selectedVideoLanguage}
          @change=${(e: Event) =>
            (this.state.selectedVideoLanguage = (e.target as HTMLSelectElement).value)}
          title="Select language for speech recognition"
        >
          <option value="auto">🌐 Auto-detect</option>
          <option value="en">🇺🇸 English</option>
          <option value="es">🇪🇸 Spanish</option>
          <option value="pt">🇵🇹 Portuguese</option>
          <option value="fr">🇫🇷 French</option>
          <option value="de">🇩🇪 German</option>
          <option value="it">🇮🇹 Italian</option>
          <option value="ja">🇯🇵 Japanese</option>
          <option value="ko">🇰🇷 Korean</option>
          <option value="zh">🇨🇳 Chinese</option>
        </select>

        <button
          class="video-control-btn ${this.state.videoStream ? 'active' : ''}"
          @click=${this.state.videoStream
            ? this.callbacks.stopWebcam
            : this.callbacks.startWebcam}
          ?disabled=${this.state.isVideoLoading}
        >
          ${this.state.videoStream ? 'Stop Camera' : 'Start Camera'}
        </button>
        
        <button
          class="video-control-btn ${!this.state.isVideoMicMuted ? 'active' : ''}"
          @click=${this.callbacks.toggleVideoMic}
          title="${this.state.isVideoMicMuted
            ? 'Unmute microphone for subtitles'
            : 'Mute microphone (disable subtitles)'}"
        >
          ${this.state.isVideoMicMuted
            ? 'Mic Off'
            : this.state.videoConnectionStatus === 'connecting'
              ? 'Connecting...'
              : this.state.videoConnectionStatus === 'connected'
                ? 'Mic On'
                : this.state.videoConnectionStatus === 'error'
                  ? 'Mic Error'
                  : 'Mic On'}
        </button>

        <!-- Video Calling Controls -->
        <div class="video-calling-section">
          ${this.renderVideoCallingControls()}
        </div>
      </div>
    `;
  }

  /**
   * Renders video calling controls based on call status
   */
  private renderVideoCallingControls(): TemplateResult {
    if (this.state.callStatus === 'idle') {
      return html`
        <div class="profile-calling-group">
          <select
            class="profile-selector"
            .value=${this.state.selectedProfile}
            @change=${(e: Event) => {
              this.state.selectedProfile = (e.target as HTMLSelectElement).value;
            }}
            @focus=${this.callbacks.requestOnlineProfiles}
          >
            <option value="" disabled>Select a profile to call</option>
            ${this.state.profiles
              .filter(profile => profile !== this.state.currentProfile)
              .map((profile) => {
                const isOnline = this.state.onlineProfiles.includes(profile);
                return html`
                  <option 
                    value=${profile}
                    ?disabled=${!isOnline}
                    class="${isOnline ? 'online-profile' : 'offline-profile'}"
                  >
                    ${profile} ${isOnline ? '(online)' : '(offline)'}
                  </option>
                `;
              })}
          </select>
          <button
            class="video-control-btn call-profile-btn"
            @click=${this.callbacks.handleCallProfile}
            ?disabled=${!this.state.selectedProfile || 
                       !this.state.onlineProfiles.includes(this.state.selectedProfile)}
          >
            Call
          </button>
        </div>
      `;
    } else {
      return html`
        <button
          class="video-control-btn end-call-btn"
          @click=${this.callbacks.handleEndCall}
        >
          End Call
        </button>
      `;
    }
  }

  /**
   * Renders incoming call notification
   */
  renderIncomingCallNotification(): TemplateResult {
    if (!this.state.incomingCall) return html``;
    
    return html`
      <div class="incoming-call-overlay">
        <div class="incoming-call-dialog">
          <h3>Incoming Call</h3>
          <p>${this.state.incomingCall.callerProfile} is calling...</p>
          <div class="incoming-call-actions">
            <button 
              class="accept-call-btn" 
              @click=${this.callbacks.handleAcceptCall}
            >
              Accept
            </button>
            <button 
              class="reject-call-btn" 
              @click=${this.callbacks.handleRejectCall}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    `;
  }
}