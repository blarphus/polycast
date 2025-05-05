import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './FlashcardMode.css';

const FlashcardMode = ({ selectedWords, wordDefinitions }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    cardsReviewed: 0,
    correctAnswers: 0,
    history: []
  });
  const [iguanaImages, setIguanaImages] = useState({});
  const [imageLoading, setImageLoading] = useState({});
  
  // Filter only words that have definitions
  const availableCards = selectedWords.filter(word => 
    wordDefinitions[word.toLowerCase()] && 
    !wordDefinitions[word.toLowerCase()].error
  );
  
  const cardContainerRef = useRef(null);
  
  // Handle key presses for navigation and flipping
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showStats) return; // Disable keyboard navigation when viewing stats
      
      if (e.code === 'Space') {
        // Flip card on spacebar
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        // Next card
        e.preventDefault();
        if (isFlipped) {
          // Track this card as reviewed before moving to next
          setStats(prev => ({
            ...prev,
            cardsReviewed: prev.cardsReviewed + 1,
            history: [...prev.history, {
              word: availableCards[currentIndex],
              date: new Date().toISOString()
            }]
          }));
        }
        setIsFlipped(false);
        setCurrentIndex(prev => (prev + 1) % availableCards.length);
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        // Previous card
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex(prev => 
          prev === 0 ? availableCards.length - 1 : prev - 1
        );
      } else if (e.key === '1') {
        // Mark as incorrect
        if (isFlipped) {
          markCard(false);
        }
      } else if (e.key === '2') {
        // Mark as correct
        if (isFlipped) {
          markCard(true);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, availableCards, showStats]);
  
  const markCard = (isCorrect) => {
    setStats(prev => ({
      ...prev,
      correctAnswers: isCorrect ? prev.correctAnswers + 1 : prev.correctAnswers,
      history: [...prev.history, {
        word: availableCards[currentIndex],
        date: new Date().toISOString(),
        correct: isCorrect
      }]
    }));
    
    // Move to next card after marking
    setTimeout(() => {
      setIsFlipped(false);
      setCurrentIndex(prev => (prev + 1) % availableCards.length);
    }, 500);
  };
  
  const flipCard = () => {
    setIsFlipped(prev => !prev);
  };
  
  const nextCard = () => {
    if (isFlipped) {
      // Track this card as reviewed before moving to next
      setStats(prev => ({
        ...prev,
        cardsReviewed: prev.cardsReviewed + 1,
        history: [...prev.history, {
          word: availableCards[currentIndex],
          date: new Date().toISOString()
        }]
      }));
    }
    setIsFlipped(false);
    setCurrentIndex(prev => (prev + 1) % availableCards.length);
  };
  
  const prevCard = () => {
    setIsFlipped(false);
    setCurrentIndex(prev => 
      prev === 0 ? availableCards.length - 1 : prev - 1
    );
  };
  
  // Load iguana image for current card if not already loaded
  useEffect(() => {
    if (availableCards.length === 0 || showStats) return;
    
    const currentWord = availableCards[currentIndex];
    // Only fetch if we don't already have this image loading or loaded
    if (!iguanaImages[currentWord] && !imageLoading[currentWord]) {
      console.log(`Fetching iguana image for: ${currentWord}`);
      
      // Mark as loading
      setImageLoading(prev => ({...prev, [currentWord]: true}));
      
      // Generate a unique, word-specific prompt for more variety
      const prompt = `A realistic photo of an iguana representing the word "${currentWord}", natural background, photorealistic`;
      
      fetch(`https://polycast-server.onrender.com/api/generate-image?prompt=${encodeURIComponent(prompt)}`, {
        mode: 'cors'
      })
        .then(res => {
          if (!res.ok) throw new Error(`Failed with status: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log(`Image loaded for: ${currentWord}`);
          setIguanaImages(prev => ({...prev, [currentWord]: data.url}));
        })
        .catch(err => {
          console.error(`Error fetching iguana image for ${currentWord}:`, err);
        })
        .finally(() => {
          setImageLoading(prev => ({...prev, [currentWord]: false}));
        });
    }
  }, [currentIndex, availableCards, showStats, iguanaImages, imageLoading]);
  
  // Calculate stats for the visualization
  const calculatedStats = {
    totalCards: availableCards.length,
    reviewedPercentage: stats.cardsReviewed > 0 
      ? Math.round((stats.cardsReviewed / availableCards.length) * 100) 
      : 0,
    correctPercentage: stats.cardsReviewed > 0 
      ? Math.round((stats.correctAnswers / stats.cardsReviewed) * 100) 
      : 0,
    dayStats: calculateDayStats(stats.history)
  };
  
  // Helper to calculate daily stats for the chart
  function calculateDayStats(history) {
    if (!history.length) return [];
    
    const days = {};
    const now = new Date();
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      days[dateKey] = { date: dateKey, count: 0, correct: 0 };
    }
    
    // Fill with actual data
    history.forEach(item => {
      const dateKey = item.date.split('T')[0];
      if (days[dateKey]) {
        days[dateKey].count++;
        if (item.correct) {
          days[dateKey].correct++;
        }
      }
    });
    
    return Object.values(days);
  }
  
  // Helper to get frequency label based on rating
  const getFrequencyLabel = (rating) => {
    const ratings = {
      '1': 'Extremely Common',
      '2': 'Very Common',
      '3': 'Moderately Common',
      '4': 'Somewhat Uncommon',
      '5': 'Rare/Specialized'
    };
    return ratings[rating] || 'Unknown';
  };
  
  // If no cards are available, show a message
  if (availableCards.length === 0) {
    return (
      <div className="flashcard-container">
        <div className="flashcard-empty-state">
          <h2>No Flashcards Available</h2>
          <p>Select some words in audio mode to create flashcards.</p>
        </div>
      </div>
    );
  }
  
  const currentWord = availableCards[currentIndex];
  const definition = wordDefinitions[currentWord.toLowerCase()];
  
  return (
    <div className="flashcard-container">
      {!showStats ? (
        <>
          <div className="flashcard-header">
            <div className="card-counter">
              Card {currentIndex + 1} of {availableCards.length}
            </div>
            <button 
              className="stats-button"
              onClick={() => setShowStats(true)}
              title="View Statistics"
            >
              📊 Stats
            </button>
          </div>
          
          <div className="flashcard-instructions">
            <p>Press <kbd>Space</kbd> to flip card. Use <kbd>←</kbd> <kbd>→</kbd> arrow keys to navigate.</p>
            <p>After revealing, press <kbd>1</kbd> for incorrect or <kbd>2</kbd> for correct.</p>
          </div>
          
          <div 
            className={`flashcard ${isFlipped ? 'flipped' : ''}`}
            onClick={flipCard}
            ref={cardContainerRef}
          >
            <div className="flashcard-inner">
              <div className="flashcard-front">
                <div className="flashcard-content">
                  <div className="flashcard-word">{currentWord}</div>
                  <div className="flashcard-pos">{definition?.partOfSpeech || ''}</div>
                  {definition?.frequencyRating && (
                    <div className="frequency-indicator" title={`Frequency: ${getFrequencyLabel(definition.frequencyRating)}`}>
                      <div className="frequency-label">Frequency:</div>
                      <div className="frequency-dots">
                        {[1, 2, 3, 4, 5].map(dot => (
                          <span 
                            key={dot} 
                            className={`frequency-dot ${Number(definition.frequencyRating) <= dot ? 'active' : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flashcard-image-container">
                  {imageLoading[currentWord] && (
                    <div className="image-loading">Loading iguana image...</div>
                  )}
                  {iguanaImages[currentWord] && (
                    <img 
                      src={iguanaImages[currentWord]} 
                      alt={`Iguana visual for ${currentWord}`}
                      className="flashcard-iguana-image"
                    />
                  )}
                </div>
              </div>
              <div className="flashcard-back">
                <div className="flashcard-content">
                  <div className="flashcard-translation">{definition?.translation || ''}</div>
                  <div className="flashcard-definition">{definition?.definition || ''}</div>
                  <div className="flashcard-example">
                    {definition?.example ? (
                      <span>
                        {(() => {
                          const wordRegex = new RegExp(`\\b${currentWord.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
                          return definition.example.split(wordRegex).reduce((acc, part, idx, arr) => {
                            acc.push(part);
                            if (idx < arr.length - 1) {
                              acc.push(<strong key={idx} style={{ color: '#ffe066', fontWeight: 700 }}>{currentWord}</strong>);
                            }
                            return acc;
                          }, []);
                        })()}
                      </span>
                    ) : (
                      <span>No example available</span>
                    )}
                  </div>
                  <div className="flashcard-rating">
                    <button 
                      className="incorrect-btn"
                      onClick={(e) => { e.stopPropagation(); markCard(false); }}
                    >
                      Incorrect (1)
                    </button>
                    <button 
                      className="correct-btn"
                      onClick={(e) => { e.stopPropagation(); markCard(true); }}
                    >
                      Correct (2)
                    </button>
                  </div>
                </div>
                <div className="flashcard-image-container">
                  {imageLoading[currentWord] && (
                    <div className="image-loading">Loading iguana image...</div>
                  )}
                  {iguanaImages[currentWord] && (
                    <img 
                      src={iguanaImages[currentWord]} 
                      alt={`Iguana visual for ${currentWord}`}
                      className="flashcard-iguana-image"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flashcard-navigation">
            <button onClick={prevCard} className="nav-btn prev-btn">
              ← Previous
            </button>
            <button onClick={nextCard} className="nav-btn next-btn">
              Next →
            </button>
          </div>
        </>
      ) : (
        <div className="stats-container">
          <div className="stats-header">
            <h2>Flashcard Statistics</h2>
            <button 
              className="close-stats-button"
              onClick={() => setShowStats(false)}
            >
              Back to Flashcards
            </button>
          </div>
          
          <div className="stats-summary">
            <div className="stat-card">
              <div className="stat-value">{calculatedStats.totalCards}</div>
              <div className="stat-label">Total Cards</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.cardsReviewed}</div>
              <div className="stat-label">Cards Reviewed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{calculatedStats.correctPercentage}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
          </div>
          
          <div className="stats-chart">
            <h3>Daily Activity</h3>
            <div className="chart-container">
              {calculatedStats.dayStats.map((day, index) => (
                <div key={index} className="chart-bar-container">
                  <div className="chart-date-label">{formatShortDate(day.date)}</div>
                  <div className="chart-bar-wrapper">
                    <div 
                      className="chart-bar" 
                      style={{ height: `${(day.count / Math.max(...calculatedStats.dayStats.map(d => d.count || 1))) * 100}%` }}
                    >
                      <div 
                        className="chart-bar-correct" 
                        style={{ height: `${day.count > 0 ? (day.correct / day.count) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="chart-value-label">{day.count}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color legend-total"></div>
                <div>Total Reviews</div>
              </div>
              <div className="legend-item">
                <div className="legend-color legend-correct"></div>
                <div>Correct</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to format date to short form (e.g., "Mon 5")
function formatShortDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]} ${date.getDate()}`;
}

FlashcardMode.propTypes = {
  selectedWords: PropTypes.arrayOf(PropTypes.string).isRequired,
  wordDefinitions: PropTypes.object.isRequired
};

export default FlashcardMode;
