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
  
  // AI mode state
  isRecording: boolean;
  openAIVoiceSession: any;
  isInitializingSession: boolean;
  isModelSpeaking: boolean;
  hasMicrophone: boolean;
  availableAudioDevices: { deviceId: string; label: string }[];
  selectedAudioDeviceId: string;
  selectedVoice: string;
  availableVoices: string[];
  error: string;
  status: string;
  inputNode?: AudioNode;
  outputNode?: GainNode;
  
  // Right panel state
  activeTab: 'transcript' | 'dictionary' | 'flashcards' | 'evaluate';
  transcriptHistory: any[];
  fontSize: number;
  knownWordForms: Set<string>;
  searchQuery: string;
  sortBy: 'frequency' | 'alphabetical' | 'date';
  dictionaryEntries: any[];
  expandedWords: Set<string>;
  currentProfile: string;
  flashcards: any[];
  currentCardIndex: number;
  isFlipped: boolean;
  evaluationResult: any;
  isEvaluating: boolean;
  diagnosticSession: any;
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
  
  // AI mode callbacks
  startRecording: () => void;
  stopRecording: () => void;
  handleMicrophoneButtonClick: () => void;
  selectVoice: (voice: string) => void;
  
  // Right panel callbacks
  handleTabClick: (tab: 'transcript' | 'dictionary' | 'flashcards' | 'evaluate') => void;
  handleWordClick: (word: string) => void;
  handleTextMessage: (message: string) => void;
  handleSearchInput: (query: string) => void;
  handleSortChange: (sortBy: 'frequency' | 'alphabetical' | 'date') => void;
  toggleWordExpansion: (word: string) => void;
  deleteWord: (word: string) => void;
  handleFlashcardAnswer: (correct: boolean) => void;
  handleEvaluateTranscript: () => void;
  retryEvaluation: () => void;
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
  }

  /**
   * Renders the complete left panel interface based on current mode
   */
  renderLeftPanelInterface(): TemplateResult {
    return this.state.leftPanelMode === 'video' 
      ? this.renderVideoInterface()
      : this.renderAIInterface();
  }

  /**
   * Renders the AI mode interface including recording controls and 3D visuals
   */
  renderAIInterface(): TemplateResult {
    return html`
      <!-- AI Mode Interface -->
      <div class="controls">
        <button
          id="recordButton"
          @click=${this.state.isRecording ? this.callbacks.stopRecording : this.callbacks.startRecording}
          ?disabled=${!this.state.openAIVoiceSession ||
          this.state.isInitializingSession ||
          this.state.isModelSpeaking}
          class="${this.state.isRecording ? 'recording' : 'not-recording'}"
          aria-label="${this.state.isRecording ? 'Stop Recording' : 'Start Recording'}"
        >
          ${this.state.isRecording
            ? html`
                <svg
                  viewBox="0 0 100 100"
                  width="40px"
                  height="40px"
                  fill="#ffffff"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="15" y="15" width="70" height="70" rx="10" />
                </svg>
              `
            : html`
                <svg
                  viewBox="0 0 100 100"
                  width="40px"
                  height="40px"
                  fill="#c80000"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="50" cy="50" r="45" />
                </svg>
              `}
        </button>

        <!-- Audio Controls -->
        <div class="audio-controls">
          <button
            class="microphone-selector-button ${this.state.hasMicrophone
              ? ''
              : 'no-microphone'}"
            @click=${this.callbacks.handleMicrophoneButtonClick}
            title="${this.state.hasMicrophone
              ? 'Select microphone device'
              : 'No microphone detected'}"
            aria-label="Microphone device selector"
          >
            <span class="mic-icon">Mic</span>
            <span class="mic-label"
              >${this.state.hasMicrophone
                ? (() => {
                    const device = this.state.availableAudioDevices.find(
                      (d) => d.deviceId === this.state.selectedAudioDeviceId
                    );
                    const label = device?.label?.replace(/^Default - /, '') || 'Default';
                    return label.length > 20 ? label.substring(0, 20) + '...' : label;
                  })()
                : 'No Mic'}</span
            >
            <span class="dropdown-arrow">▼</span>
          </button>

          <select
            class="voice-selector"
            .value=${this.state.selectedVoice}
            @change=${(e: Event) =>
              this.callbacks.selectVoice((e.target as HTMLSelectElement).value)}
            title="Select AI voice"
            aria-label="AI voice selector"
          >
            ${this.state.availableVoices.map(
              (voice) => html` <option value=${voice}>${voice}</option> `
            )}
          </select>
        </div>
      </div>
      <div id="status" role="status" aria-live="polite">${this.state.error || this.state.status}</div>
      <gdm-live-audio-visuals-3d
        .inputNode=${this.state.inputNode}
        .outputNode=${this.state.outputNode}
      ></gdm-live-audio-visuals-3d>
    `;
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
      return html` ${waitingScreen} ${webcamScreen} `;
    }

    // Only show PiP layout when NOT in a call and layout is set to pip
    if (this.state.videoLayout === 'pip' && this.state.callStatus === 'idle') {
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

  /**
   * Renders the complete right panel interface with tabs and content
   */
  renderRightPanel(): TemplateResult {
    // Tab button classes computation
    const transcriptButtonClasses = `tab-button ${
      this.state.activeTab === 'transcript' ? 'active' : ''
    }`;
    const dictionaryButtonClasses = `tab-button ${
      this.state.activeTab === 'dictionary' ? 'active' : ''
    }`;
    const flashcardsButtonClasses = `tab-button ${
      this.state.activeTab === 'flashcards' ? 'active' : ''
    }`;
    const evaluateButtonClasses = `tab-button ${
      this.state.activeTab === 'evaluate' ? 'active' : ''
    }`;

    // Dictionary filtering and sorting
    const filteredDictionaryEntries = this.state.dictionaryEntries
      .filter(entry => 
        !this.state.searchQuery || 
        entry.word.toLowerCase().includes(this.state.searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        switch (this.state.sortBy) {
          case 'frequency':
            return (b.frequency || 0) - (a.frequency || 0);
          case 'alphabetical':
            return a.word.localeCompare(b.word);
          case 'date':
            return new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime();
          default:
            return 0;
        }
      });

    // Flashcard computation
    const currentFlashcard = this.state.flashcards[this.state.currentCardIndex];
    const currentCardId = currentFlashcard?.id;
    const currentInterval = currentFlashcard?.interval || 1;

    return html`
      <div class="right-panel">
        <div class="tabs">
          <button
            class="${transcriptButtonClasses}"
            @click=${() => this.callbacks.handleTabClick('transcript')}
          >
            Transcript
          </button>
          <button
            class="${dictionaryButtonClasses}"
            @click=${() => this.callbacks.handleTabClick('dictionary')}
          >
            Dictionary (${this.state.currentProfile})
          </button>
          <button
            class="${flashcardsButtonClasses}"
            @click=${() => this.callbacks.handleTabClick('flashcards')}
          >
            Flashcards (${this.state.currentProfile})
          </button>
          <button
            class="${evaluateButtonClasses}"
            @click=${() => this.callbacks.handleTabClick('evaluate')}
          >
            ${this.state.diagnosticSession
              ? html`
                  <span style="color: #ff6b6b; font-weight: bold;">Evaluate*</span>
                  <span
                    class="diagnostic-indicator"
                    title="Diagnostic session active - evaluation recommended"
                    >!</span
                  >
                `
              : 'Evaluate'}
          </button>
        </div>

        ${this.state.activeTab === 'transcript'
          ? html`
              <transcript-viewer
                .transcriptHistory=${this.state.transcriptHistory}
                .fontSize=${this.state.fontSize}
                .knownWordForms=${this.state.knownWordForms}
                @word-click=${(e: CustomEvent) => this.callbacks.handleWordClick(e.detail.word)}
                @text-message=${(e: CustomEvent) => this.callbacks.handleTextMessage(e.detail.message)}
              ></transcript-viewer>
            `
          : this.state.activeTab === 'dictionary'
            ? this.renderDictionaryContent(filteredDictionaryEntries)
            : this.state.activeTab === 'flashcards'
              ? this.renderFlashcardsContent(currentFlashcard, currentCardId, currentInterval)
              : this.renderEvaluateContent()}
      </div>
    `;
  }

  /**
   * Renders dictionary tab content
   */
  private renderDictionaryContent(filteredEntries: any[]): TemplateResult {
    return html`
      <div class="dictionary-content">
        <div class="dictionary-controls">
          <div class="search-container">
            <input
              type="text"
              class="dictionary-search"
              placeholder="Search words (press / to focus)"
              .value=${this.state.searchQuery}
              @input=${(e: Event) => 
                this.callbacks.handleSearchInput((e.target as HTMLInputElement).value)}
            />
            <div class="word-count">
              ${filteredEntries.length} word${filteredEntries.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div class="sort-controls">
            <label for="dictionary-sort">Sort by:</label>
            <select
              id="dictionary-sort"
              class="sort-select"
              .value=${this.state.sortBy}
              @change=${(e: Event) => 
                this.callbacks.handleSortChange((e.target as HTMLSelectElement).value as any)}
            >
              <option value="frequency">Frequency</option>
              <option value="alphabetical">A-Z</option>
              <option value="date">Date Added</option>
            </select>
            <button
              class="frequency-guide-btn"
              title="Frequency information not available"
              disabled
            >
              ?
            </button>
          </div>
        </div>
        <div class="dictionary-list">
          ${filteredEntries.map(
            (entry) => html`
              <div class="dictionary-entry">
                <div class="entry-header" @click=${() => this.callbacks.toggleWordExpansion(entry.word)}>
                  <span class="word">${entry.word}</span>
                  <div class="entry-meta">
                    ${entry.frequency
                      ? html`
                          <span class="frequency">Rank: ${entry.frequency}</span>
                        `
                      : ''}
                    <button
                      class="delete-word-btn"
                      @click=${(e: Event) => {
                        e.stopPropagation();
                        this.callbacks.deleteWord(entry.word);
                      }}
                      title="Delete word"
                    >
                      ×
                    </button>
                    <span class="expand-icon">
                      ${this.state.expandedWords.has(entry.word) ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
                ${this.state.expandedWords.has(entry.word)
                  ? html`
                      <div class="entry-details">
                        ${entry.translation
                          ? html` <div class="translation">${entry.translation}</div> `
                          : ''}
                        ${entry.definition
                          ? html` <div class="definition">${entry.definition}</div> `
                          : ''}
                        ${entry.context
                          ? html`
                              <div class="context">
                                <strong>Context:</strong> ${entry.context}
                              </div>
                            `
                          : ''}
                      </div>
                    `
                  : ''}
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  /**
   * Renders flashcards tab content
   */
  private renderFlashcardsContent(currentFlashcard: any, currentCardId: string, currentInterval: number): TemplateResult {
    return html`
      <flashcard-manager
        .flashcards=${this.state.flashcards}
        .currentCardIndex=${this.state.currentCardIndex}
        .isFlipped=${this.state.isFlipped}
        .currentCardId=${currentCardId}
        .currentInterval=${currentInterval}
        @answer=${(e: CustomEvent) => this.callbacks.handleFlashcardAnswer(e.detail.correct)}
      ></flashcard-manager>
    `;
  }

  /**
   * Renders evaluate tab content
   */
  private renderEvaluateContent(): TemplateResult {
    return html`
      <div class="evaluate-content">
        ${this.state.diagnosticSession
          ? html`
              <div class="diagnostic-banner">
                <p>
                  <strong>Diagnostic Session Active</strong><br />
                  Complete evaluation to help improve your learning experience.
                </p>
              </div>
            `
          : ''}
        <div class="evaluate-controls">
          <button
            class="evaluate-btn"
            @click=${this.callbacks.handleEvaluateTranscript}
            ?disabled=${this.state.isEvaluating}
          >
            ${this.state.isEvaluating ? 'Evaluating...' : 'Evaluate Transcript'}
          </button>
        </div>
        ${this.state.evaluationResult
          ? html`
              <div class="evaluation-result">
                <h3>Evaluation Results</h3>
                <div class="result-content">
                  ${this.state.evaluationResult.error
                    ? html`
                        <div class="error-message">
                          <p>Error: ${this.state.evaluationResult.error}</p>
                          <button 
                            class="retry-btn" 
                            @click=${this.callbacks.retryEvaluation}
                          >
                            Retry
                          </button>
                        </div>
                      `
                    : html`
                        <div class="evaluation-success">
                          <p><strong>CEFR Level:</strong> ${this.state.evaluationResult.level || 'N/A'}</p>
                          <p><strong>Areas for Improvement:</strong></p>
                          <ul>
                            ${(this.state.evaluationResult.improvements || []).map(
                              (improvement: string) => html`<li>${improvement}</li>`
                            )}
                          </ul>
                        </div>
                      `}
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }
}