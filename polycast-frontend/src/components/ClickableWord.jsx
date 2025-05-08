import React from 'react';
import PropTypes from 'prop-types';

/**
 * ClickableWord component for displaying words that can be clicked to add to dictionary/flashcards
 */
const ClickableWord = ({ word, onClick, isStudent }) => {
  // Only make words clickable for students
  if (!isStudent) {
    return <span>{word}</span>;
  }
  
  // Basic word cleaning - strip punctuation from the edges but keep apostrophes
  const cleanWord = word.replace(/^[^\w']+|[^\w']+$/g, '');
  
  // Skip words that are too short or don't contain any letters
  if (cleanWord.length < 2 || !/[a-zA-Z]/.test(cleanWord)) {
    return <span>{word}</span>;
  }

  // Handle word click and pass the event for position information
  const handleWordClick = (e) => {
    e.stopPropagation();
    // Pass the click event so we can position the popup and the segmentId for context
    onClick(cleanWord, {
      x: e.clientX,
      y: e.clientY,
      segmentId: segmentId // Pass the segment ID to identify which sentence this word belongs to
    });
  };
  
  return (
    <span 
      className="clickable-word"
      onClick={handleWordClick}
      style={{
        cursor: 'pointer',
        padding: '2px 1px',
        margin: '0 1px',
        borderBottom: '1px dashed rgba(255, 255, 255, 0.2)',
        transition: 'border-color 0.2s ease',
        display: 'inline-block',
      }}
      title={`Click to look up "${cleanWord}" in context`}
    >
      {word}
    </span>
  );
};

ClickableWord.propTypes = {
  word: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isStudent: PropTypes.bool
};

ClickableWord.defaultProps = {
  isStudent: false
};

export default ClickableWord;
