import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Component for displaying a popup with word definition and status
 */
const WordPopup = ({ word, position, isLoading, definitionData, onClose }) => {
  // Function to get Spanish translation
  const getSpanishTranslation = (word) => {
    // Common English to Spanish translations (simplified dictionary)
    const translations = {
      'testing': 'prueba',
      'time': 'tiempo',
      'baby': 'bebé',
      'let': 'dejar',
      'go': 'ir',
      'hello': 'hola',
      'world': 'mundo',
      'good': 'bueno',
      'day': 'día',
      'night': 'noche',
      'morning': 'mañana',
      'evening': 'tarde',
      'test': 'prueba',
      'example': 'ejemplo',
      'word': 'palabra',
      'sentence': 'frase',
      'language': 'idioma',
      'speak': 'hablar',
      'listen': 'escuchar',
      'understand': 'entender',
      'dictionary': 'diccionario',
      'learn': 'aprender',
      'teach': 'enseñar',
      'study': 'estudiar',
      'practice': 'practicar',
      'translate': 'traducir',
      'student': 'estudiante',
      'teacher': 'profesor',
      'class': 'clase'
    };
    
    return translations[word.toLowerCase()] || word;
  };
  const popupRef = useRef(null);

  // Add CSS for the spinning loader animation
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);

    // Add click outside handler
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Add the event listener
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.head.removeChild(styleEl);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Safely extract information from definitionData
  const partOfSpeech = definitionData?.partOfSpeech || '';
  const definition = definitionData?.displayDefinition || definitionData?.definition || '';

  return (
    <div 
      ref={popupRef}
      style={{
        position: 'fixed', // Using fixed to ensure it shows at the right position
        top: `${position.y}px`,
        left: `${position.x + 5}px`, // Position it slightly to the right of the click position
        backgroundColor: 'rgba(28, 28, 30, 0.95)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        borderRadius: '4px',
        padding: '10px 14px',
        maxWidth: '280px',
        zIndex: 1000,
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
      }}>
      {/* Close button - X in the top right */}
      <button 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          background: 'none',
          border: 'none',
          color: '#aaa',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>

      {/* Content area */}
      <div style={{ paddingRight: '20px' }}>
        {isLoading ? (
          /* Loading state */
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', padding: '5px 0' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              border: '2px solid #5a5aff',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
            }} />
            <span>Translating...</span>
          </div>
        ) : (
          /* Definition display */
          <div>
            {/* Part of speech and word added tag */}
            <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ color: '#b0b0ff', fontStyle: 'italic', fontSize: '12px' }}>
                {partOfSpeech}
              </div>
              <div style={{ color: '#6debb5', fontSize: '11px', marginLeft: 'auto' }}>
                Added to dictionary
              </div>
            </div>
            
            {/* Spanish translation - larger text */}
            <div style={{ 
              fontSize: '18px',
              fontWeight: 'bold',
              margin: '8px 0',
              color: '#ffcc80',
              textAlign: 'center'
            }}>
              {getSpanishTranslation(word)}
            </div>
            
            {/* Main definition */}
            <div style={{ 
              fontSize: '13px',
              lineHeight: '1.4',
              margin: '4px 0',
              wordBreak: 'break-word'
            }}>
              {definition}
            </div>
            
            {/* Synonyms section (similar to Netflix example) */}
            {definitionData?.synonyms && (
              <div style={{ 
                fontSize: '12px',
                color: '#aaa',
                marginTop: '6px'
              }}>
                <span style={{ color: '#999' }}>Synonyms: </span>
                {definitionData.synonyms}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

WordPopup.propTypes = {
  word: PropTypes.string.isRequired,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  isLoading: PropTypes.bool,
  definitionData: PropTypes.object,
  onClose: PropTypes.func.isRequired
};

WordPopup.defaultProps = {
  definitionData: null,
  isLoading: false
};

export default WordPopup;
