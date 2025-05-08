import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * FlashcardReview component for reviewing flashcards with spaced repetition
 */
const FlashcardReview = ({ userId }) => {
  const [flashcards, setFlashcards] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // Fetch due flashcards for the user
  useEffect(() => {
    const fetchFlashcards = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/flashcards?userId=${userId}&due=true`);
        if (!response.ok) {
          throw new Error('Failed to fetch flashcards');
        }
        const data = await response.json();
        setFlashcards(data.flashcards || []);
        if (data.flashcards && data.flashcards.length > 0) {
          setCurrentCard(data.flashcards[0]);
        } else {
          setCurrentCard(null);
        }
      } catch (err) {
        console.error('Error fetching flashcards:', err);
        setError('Failed to load flashcards. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchFlashcards();
    }
  }, [userId]);

  // Handle flashcard rating
  const handleRating = async (rating) => {
    if (!currentCard) return;

    try {
      setLoading(true);
      const response = await fetch('/api/flashcards/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          word: currentCard.word,
          dictionaryDefinition: currentCard.dictionaryDefinition,
          rating,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update flashcard');
      }

      // Remove the current card from the deck
      const updatedFlashcards = flashcards.filter(
        (card) => 
          card.word !== currentCard.word || 
          card.dictionaryDefinition !== currentCard.dictionaryDefinition
      );

      setFlashcards(updatedFlashcards);
      setShowAnswer(false);

      // Set the next card or null if no more cards
      if (updatedFlashcards.length > 0) {
        setCurrentCard(updatedFlashcards[0]);
      } else {
        setCurrentCard(null);
      }
    } catch (err) {
      console.error('Error updating flashcard:', err);
      setError('Failed to update flashcard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state
  if (loading && !currentCard) {
    return (
      <div className="flashcard-review loading">
        <div className="spinner"></div>
        <p>Loading flashcards...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flashcard-review error">
        <p className="error-message">{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Show empty state if no cards due
  if (!currentCard) {
    return (
      <div className="flashcard-review empty">
        <h3>All caught up!</h3>
        <p>You don't have any flashcards due for review.</p>
      </div>
    );
  }

  return (
    <div className="flashcard-review" style={styles.container}>
      <div className="flashcard" style={styles.card}>
        <h3 style={styles.word}>{currentCard.word}</h3>
        <p style={styles.partOfSpeech}>{currentCard.partOfSpeech}</p>
        
        {showAnswer ? (
          <div className="flashcard-answer" style={styles.answer}>
            <p style={styles.definition}>{currentCard.displayDefinition}</p>
            <p style={styles.example}>{currentCard.exampleSentence}</p>
            
            <div className="rating-buttons" style={styles.ratingButtons}>
              <button 
                onClick={() => handleRating('again')} 
                style={{...styles.button, backgroundColor: '#ff6b6b'}}
              >
                Again
              </button>
              <button 
                onClick={() => handleRating('hard')} 
                style={{...styles.button, backgroundColor: '#ffa06b'}}
              >
                Hard
              </button>
              <button 
                onClick={() => handleRating('good')} 
                style={{...styles.button, backgroundColor: '#63c7ff'}}
              >
                Good
              </button>
              <button 
                onClick={() => handleRating('easy')} 
                style={{...styles.button, backgroundColor: '#63ffa0'}}
              >
                Easy
              </button>
            </div>
          </div>
        ) : (
          <div className="flashcard-question" style={styles.question}>
            <p style={styles.cloze}>{currentCard.clozeSentence}</p>
            <button 
              onClick={() => setShowAnswer(true)} 
              style={styles.showAnswerButton}
            >
              Show Answer
            </button>
          </div>
        )}
      </div>
      
      <div style={styles.progress}>
        <span>Card {flashcards.indexOf(currentCard) + 1} of {flashcards.length}</span>
      </div>
    </div>
  );
};

// Style object for the component
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: '#1f1f35',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    padding: '24px',
    width: '100%',
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  word: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#fff',
    textAlign: 'center',
  },
  partOfSpeech: {
    fontSize: '16px',
    color: '#b0b0c0',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '0',
  },
  question: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cloze: {
    fontSize: '20px',
    lineHeight: '1.5',
    color: '#e0e0e0',
    textAlign: 'center',
    margin: '30px 0',
  },
  showAnswerButton: {
    backgroundColor: '#5a5aff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '20px',
    fontWeight: '600',
    transition: 'background-color 0.3s',
  },
  answer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  definition: {
    fontSize: '18px',
    lineHeight: '1.5',
    color: '#e0e0e0',
    margin: '20px 0',
  },
  example: {
    fontSize: '18px',
    lineHeight: '1.5',
    color: '#b0b0ff',
    fontStyle: 'italic',
    margin: '10px 0 30px',
    borderLeft: '3px solid #5a5aff',
    paddingLeft: '12px',
  },
  ratingButtons: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 'auto',
    gap: '10px',
  },
  button: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.1s, opacity 0.1s',
  },
  progress: {
    marginTop: '20px',
    color: '#b0b0c0',
    fontSize: '14px',
  },
};

FlashcardReview.propTypes = {
  userId: PropTypes.string.isRequired,
};

export default FlashcardReview;
