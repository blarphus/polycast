import React, { useState } from 'react';
import PropTypes from 'prop-types';
import DictionaryPopup from './DictionaryPopup';

/**
 * A component that renders a clickable word with a Netflix-style popup
 */
const ClickableWord = ({ word, onWordClick, wordDefinitions, style }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const wordLower = word.toLowerCase();
  const definition = wordDefinitions[wordLower];
  
  const handleClick = (e) => {
    e.stopPropagation();
    
    // Get position for popup
    const rect = e.currentTarget.getBoundingClientRect();
    const position = {
      x: rect.left + (rect.width / 2), // Center horizontally
      y: rect.bottom + window.scrollY + 5 // Position below word
    };
    
    // If already showing, close it
    if (showPopup) {
      setShowPopup(false);
    } else {
      // Otherwise, position and show it
      setPopupPosition(position);
      setShowPopup(true);
      
      // Call the parent handler to add to dictionary/generate flashcard
      if (onWordClick) {
        onWordClick(word, e);
      }
    }
  };
  
  return (
    <>
      <span
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          borderBottom: '1px dotted rgba(255,255,255,0.4)', 
          transition: 'all 0.2s',
          padding: '0 1px',
          ...style
        }}
      >
        {word}
      </span>
      
      {showPopup && definition && (
        <DictionaryPopup
          word={word}
          definition={definition}
          position={popupPosition}
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  );
};

ClickableWord.propTypes = {
  word: PropTypes.string.isRequired,
  onWordClick: PropTypes.func,
  wordDefinitions: PropTypes.object.isRequired,
  style: PropTypes.object
};

ClickableWord.defaultProps = {
  style: {}
};

export default ClickableWord;
