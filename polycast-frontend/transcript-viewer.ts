import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TranscriptMessage } from './types.js';

@customElement('transcript-viewer')
export class TranscriptViewer extends LitElement {
  @property({ attribute: false }) transcriptHistory: TranscriptMessage[] = [];
  @property({ type: Number }) transcriptFontSize = 26;
  @property({ attribute: false }) knownWordForms: Set<string> = new Set();
  @property({ type: Boolean }) showTextInput = false;
  @state() private textInput = '';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .transcript-messages-container {
      flex-grow: 1;
      overflow-y: auto;
      padding: 20px;
    }
    .transcript-messages {
      display: flex;
      flex-direction: column;
      gap: 0px;
    }
    .transcript-message {
      background-color: #3c3152;
      padding: 8px 12px;
      line-height: 1.5;
      color: #e0e0e0;
      word-wrap: break-word;
      margin-top: 0;
      margin-bottom: 0;
      border-radius: 10px;
    }
    .transcript-message.user {
      background-color: #34495e;
      color: #ecf0f1;
    }
    .clickable-word {
      cursor: pointer;
      text-decoration: underline;
      text-decoration-color: #a093c4;
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
      padding-bottom: 1px;
    }
    .clickable-word.known-word {
      color: #60a5fa;
      text-decoration-color: #93c5fd;
    }
    .text-input-container {
      padding: 12px;
      background-color: #2a2139;
      border-top: 1px solid #3c3152;
      display: flex;
      gap: 8px;
    }
    .text-input {
      flex-grow: 1;
      background-color: #3c3152;
      color: #e0e0e0;
      border: 1px solid #4a3f63;
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s ease;
    }
    .text-input:focus {
      border-color: #8a5cf5;
    }
    .text-input::placeholder {
      color: #8a80a5;
    }
    .send-button {
      background-color: #8a5cf5;
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s ease;
      flex-shrink: 0;
    }
    .send-button:hover:not(:disabled) {
      background-color: #794ee2;
    }
    .send-button:disabled {
      background-color: #4a3f63;
      cursor: not-allowed;
    }
    .send-icon {
      width: 20px;
      height: 20px;
    }
  `;

  private renderMessage(text: string) {
    const tokens = text.split(/(\s+)/);
    return tokens.map((token) => {
      if (token.trim() === '') return token;
      const key = token.replace(/[.,!?;:()"']/g, '').toLowerCase();
      const known = this.knownWordForms.has(key);
      return html`<span
        class="clickable-word ${known ? 'known-word' : ''}"
        @click=${(e: MouseEvent) => {
          this.dispatchEvent(
            new CustomEvent('word-click', {
              detail: { word: token, sentence: text, event: e },
              bubbles: true,
              composed: true,
            })
          );
        }}
      >
        ${token}
      </span>`;
    });
  }

  private handleTextInput(e: Event) {
    this.textInput = (e.target as HTMLInputElement).value;
  }

  private handleSendMessage() {
    if (this.textInput.trim()) {
      this.dispatchEvent(
        new CustomEvent('text-message', {
          detail: { text: this.textInput.trim() },
          bubbles: true,
          composed: true,
        })
      );
      this.textInput = '';
    }
  }

  private handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSendMessage();
    }
  }

  render() {
    return html`
      <div class="transcript-messages-container">
        <div class="transcript-messages">
          ${this.transcriptHistory.map(
            (msg, index, arr) => html`
              <p
                class="transcript-message ${msg.speaker === 'user' ? 'user' : ''} ${index ===
                arr.length - 1
                  ? 'latest'
                  : ''}"
                style="font-size: ${this.transcriptFontSize}px;"
                data-speaker=${msg.speaker}
              >
                ${this.renderMessage(msg.text)}
              </p>
            `
          )}
        </div>
      </div>
      ${this.showTextInput
        ? html`
            <div class="text-input-container">
              <input
                type="text"
                class="text-input"
                placeholder="Type a message..."
                .value=${this.textInput}
                @input=${this.handleTextInput}
                @keypress=${this.handleKeyPress}
              />
              <button
                class="send-button"
                @click=${this.handleSendMessage}
                ?disabled=${!this.textInput.trim()}
                aria-label="Send message"
              >
                <svg
                  class="send-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22 2L11 13"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M22 2L15 22L11 13L2 9L22 2Z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          `
        : ''}
    `;
  }
}
