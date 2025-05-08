import React from 'react';
import PropTypes from 'prop-types';
import './WordDefinitionPopup.css';

const WordDefinitionPopup = ({ word, definition, position, onClose }) => {
  if (!word || !definition) return null;
  
  // Ensure definition data exists
  const meanings = definition.meanings || [];
  const synonyms = definition.synonyms || [];
  const examples = definition.examples || [];
  
  return (
    <div 
      className="word-definition-popup"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      {/* Close button */}
      <button className="popup-close-btn" onClick={onClose}>×</button>
      
      {/* Word and audio */}
      <div className="popup-header">
        <div className="popup-word-section">
          <span className="popup-word">{word}</span>
          {definition.phonetic && (
            <span className="popup-phonetic">{definition.phonetic}</span>
          )}
        </div>
        {definition.audioUrl && (
          <button className="popup-audio-btn" onClick={() => {
            const audio = new Audio(definition.audioUrl);
            audio.play();
          }}>
            <span role="img" aria-label="play pronunciation">🔊</span>
          </button>
        )}
      </div>
      
      {/* Synonyms */}
      {synonyms.length > 0 && (
        <div className="popup-section">
          <div className="popup-section-title">Synonyms:</div>
          <div className="popup-synonyms">
            {synonyms.slice(0, 5).join(', ')}
          </div>
        </div>
      )}
      
      {/* Examples from context */}
      {examples.length > 0 && (
        <div className="popup-section">
          <div className="popup-section-title">Examples:</div>
          <div className="popup-examples">
            {examples.slice(0, 3).map((example, index) => (
              <div key={index} className="popup-example">{example}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Definitions */}
      {meanings.length > 0 && (
        <div className="popup-section">
          {meanings.slice(0, 2).map((meaning, index) => (
            <div key={index} className="popup-meaning">
              {meaning.partOfSpeech && (
                <span className="popup-part-of-speech">{meaning.partOfSpeech}</span>
              )}
              <div className="popup-definition">{meaning.definition}</div>
            </div>
          ))}
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
