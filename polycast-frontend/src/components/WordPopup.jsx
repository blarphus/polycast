import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Component for displaying a popup with word definition and status
 */
const WordPopup = ({ word, position, onClose, definitionData, isLoading }) => {
  const [visible, setVisible] = useState(false);
  
  // Animation effect to fade in the popup
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 10);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Close the popup after 3 seconds if it's not in loading state
  useEffect(() => {
    if (!isLoading && definitionData) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onClose(), 300); // Allow time for fade-out animation
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, definitionData, onClose]);
  
  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 300); // Allow time for fade-out animation
  };
  
  return (
    <div 
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y + 30}px`,
        zIndex: 1000,
        backgroundColor: '#232338',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        padding: '12px 16px',
        minWidth: '240px',
        maxWidth: '320px',
        color: '#fff',
        transition: 'opacity 0.3s, transform 0.3s',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-10px)',
        pointerEvents: 'auto',
        border: '1px solid #3a3a55',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: '0', color: '#7c62ff', fontSize: '18px' }}>{word}</h3>
        <button 
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa' }}>
            <div style={{ 
              width: '14px', 
              height: '14px', 
              borderRadius: '50%', 
              border: '2px solid #5a5aff',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
            }} />
            <span>Analyzing word in context...</span>
          </div>
        ) : definitionData ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ color: '#b0b0ff', fontStyle: 'italic', fontSize: '13px' }}>
                {(definitionData && definitionData.partOfSpeech) || ''}
              </div>
              <div style={{ color: '#6debb5', fontSize: '13px', fontWeight: '500' }}>
                Word added to dictionary
              </div>
            </div>
            <div style={{ lineHeight: '1.4' }}>
              {(definitionData && (definitionData.displayDefinition || definitionData.definition)) || `Definition for "${word}"`}
            </div>
            {definitionData && definitionData.exampleSentence && (
              <div style={{ 
                marginTop: '8px', 
                color: '#b0b0c0', 
                fontStyle: 'italic',
                borderLeft: '2px solid #5a5aff',
                paddingLeft: '8px' 
              }}>
                {definitionData.exampleSentence}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: '#ff6b6b' }}>
            Couldn't find definition for this word.
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

WordPopup.propTypes = {
  word: PropTypes.string.isRequired,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  definitionData: PropTypes.object,
  isLoading: PropTypes.bool,
};

WordPopup.defaultProps = {
  definitionData: null,
  isLoading: false,
};

export default WordPopup;
