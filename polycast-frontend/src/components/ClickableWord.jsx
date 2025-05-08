import React from 'react';
import PropTypes from 'prop-types';

/**
 * ClickableWord component for displaying words that can be clicked to add to dictionary/flashcards
 */
const ClickableWord = ({ word, onClick, isSelected, isStudent }) => {
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
  
  return (
    <span 
      className={`clickable-word ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(cleanWord)}
      style={{
        cursor: 'pointer',
        padding: '2px 1px',
        margin: '0 1px',
        borderRadius: '3px',
        backgroundColor: isSelected ? 'rgba(90, 90, 255, 0.2)' : 'transparent',
        borderBottom: isSelected ? '2px solid #5a5aff' : '1px dashed rgba(255, 255, 255, 0.2)',
        transition: 'all 0.2s ease',
        display: 'inline-block',
      }}
      title={`Click to add "${cleanWord}" to your dictionary`}
    >
      {word}
    </span>
  );
};

ClickableWord.propTypes = {
  word: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isSelected: PropTypes.bool,
  isStudent: PropTypes.bool,
};

ClickableWord.defaultProps = {
  isSelected: false,
  isStudent: false,
};

export default ClickableWord;
