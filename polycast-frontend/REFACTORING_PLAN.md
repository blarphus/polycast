# Comprehensive Plan to Reduce index.tsx to Under 2,500 Lines

## Current Status
- **Current size**: 6,669 lines
- **Target size**: < 2,500 lines  
- **Lines to extract**: ~4,200 lines

## Guiding Principles
1. **Zero functionality changes** - Only move code, never modify logic
2. **Maintain all bindings** - Preserve all `this` contexts and method calls
3. **Test after each phase** - Ensure functionality remains intact
4. **Use exact text extraction** - Copy/paste to prevent typos
5. **Incremental approach** - Small, reversible changes

## Phase 1: Audio & Voice Management (Est. -800 lines) ✅ COMPLETED (265 lines extracted)
**Target**: Extract all audio processing, voice selection, and OpenAI session management

### 1.1 Create `modules/audio-manager.ts`
- **Lines to extract**: ~800 lines
- **Content**:
  - Audio device management methods
  - Microphone selection logic
  - Audio context creation
  - Voice selection and loading
  - Audio worklet setup
  - WebM recording logic

### 1.2 Detailed extraction steps:
1. Search for all audio-related methods:
   - `initializeAudioDevices()` 
   - `loadAvailableVoices()`
   - `selectVoice()`
   - `updateMicrophoneSelection()`
   - `createAudioContext()`
   - `setupAudioWorklet()`
   - `startWebMRecording()`
   - `stopWebMRecording()`

2. Extract constants:
   - `RECORDING_CONFIG`
   - `DEFAULT_VOICE_OPTIONS`
   - Audio-related error messages

3. Create interface for audio state:
   ```typescript
   interface AudioManagerState {
     availableAudioDevices: MediaDeviceInfo[]
     selectedAudioDeviceId: string
     availableVoices: string[]
     selectedVoice: string
     audioContext: AudioContext | null
     // ... etc
   }
   ```

4. Verification steps:
   - Use `grep` to find all references to extracted methods
   - Update imports in index.tsx
   - Ensure all `this.` references are passed correctly

## Phase 2: OpenAI Session Management (Est. -600 lines) ⏸️ PENDING
**Target**: Extract OpenAI voice session initialization and event handling

### 2.1 Create `modules/openai-session-manager.ts`
- **Lines to extract**: ~600 lines
- **Content**:
  - `initClient()`
  - `initSession()`
  - All OpenAI event handlers
  - Session lifecycle management
  - VAD (Voice Activity Detection) setup

### 2.2 Detailed extraction steps:
1. Identify session-related code blocks:
   - OpenAI client initialization
   - Session creation and configuration
   - Event handler setup (onConnectionChange, onError, etc.)
   - Recording state management
   - Interrupt handling

2. Create callbacks interface:
   ```typescript
   interface OpenAISessionCallbacks {
     onStatusUpdate: (status: string) => void
     onTranscriptUpdate: (transcript: any) => void
     onModelSpeaking: (speaking: boolean) => void
     // ... etc
   }
   ```

3. Maintain state synchronization:
   - Pass component instance methods as callbacks
   - Ensure UIRenderer updates are preserved

## Phase 3: WebRTC & Video Calling (Est. -700 lines) ⏸️ PENDING
**Target**: Extract all WebRTC peer connection and signaling logic

### 3.1 Create `modules/webrtc-manager.ts`
- **Lines to extract**: ~700 lines
- **Content**:
  - Socket.io connection management
  - Peer connection creation
  - ICE candidate handling
  - Offer/Answer negotiation
  - Call state management

### 3.2 Detailed extraction steps:
1. Extract methods:
   - `connectToSignalingServer()`
   - `createPeerConnection()`
   - `handleOffer()`
   - `handleAnswer()`
   - `handleIceCandidate()`
   - `callProfile()`
   - `endCurrentCall()`

2. Extract WebRTC constants and configuration
3. Maintain event emitter patterns
4. Preserve error handling logic

## Phase 4: Dictionary & Flashcard Management (Est. -500 lines) ⏸️ PENDING
**Target**: Extract vocabulary learning features

### 4.1 Create `modules/learning-manager.ts`
- **Lines to extract**: ~500 lines
- **Content**:
  - Dictionary CRUD operations
  - Flashcard algorithm
  - Spaced repetition logic
  - Word frequency analysis
  - Import/export functionality

### 4.2 Detailed extraction steps:
1. Extract methods:
   - `addWordToDictionary()`
   - `deleteWordFromDictionary()`
   - `generateFlashcards()`
   - `handleFlashcardAnswer()`
   - `calculateNextInterval()`
   - `exportDictionary()`
   - `importDictionary()`

2. Extract interfaces:
   - `DictionaryEntry`
   - `Flashcard`
   - `StudySession`

## Phase 5: Transcript Processing (Est. -400 lines) ⏸️ PENDING
**Target**: Extract transcript management and evaluation

### 5.1 Create `modules/transcript-processor.ts`
- **Lines to extract**: ~400 lines
- **Content**:
  - Transcript history management
  - Word extraction and analysis
  - Evaluation API calls
  - Diagnostic session handling

### 5.2 Detailed extraction steps:
1. Extract methods:
   - `processTranscript()`
   - `extractWordsFromTranscript()`
   - `evaluateTranscript()`
   - `handleWordClick()`
   - `addToTranscriptHistory()`

## Phase 6: Profile & Storage Management (Est. -300 lines) ⏸️ PENDING
**Target**: Extract profile switching and localStorage operations

### 6.1 Create `modules/profile-manager.ts`
- **Lines to extract**: ~300 lines
- **Content**:
  - Profile CRUD operations
  - Language preferences
  - Data migration
  - Storage key management

## Phase 7: Event Handlers & Utilities (Est. -400 lines) ⏸️ PENDING
**Target**: Extract standalone event handlers and utility functions

### 7.1 Create `modules/event-handlers.ts`
- **Lines to extract**: ~200 lines
- **Content**:
  - Keyboard event handlers
  - Window event listeners
  - Resize handlers
  - Visibility change handlers

### 7.2 Create `modules/utilities.ts`
- **Lines to extract**: ~200 lines
- **Content**:
  - Helper functions
  - Formatters
  - Validators
  - Constants

## Phase 8: State Management Consolidation (Est. -300 lines) ⏸️ PENDING
**Target**: Create centralized state management

### 8.1 Create `modules/app-state.ts`
- **Lines to extract**: ~300 lines
- **Content**:
  - All `@state()` property declarations
  - Initial state values
  - State update methods
  - State persistence logic

## Phase 9: Component Lifecycle & Initialization (Est. -200 lines) ⏸️ PENDING
**Target**: Extract initialization and lifecycle methods

### 9.1 Create `modules/app-lifecycle.ts`
- **Lines to extract**: ~200 lines
- **Content**:
  - `firstUpdated()`
  - `connectedCallback()`
  - `disconnectedCallback()`
  - Initialization orchestration

## Verification Strategy for Each Phase

### Pre-extraction:
1. **Create git branch** for the phase
2. **Run full test suite** and document results
3. **Take screenshots** of all UI states
4. **Document current behavior** in detail

### During extraction:
1. **Use exact copy/paste** - no rewriting
2. **Search for all references** using grep/ack
3. **Update imports immediately**
4. **Preserve all comments**
5. **Maintain method signatures exactly**

### Post-extraction:
1. **Compile and fix imports**
2. **Test every extracted function**
3. **Compare UI screenshots**
4. **Run regression tests**
5. **Check browser console** for errors
6. **Verify state updates** work correctly

### Rollback plan:
- Keep each phase in separate commits
- Document any issues immediately
- Have ability to revert individual phases

## Risk Mitigation

1. **Binding issues**: Pass component instance to managers
2. **State synchronization**: Use callbacks and events
3. **Circular dependencies**: Plan import structure carefully
4. **Performance**: Lazy load where appropriate
5. **Type safety**: Maintain all TypeScript types

## Success Metrics
- File size: index.tsx < 2,500 lines
- Zero functionality changes
- All tests passing
- No runtime errors
- Performance unchanged or improved
- Code remains maintainable

## Final Structure Preview
```
polycast-frontend/
├── index.tsx (< 2,500 lines - main component shell)
├── modules/
│   ├── ui-renderer.ts (existing)
│   ├── audio-manager.ts
│   ├── openai-session-manager.ts
│   ├── webrtc-manager.ts
│   ├── learning-manager.ts
│   ├── transcript-processor.ts
│   ├── profile-manager.ts
│   ├── event-handlers.ts
│   ├── utilities.ts
│   └── app-state.ts
```

This plan will reduce index.tsx from 6,669 lines to approximately 2,400 lines while maintaining 100% functionality through careful, methodical extraction.

## Progress Log
- **Started**: Phase 1 - Audio & Voice Management
- **Completed**: Phase 1 - Audio & Voice Management (265 lines extracted)
- **Current Status**: Phase 1 complete, ready for testing. Audio manager module created with:
  - Audio device management methods (initAudio, enumerateAudioDevices, selectAudioDevice, handleMicrophoneButtonClick, closeMicrophoneSelector)
  - Voice selection methods (initializeAvailableVoices, toggleVoiceSelector, selectVoice, handleClickOutsideVoiceSelector)
  - Complete state management and callback interfaces
  - Ready for integration with main component

**Next Step**: Integrate audio-manager.ts with index.tsx and test functionality before proceeding to Phase 2