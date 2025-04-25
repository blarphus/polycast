import React from 'react';
import PropTypes from 'prop-types';
import { ReadyState } from 'react-use-websocket';

/**
 * Component for Start/Stop buttons ONLY.
 */
function Controls({
    readyState,
    isRecording,
    onStartRecording,
    onStopRecording,
    // Removed language props
}) {
    const isConnected = readyState === ReadyState.OPEN;

    return (
        <div className="controls">
            <button
                onClick={onStartRecording}
                disabled={!isConnected || isRecording}
            >
                Start Recording
            </button>
            <button
                onClick={onStopRecording}
                disabled={!isConnected || !isRecording}
            >
                Stop Recording
            </button>
            {/* Removed language input */}
        </div>
    );
}

Controls.propTypes = {
    readyState: PropTypes.number.isRequired,
    isRecording: PropTypes.bool.isRequired,
    onStartRecording: PropTypes.func.isRequired,
    onStopRecording: PropTypes.func.isRequired,
    // Removed language prop types
};

export default Controls;
