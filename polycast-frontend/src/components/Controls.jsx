import React from 'react';
import PropTypes from 'prop-types';
import { ReadyState } from 'react-use-websocket';

/**
 * Component for mode controls, language selection, font size, and recording indicator.
 */
function Controls({ 
    readyState,
    isRecording, 
    isTextMode,
    setIsTextMode, 
}) {
    const isConnected = readyState === ReadyState.OPEN;

    return (
        <div className="controls">
            {/* Recording Indicator */} 
            {!isTextMode && isRecording && (
              <div style={{ 
                position: 'absolute', // Position near controls
                top: '-25px', // Above the main controls row
                left: '50%', 
                transform: 'translateX(-50%)', 
                color: '#ff5733', // Bright color for visibility
                fontSize: '16px', 
                fontWeight: 'bold', 
                padding: '2px 8px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
              }}>
                Recording...
              </div>
            )}

            {/* Mode Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#ccc', fontSize: 15, fontWeight: 500 }}>Mode:</label>
                <select 
                    value={isTextMode ? 'text' : 'audio'}
                    onChange={e => setIsTextMode(e.target.value === 'text')}
                    style={{ minWidth: 90, fontSize: 15, padding: '2px 6px', borderRadius: 6 }}
                    disabled={isRecording} // Disable mode switch while recording
                >
                    <option value="text">text mode</option>
                    <option value="audio">audio mode</option>
                </select>
            </div>
            {/* Show Live English Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 24 }}>
                <label style={{ color: '#ccc', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                        type="checkbox"
                        checked={typeof window.showLiveEnglish === 'function' ? window.showLiveEnglish() : true}
                        onChange={e => window.dispatchEvent(new CustomEvent('toggleLiveEnglish', { detail: e.target.checked }))}
                        style={{ marginRight: 5 }}
                    />
                    Show Live English
                </label>
            </div>
            {/* Font size controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 18 }}>
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('changeFontSize', { detail: -2 }))}
                    style={{
                        background: '#23233a', color: '#fff', border: 'none', borderRadius: 6, width: 34, height: 34,
                        fontSize: 24, fontWeight: 700, boxShadow: '0 2px 8px #0002', cursor: 'pointer', transition: 'background 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Decrease font size"
                >
                    <span style={{ position: 'relative', top: -2 }}>–</span>
                </button>
                <span id="font-size-display" style={{ color: '#aaa', fontSize: 17, fontWeight: 500, minWidth: 44, textAlign: 'center' }}></span>
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('changeFontSize', { detail: 2 }))}
                    style={{
                        background: '#23233a', color: '#fff', border: 'none', borderRadius: 6, width: 34, height: 34,
                        fontSize: 24, fontWeight: 700, boxShadow: '0 2px 8px #0002', cursor: 'pointer', transition: 'background 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Increase font size"
                >
                    <span style={{ position: 'relative', top: -2 }}>+</span>
                </button>
            </div>
        </div>
    );
}

Controls.propTypes = {
    readyState: PropTypes.number.isRequired,
    isRecording: PropTypes.bool.isRequired,
    isTextMode: PropTypes.bool.isRequired,
    setIsTextMode: PropTypes.func.isRequired,
};

export default Controls;
