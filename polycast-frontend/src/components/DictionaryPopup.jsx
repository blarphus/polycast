import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Netflix-style popup for displaying word definitions
 */
const DictionaryPopup = ({ 
  word, 
  position, 
  definition, 
  isVisible, 
  onClose 
}) => {
  const popupRef = useRef(null);

  useEffect(() => {
    // Close popup when clicking outside
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  if (!isVisible || !word || !position) return null;

  // Generate examples from definition data
  const examples = definition?.examples || [];
  
  return (
    <div 
      ref={popupRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth: '400px',
        width: 'auto',
        backgroundColor: 'rgba(31, 31, 31, 0.95)',
        color: 'white',
        borderRadius: '4px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        padding: '12px 16px',
        fontSize: '14px',
        lineHeight: '1.4',
        animation: 'fadeIn 0.2s',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(4px)',
        filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.15))',
        maxHeight: '300px',
        overflowY: 'auto',
        cursor: 'default',
      }}
    >
      {/* Close button */}
      <div 
        style={{
          position: 'absolute',
          right: '8px',
          top: '8px',
          cursor: 'pointer',
          fontSize: '16px',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          color: 'rgba(255, 255, 255, 0.7)',
        }}
        onClick={onClose}
      >
        ✕
      </div>

      {/* Word with synonyms */}
      <div style={{ marginBottom: '12px', paddingRight: '20px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: '600' }}>
          {word}
        </h3>
        {definition?.synonyms && (
          <div style={{ color: '#aaa', fontSize: '14px' }}>
            Synonyms: {definition.synonyms.join(', ')}
          </div>
        )}
      </div>

      {/* Spanish translation */}
      {definition?.translation && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: '#4ad991', fontWeight: '500', marginBottom: '4px' }}>
            Translation
          </div>
          <div>{definition.translation}</div>
        </div>
      )}

      {/* Examples section */}
      {examples.length > 0 && (
        <div>
          <div style={{ 
            fontSize: '14px', 
            color: '#aaa', 
            marginBottom: '4px',
            paddingTop: '4px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            Examples
          </div>
          <div>
            {examples.map((example, index) => (
              <div 
                key={index} 
                style={{ 
                  marginBottom: index < examples.length - 1 ? '8px' : 0,
                  color: '#ddd',
                  fontSize: '13px'
                }}
              >
                {example}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div 
          style={{
            fontSize: '13px',
            color: '#ffb84d',
            opacity: 0.85,
            padding: '2px 0'
          }}
        >
          Word saved to your dictionary
        </div>
      </div>
    </div>
  );
};

DictionaryPopup.propTypes = {
  word: PropTypes.string,
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number
  }),
  definition: PropTypes.object,
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export default DictionaryPopup;
