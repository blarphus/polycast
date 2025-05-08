import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './FlashcardMode.css';

const FlashcardMode = ({ selectedWords, wordDefinitions, englishSegments }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    cardsReviewed: 0,
    correctAnswers: 0,
    history: []
  });
  const [wordImages, setWordImages] = useState({});
  const [imageLoading, setImageLoading] = useState({});
  const [generatedSentences, setGeneratedSentences] = useState({});
  const [viewedCards, setViewedCards] = useState({});
  const [queueOrder, setQueueOrder] = useState([]);
  
  // Track card views - a card can be in one of 4 spaced repetition stages
  // 1: First time seen today
  // 2: Second viewing today
  // 3: Third viewing today
  // 4: Will be shown tomorrow
  
  // Filter only words that have definitions
  const availableCards = selectedWords.filter(word => 
    wordDefinitions[word.toLowerCase()] && 
    !wordDefinitions[word.toLowerCase()].error
  );
  
  // Initialize queue order if it's empty and we have cards
  useEffect(() => {
    if (availableCards.length > 0 && queueOrder.length === 0) {
      console.log('Initializing queue order with available cards:', availableCards);
      setQueueOrder([...availableCards]);
    }
  }, [availableCards, queueOrder.length]);
  
  // Calculate current card index and word
  const getCurrentWord = () => queueOrder[currentIndex] || (availableCards.length > 0 ? availableCards[0] : '');
  const currentWord = getCurrentWord();
  
  // Function to generate a sentence for a word using Gemini
  const generateSentenceWithGemini = async (word, context) => {
    if (generatedSentences[word]) return; // Already have a sentence
    
    console.log(`Generating sentence for "${word}" with context: "${context}"`);
    
    try {
      const prompt = `Create a simple, everyday sentence using the English word "${word}" in the same sense as it's used in this context: "${context}". Make the sentence natural, conversational, and appropriate for English language learners. The word "${word}" should be used naturally in the sentence. Return ONLY the sentence, nothing else.`;
      
      const response = await fetch('https://polycast-server.onrender.com/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const sentence = data.content || `This is an example sentence using the word "${word}".`;
      
      console.log(`Generated sentence for "${word}": "${sentence}"`);
      setGeneratedSentences(prev => ({
        ...prev,
        [word]: sentence
      }));
    } catch (error) {
      console.error(`Error generating sentence for "${word}":`, error);
      // Fallback sentence if generation fails
      setGeneratedSentences(prev => ({
        ...prev,
        [word]: context || `This is an example sentence with the word "${word}".`
      }));
    }
  };
  
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
  
  // Preload all images and generate sentences for all available cards
  useEffect(() => {
    if (availableCards.length === 0 || showStats) return;
    
    availableCards.forEach(word => {
      const definition = wordDefinitions[word.toLowerCase()];
      const wordLower = word.toLowerCase();
      
      // Find context from English segments
      const context = englishSegments?.find(seg => 
        seg?.text?.toLowerCase().includes(wordLower)
      )?.text || `Example using the word ${word}.`;
      
      // Generate a sentence for this word if we don't have one yet
      if (!generatedSentences[word]) {
        generateSentenceWithGemini(word, context);
      }
      
      // If we already have the image URL in the wordDefinitions, use that
      if (definition && definition.imageUrl) {
        // Image was already generated when the word was clicked
        console.log(`Using already generated image for word: ${word}`);
        setWordImages(prev => ({...prev, [word]: definition.imageUrl}));
        return;
      }
      
      // Only fetch if we don't already have this image loading or loaded
      if (!wordImages[word] && !imageLoading[word]) {
        console.log(`Fetching image for word: ${word}`);
        
        // Mark as loading
        setImageLoading(prev => ({...prev, [word]: true}));
        
        // Remove contextual awareness - generate image based solely on the word
        const prompt = `Create a visually engaging, wordless flashcard image in the style of Charley Harper. Use bold shapes, minimal detail, and mid-century modern aesthetics to depict the concept in a memorable and metaphorical way. Avoid text or labels. Again, use no text. The word to illustrate is: "${word}"`;
        
        fetch(`https://polycast-server.onrender.com/api/generate-image?prompt=${encodeURIComponent(prompt)}`, {
          mode: 'cors'
        })
          .then(res => {
            if (!res.ok) throw new Error(`Failed with status: ${res.status}`);
            return res.json();
          })
          .then(data => {
            console.log(`Image loaded for: ${word}`);
            setWordImages(prev => ({...prev, [word]: data.imageUrl || data.url}));
          })
          .catch(err => {
            console.error(`Error fetching image for ${word}:`, err);
          })
          .finally(() => {
            setImageLoading(prev => ({...prev, [word]: false}));
          });
      }
    });
  }, [availableCards, showStats, wordImages, imageLoading, englishSegments, generatedSentences]);
  
  // Check if this is the first time viewing this card today
  const isFirstTimeViewing = !viewedCards[currentWord];
  
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
  
  // Use the already calculated currentWord value
  const definition = wordDefinitions[currentWord?.toLowerCase()];
  
  // Handle marking a card as correct or incorrect
  const markCard = (isCorrect) => {
    if (!currentWord) return;
    
    // Update stats
    setStats(prev => ({
      ...prev,
      cardsReviewed: prev.cardsReviewed + 1,
      correctAnswers: isCorrect ? prev.correctAnswers + 1 : prev.correctAnswers,
      history: [...prev.history, {
        word: currentWord,
        date: new Date().toISOString(),
        correct: isCorrect
      }]
    }));
    
    // Update the viewed status of this card
    setViewedCards(prev => {
      const currentStage = prev[currentWord] || 0;
      const nextStage = isCorrect ? Math.min(currentStage + 1, 3) : 0; // If incorrect, reset to stage 0
      
      return {
        ...prev,
        [currentWord]: nextStage
      };
    });
    
    // Remove the current card from the queue
    const newQueue = [...queueOrder];
    newQueue.splice(currentIndex, 1);
    
    // If correct and not at stage 3 yet, move to back of queue
    // If at stage 3, it's completed for today
    if (isCorrect && viewedCards[currentWord] < 3) {
      newQueue.push(currentWord);
    }
    
    // Update queue
    setQueueOrder(newQueue);
    
    // If we've reached the end of the queue, reset to the beginning
    if (currentIndex >= newQueue.length) {
      setCurrentIndex(0);
    }
    
    // Otherwise keep the same index (which will now point to the next card)
    // and unflip the card
    setIsFlipped(false);
  };
  
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
                  <div className="flashcard-word-container">
                    <div className="flashcard-word">{currentWord}</div>
                  </div>
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
                    <div className="image-loading">Creating image for "{currentWord}"...</div>
                  )}
                  {wordImages[currentWord] && (
                    <img 
                      src={wordImages[currentWord]} 
                      alt={`Visual representation of "${currentWord}"`}
                      className="flashcard-word-image"
                    />
                  )}
                </div>
              </div>
              <div className="flashcard-back">
                <div className="flashcard-content">
                  <div className="flashcard-word">{currentWord}</div>
                  
                  {/* Commonality rating */}
                  <div className="flashcard-commonality">
                    <div className="commonality-label">
                      {definition?.frequency ? 
                        getFrequencyLabel(definition.frequency) : 
                        getFrequencyLabel('3') /* Default to moderately common */}
                    </div>
                  </div>
                  
                  {/* First viewing shows full context sentence with highlighted word */}
                  {isFirstTimeViewing && generatedSentences[currentWord] && (
                    <div className="flashcard-first-view">
                      <div className="first-view-label">Example sentence:</div>
                      <div className="first-view-sentence">
                        {(() => {
                          const sentence = generatedSentences[currentWord];
                          const wordRegex = new RegExp(`\b${currentWord.replace(/[.*+?^${}()|[\]\]/g, '\\$&')}\b`, 'gi');
                          return sentence.split(wordRegex).reduce((acc, part, idx, arr) => {
                            acc.push(part);
                            if (idx < arr.length - 1) {
                              acc.push(<strong key={idx} style={{ color: '#f15bb5', fontWeight: 700, fontSize: '110%' }}>{currentWord}</strong>);
                            }
                            return acc;
                          }, []);
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* Regular definition content */}
                  {definition?.definitions ? (
                    // New format with multiple definitions
                    <div className="flashcard-definitions-container">
                      {definition.definitions.slice(0, 2).map((def, index) => (
                        <div key={index} className="flashcard-definition-item">
                          <div className="flashcard-definition">{def.text || ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Fallback for legacy format with single definition
                    <div className="flashcard-definition">{definition?.definition || ''}</div>
                  )}
                  
                  {/* Updated rating buttons */}
                  <div className="flashcard-rating">
                    <button 
                      className="incorrect-btn"
                      onClick={(e) => { e.stopPropagation(); markCard(false); }}
                    >
                      Incorrect
                    </button>
                    <button 
                      className="correct-btn"
                      onClick={(e) => { e.stopPropagation(); markCard(true); }}
                    >
                      Correct
                    </button>
                  </div>
                </div>
                
                {/* Always show image - moved outside of conditional display */}
                <div className="flashcard-image-container">
                  {imageLoading[currentWord] && (
                    <div className="image-loading">Creating image for "{currentWord}"...</div>
                  )}
                  {wordImages[currentWord] ? (
                    <img 
                      src={wordImages[currentWord]} 
                      alt={`Visual representation of "${currentWord}"`}
                      className="flashcard-word-image"
                    />
                  ) : definition?.imageUrl ? (
                    <img 
                      src={definition.imageUrl} 
                      alt={`Visual representation of "${currentWord}"`}
                      className="flashcard-word-image"
                    />
                  ) : null}
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
  wordDefinitions: PropTypes.object.isRequired,
  englishSegments: PropTypes.arrayOf(PropTypes.object)
};

export default FlashcardMode;
