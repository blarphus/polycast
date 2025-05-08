import React from 'react';
import PropTypes from 'prop-types';
import './WordDefinitionPopup.css';

const WordDefinitionPopup = ({ word, definition, position, onClose }) => {
  if (!word || !definition) return null;
  
  // Ensure definition data exists and handle all possible dictionary response formats
  const meanings = definition.meanings || [];
  const synonyms = definition.synonyms || [];
  const examples = definition.examples || [];
  
  // Look for translations in multiple possible locations in the API response
  const translation = definition.translation || 
                    (definition.translations && definition.translations.es) || 
                    (definition.translations && definition.translations.Spanish) || 
                    '';
  
  // Calculate positioning to be right next to the clicked word
  // Try to position above the word first, but near it
  const windowHeight = window.innerHeight;
  const isNearBottom = position.y > windowHeight - 200;
  
  return (
    <div 
      className="word-definition-popup"
      style={{
        // Position right above the word if near bottom of screen, otherwise below
        top: isNearBottom ? `${position.y - 10}px` : `${position.y + 25}px`,
        left: `${position.x}px`,
        transformOrigin: isNearBottom ? 'bottom left' : 'top left'
      }}
    >
      {/* Close button */}
      <button className="popup-close-btn" onClick={onClose}>×</button>
      
      {/* Word section - simplified like Netflix */}
      <div className="popup-header">
        <div className="popup-section-title">Synonyms:</div>
        <div className="popup-word">{word}</div>
        {/* Only show a few synonyms at most */}
        <div className="popup-synonyms">
          {synonyms.length > 0 ? synonyms.slice(0, 5).join(', ') : 'N/A'}
        </div>
      </div>
      
      {/* Netflix-style examples section */}
      <div className="popup-section">
        <div className="popup-section-title">Examples:</div>
        <div className="popup-examples">
          {examples.length > 0 ? (
            examples.slice(0, 3).map((example, index) => (
              <div key={index} className="popup-example">{example}</div>
            ))
          ) : (
            <div className="popup-example">No examples available</div>
          )}
        </div>
      </div>
      
      {/* Translation section (if available) */}
      {translation && (
        <div className="popup-section">
          <div className="popup-section-title">Spanish:</div>
          <div className="popup-translation">{translation}</div>
        </div>
      )}
    </div>
  );
};

WordDefinitionPopup.propTypes = {
  word: PropTypes.string,
  definition: PropTypes.object,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

export default WordDefinitionPopup;
