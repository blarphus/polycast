import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import FlashcardReview from './FlashcardReview';

/**
 * Dictionary component to display saved words and manage flashcards
 */
const Dictionary = ({ userId }) => {
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('dictionary'); // 'dictionary' or 'review'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWord, setSelectedWord] = useState(null);

  // Fetch all flashcards for the user
  useEffect(() => {
    const fetchFlashcards = async () => {
      try {
        setLoading(true);
        console.log(`Fetching flashcards for userId: ${userId}`);
        
        // Construct a proper URL with query parameters
        const url = new URL('https://polycast-server.onrender.com/api/flashcards');
        url.searchParams.append('userId', userId);
        console.log(`Fetching flashcards from: ${url.toString()}`);
        
        const response = await fetch(url.toString());
        console.log(`Flashcard fetch response status: ${response.status} ${response.statusText}`);
        
        // Log the raw response for debugging
        const responseText = await response.text();
        console.log('Raw flashcard response:', responseText);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch flashcards: ${response.status} ${response.statusText}. Response: ${responseText}`);
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (err) {
          console.error('Error parsing flashcard response:', err);
          throw new Error('Invalid JSON in flashcard response');
        }
        
        console.log('Parsed flashcard data:', data);
        setFlashcards(data.flashcards || []);
      } catch (err) {
        console.error('Error fetching flashcards:', err);
        setError('Failed to load flashcards. Please try again.');
        // Initialize with empty array to prevent further errors
        setFlashcards([]);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchFlashcards();
    }
  }, [userId, viewMode]);

  // Filter flashcards based on search term
  const filteredFlashcards = searchTerm
    ? flashcards.filter(card => 
        card.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.displayDefinition.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : flashcards;

  // Group flashcards by word
  const groupedFlashcards = filteredFlashcards.reduce((acc, card) => {
    if (!acc[card.word]) {
      acc[card.word] = [];
    }
    acc[card.word].push(card);
    return acc;
  }, {});

  // Calculate due cards count
  const dueCount = flashcards.filter(card => new Date(card.nextReview) <= new Date()).length;

  // Format next review date
  const formatNextReview = (timestamp) => {
    const reviewDate = new Date(timestamp);
    const now = new Date();
    
    // If due today
    if (reviewDate <= now) {
      return 'Due now';
    }
    
    // If due tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (reviewDate.toDateString() === tomorrow.toDateString()) {
      return 'Due tomorrow';
    }
    
    // If due within a week
    const oneWeek = new Date(now);
    oneWeek.setDate(oneWeek.getDate() + 7);
    if (reviewDate <= oneWeek) {
      const days = Math.ceil((reviewDate - now) / (1000 * 60 * 60 * 24));
      return `Due in ${days} day${days > 1 ? 's' : ''}`;
    }
    
    // Otherwise show date
    return `Due ${reviewDate.toLocaleDateString()}`;
  };

  // Show loading state
  if (loading && flashcards.length === 0) {
    return (
      <div className="dictionary loading" style={styles.loadingContainer}>
        <div className="spinner" style={styles.spinner}></div>
        <p>Loading dictionary...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="dictionary error" style={styles.errorContainer}>
        <p className="error-message">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={styles.retryButton}
        >
          Retry
        </button>
      </div>
    );
  }

  // Show flashcard review mode
  if (viewMode === 'review') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Flashcard Review</h2>
          <button 
            onClick={() => setViewMode('dictionary')}
            style={styles.switchButton}
          >
            Back to Dictionary
          </button>
        </div>
        <FlashcardReview userId={userId} />
      </div>
    );
  }

  // Show dictionary view
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>My Dictionary</h2>
        <div style={styles.headerActions}>
          <button 
            onClick={() => setViewMode('review')}
            style={{...styles.switchButton, backgroundColor: dueCount > 0 ? '#5a5aff' : '#444'}}
            disabled={dueCount === 0}
          >
            Review Flashcards {dueCount > 0 ? `(${dueCount})` : ''}
          </button>
        </div>
      </div>
      
      <div style={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search words..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            style={styles.clearButton}
          >
            ✕
          </button>
        )}
      </div>
      
      <div style={styles.wordsContainer}>
        {Object.keys(groupedFlashcards).length === 0 ? (
          <div style={styles.emptyState}>
            <p>Your dictionary is empty.</p>
            <p>Click on words in the transcript to add them.</p>
          </div>
        ) : (
          <div style={styles.wordList}>
            {Object.entries(groupedFlashcards).map(([word, cards]) => (
              <div key={word} style={styles.wordItem}>
                <div 
                  style={{
                    ...styles.wordHeader,
                    backgroundColor: selectedWord === word ? '#2a2a45' : 'transparent',
                  }}
                  onClick={() => setSelectedWord(selectedWord === word ? null : word)}
                >
                  <h3 style={styles.wordTitle}>{word}</h3>
                  <span style={styles.sensesCount}>
                    {cards.length} sense{cards.length !== 1 ? 's' : ''}
                  </span>
                  <span style={styles.expandIcon}>
                    {selectedWord === word ? '▼' : '▶'}
                  </span>
                </div>
                
                {selectedWord === word && (
                  <div style={styles.sensesContainer}>
                    {cards.map((card, index) => (
                      <div key={index} style={styles.senseItem}>
                        <div style={styles.senseHeader}>
                          <span style={styles.partOfSpeech}>{card.partOfSpeech}</span>
                          <span style={styles.nextReview}>
                            {formatNextReview(card.nextReview)}
                          </span>
                        </div>
                        <p style={styles.definition}>{card.displayDefinition}</p>
                        <p style={styles.example}>{card.exampleSentence}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Style object for the component
const styles = {
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  switchButton: {
    backgroundColor: '#5a5aff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  searchContainer: {
    position: 'relative',
    marginBottom: '20px',
  },
  searchInput: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '16px',
    backgroundColor: '#2a2a40',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    outline: 'none',
  },
  clearButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '16px',
  },
  wordsContainer: {
    maxHeight: '600px',
    overflowY: 'auto',
    paddingRight: '5px',
  },
  wordList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  wordItem: {
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#232338',
  },
  wordHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  wordTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    flex: 1,
  },
  sensesCount: {
    color: '#aaa',
    fontSize: '14px',
    marginRight: '10px',
  },
  expandIcon: {
    color: '#aaa',
    fontSize: '12px',
  },
  sensesContainer: {
    padding: '0 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  senseItem: {
    padding: '12px',
    backgroundColor: '#2d2d45',
    borderRadius: '6px',
  },
  senseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  partOfSpeech: {
    color: '#b0b0ff',
    fontStyle: 'italic',
    fontSize: '14px',
  },
  nextReview: {
    color: '#aaa',
    fontSize: '14px',
  },
  definition: {
    margin: '8px 0',
    lineHeight: '1.4',
  },
  example: {
    color: '#b0b0c0',
    fontStyle: 'italic',
    margin: '8px 0 0',
    borderLeft: '2px solid #5a5aff',
    paddingLeft: '10px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#aaa',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#aaa',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid #33336650',
    borderTopColor: '#5a5aff',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#ff6b6b',
  },
  retryButton: {
    backgroundColor: '#5a5aff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '16px',
  },
};

Dictionary.propTypes = {
  userId: PropTypes.string.isRequired,
};

export default Dictionary;
