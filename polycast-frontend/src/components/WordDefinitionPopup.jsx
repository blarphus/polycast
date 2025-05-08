import React from 'react';
import PropTypes from 'prop-types';
import './WordDefinitionPopup.css';

const WordDefinitionPopup = ({ word, definition, dictDefinition, position, onClose }) => {
  if (!word || (!definition && !dictDefinition)) return null;
  
  // Ensure definition data exists and handle all possible dictionary response formats
  const partOfSpeech = definition?.partOfSpeech || 
                        (definition?.meanings && definition.meanings[0] && definition.meanings[0].partOfSpeech) ||
                        '';
  
  const fullDefinition = definition?.definition ||
                         (definition?.meanings && definition.meanings[0] && definition.meanings[0].definition) ||
                         '';
  
  const examples = definition?.examples || [];
  
  // Look for translations in multiple possible locations in the API response
  const translation = definition?.translation || 
                     (definition?.translations && definition.translations.es) || 
                     (definition?.translations && definition.translations.Spanish) || 
                     '';
  
  // Format dictionary definition from JSON file
  let dictPartOfSpeech = '';
  let dictFullDefinition = '';
  
  if (dictDefinition && Object.keys(dictDefinition).length > 0) {
    // Get the first meaning key
    const firstMeaningKey = Object.keys(dictDefinition.MEANINGS || {})[0];
    if (firstMeaningKey) {
      const meaning = dictDefinition.MEANINGS[firstMeaningKey];
      dictPartOfSpeech = meaning[0] || ''; // First element is part of speech
      dictFullDefinition = meaning[1] || ''; // Second element is definition
    }
  }
  
  // Calculate positioning to be right next to the clicked word
  const viewportWidth = window.innerWidth;
  const popupWidth = 380; // Match width from CSS
  
  // Calculate optimal position to avoid going off screen
  const spaceOnRight = viewportWidth - position.x;
  const fitsOnRight = spaceOnRight >= popupWidth + 10;
  
  // Position to the right if there's room, otherwise to the left
  const xPos = fitsOnRight ? position.x + 5 : position.x - popupWidth - 5;
  
  return (
    <div 
      className="word-definition-popup"
      style={{
        top: `${position.y + 25}px`,
        left: `${Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos))}px`,
      }}
    >
      {/* Close button */}
      <button className="popup-close-btn" onClick={onClose}>×</button>
      
      <div className="dict-header">
        <div className="dict-word-row">
          <div className="dict-word">Word</div>
          <div className="dict-spanish-label">Definition</div>
        </div>
      </div>
      
      <div className="dict-content">
        <div className="dict-english-side">
          <div className="dict-word-display">{word}</div>
          {partOfSpeech && (
            <div className="dict-part-of-speech">{partOfSpeech}</div>
          )}
          {dictPartOfSpeech && dictPartOfSpeech !== partOfSpeech && (
            <div className="dict-part-of-speech dict-local">{dictPartOfSpeech}</div>
          )}
        </div>
        
        <div className="dict-spanish-side">
          {translation && (
            <div className="dict-translation">{translation}</div>
          )}
          
          {fullDefinition && (
            <div className="dict-section">
              <div className="dict-section-title">Gemini Definition</div>
              <div className="dict-full-definition">{fullDefinition}</div>
              {examples.length > 0 && (
                <div className="dict-example">{examples[0]}</div>
              )}
            </div>
          )}
          
          {dictFullDefinition && (
            <div className="dict-section">
              <div className="dict-section-title">Dictionary Definition</div>
              <div className="dict-full-definition dict-local">{dictFullDefinition}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


WordDefinitionPopup.propTypes = {
  word: PropTypes.string,
  definition: PropTypes.object,
  dictDefinition: PropTypes.object,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

export default WordDefinitionPopup;
