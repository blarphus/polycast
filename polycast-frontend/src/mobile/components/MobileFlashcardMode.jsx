import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { calculateNextReview, getDueCards, getReviewStats, formatNextReviewTime } from '../../utils/srsAlgorithm';
import { getSRSSettings } from '../../utils/srsSettings';
import { TouchGestureHandler } from '../utils/touchGestures';

const MobileFlashcardMode = ({ 
  selectedProfile, 
  wordDefinitions, 
  setWordDefinitions, 
  onBack 
}) => {
  console.log(`[MOBILE DEBUG] MobileFlashcardMode loaded - version with hardcoded cards - ${new Date().toISOString()}`);
  const [currentDueIndex, setCurrentDueIndex] = useState(0);
  const [dueCards, setDueCards] = useState([]);
  const [todaysNewCards, setTodaysNewCards] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [srsSettings] = useState(getSRSSettings());
  const [stats, setStats] = useState({
    cardsReviewed: 0,
    correctAnswers: 0,
    sessionStartTime: new Date()
  });
  const [swipeAnimation, setSwipeAnimation] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [dragState, setDragState] = useState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
  const [cardEntryAnimation, setCardEntryAnimation] = useState('');
  
  // Refs for gesture handling
  const cardContainerRef = useRef(null);
  const gestureHandlerRef = useRef(null);

  // Get hardcoded cards for non-saving mode
  const getHardcodedCards = () => {
    return [
      {
        key: 'run1',
        word: 'run',
        wordSenseId: 'run1',
        partOfSpeech: 'verb',
        definition: 'To move quickly on foot',
        inFlashcards: true,
        exampleSentencesGenerated: 'I like to ~run~ in the morning for exercise. // Me gusta ~correr~ por la mañana para hacer ejercicio. // She decided to ~run~ to catch the bus. // Decidió ~correr~ para alcanzar el autobús. // They ~run~ together every weekend. // Ellos ~corren~ juntos todos los fines de semana. // The dog loves to ~run~ in the park. // Al perro le encanta ~correr~ en el parque. // He can ~run~ very fast. // Él puede ~correr~ muy rápido.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      },
      {
        key: 'eat1',
        word: 'eat',
        wordSenseId: 'eat1',
        partOfSpeech: 'verb',
        definition: 'To consume food',
        inFlashcards: true,
        exampleSentencesGenerated: 'I ~eat~ breakfast every morning at seven. // ~Como~ desayuno todas las mañanas a las siete. // They ~eat~ dinner together as a family. // Ellos ~cenan~ juntos como familia. // She likes to ~eat~ healthy foods. // A ella le gusta ~comer~ alimentos saludables. // We usually ~eat~ lunch at noon. // Normalmente ~comemos~ el almuerzo al mediodía. // The children ~eat~ too much candy. // Los niños ~comen~ demasiados dulces.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      },
      {
        key: 'book1',
        word: 'book',
        wordSenseId: 'book1',
        partOfSpeech: 'noun',
        definition: 'A written work published in printed or electronic form',
        inFlashcards: true,
        exampleSentencesGenerated: 'I read a fascinating ~book~ about space exploration. // Leí un ~libro~ fascinante sobre exploración espacial. // She bought a new ~book~ from the bookstore. // Compró un ~libro~ nuevo en la librería. // The ~book~ on the table belongs to my sister. // El ~libro~ sobre la mesa pertenece a mi hermana. // He wrote his first ~book~ last year. // Escribió su primer ~libro~ el año pasado. // This ~book~ has over 500 pages. // Este ~libro~ tiene más de 500 páginas.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      },
      {
        key: 'happy1',
        word: 'happy',
        wordSenseId: 'happy1',
        partOfSpeech: 'adjective',
        definition: 'Feeling or showing pleasure or contentment',
        inFlashcards: true,
        exampleSentencesGenerated: 'She feels very ~happy~ about her new job. // Se siente muy ~feliz~ por su nuevo trabajo. // The children are ~happy~ to see their grandparents. // Los niños están ~felices~ de ver a sus abuelos. // I am ~happy~ to help you with this project. // Estoy ~feliz~ de ayudarte con este proyecto. // They look ~happy~ together in the photo. // Se ven ~felices~ juntos en la foto. // We were ~happy~ to receive your invitation. // Estuvimos ~felices~ de recibir tu invitación.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      },
      {
        key: 'water1',
        word: 'water',
        wordSenseId: 'water1',
        partOfSpeech: 'noun',
        definition: 'A clear liquid essential for life',
        inFlashcards: true,
        exampleSentencesGenerated: 'Please drink more ~water~ to stay hydrated. // Por favor, bebe más ~agua~ para mantenerte hidratado. // The ~water~ in the lake is crystal clear. // El ~agua~ del lago está cristalina. // She filled the glass with cold ~water~. // Llenó el vaso con ~agua~ fría. // Plants need ~water~ and sunlight to grow. // Las plantas necesitan ~agua~ y luz solar para crecer. // The bottle contains filtered ~water~. // La botella contiene ~agua~ filtrada.',
        srsData: {
          status: 'new',
          interval: 0,
          easeFactor: 2.5,
          correctCount: 0,
          incorrectCount: 0,
          lastReviewDate: null,
          nextReviewDate: new Date().toISOString(),
          currentStep: 0
        }
      }
    ];
  };

  // Process the wordDefinitions to extract all word senses and initialize SRS data
  const availableCards = React.useMemo(() => {
    console.log(`[MOBILE DEBUG] Selected profile is: "${selectedProfile}"`);
    // For non-saving mode, use hardcoded cards
    if (selectedProfile === 'non-saving') {
      const hardcodedCards = getHardcodedCards();
      console.log(`[MOBILE DEBUG] Using hardcoded cards for non-saving mode:`, hardcodedCards);
      console.log(`[MOBILE DEBUG] First card example:`, hardcodedCards[0]?.exampleSentencesGenerated);
      return hardcodedCards;
    }

    // For other profiles, process actual wordDefinitions
    const cards = [];
    Object.entries(wordDefinitions).forEach(([key, value]) => {
      if (value && value.wordSenseId && value.inFlashcards) {
        // Initialize SRS data if it doesn't exist
        const cardWithSRS = { ...value, key };
        if (!cardWithSRS.srsData) {
          cardWithSRS.srsData = {
            status: 'new',
            interval: 0,
            easeFactor: 2.5,
            correctCount: 0,
            incorrectCount: 0,
            lastReviewDate: null,
            nextReviewDate: new Date().toISOString(), // Due now
            currentStep: 0
          };
        }
        cards.push(cardWithSRS);
      }
    });
    console.log(`[MOBILE DEBUG] Processed cards with SRS data:`, cards);
    return cards;
  }, [wordDefinitions, selectedProfile]);

  // Initialize daily limits and due cards
  useEffect(() => {
    const initializeDailyLimits = async () => {
      const today = new Date().toDateString();
      
      if (selectedProfile === 'non-saving') {
        setTodaysNewCards(0);
      } else {
        try {
          const response = await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`);
          if (response.ok) {
            const dailyData = await response.json();
            
            if (dailyData.date !== today) {
              setTodaysNewCards(0);
              await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: today, newCardsToday: 0 })
              });
            } else {
              setTodaysNewCards(dailyData.newCardsToday || 0);
            }
          } else {
            setTodaysNewCards(0);
            await fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: today, newCardsToday: 0 })
            });
          }
        } catch (error) {
          console.error('Error loading daily SRS data:', error);
          setTodaysNewCards(0);
        }
      }
    };

    initializeDailyLimits();
  }, [selectedProfile]);

  // Update due cards when dependencies change
  useEffect(() => {
    console.log(`[MOBILE DEBUG] Available cards:`, availableCards.length, availableCards);
    const currentSettings = getSRSSettings();
    const maxNewToday = Math.max(0, currentSettings.newCardsPerDay - todaysNewCards);
    console.log(`[MOBILE DEBUG] Max new cards today:`, maxNewToday, `(total: ${currentSettings.newCardsPerDay}, used: ${todaysNewCards})`);
    
    let due = getDueCards(availableCards, { newPerDay: maxNewToday }, false);
    console.log(`[MOBILE DEBUG] Due cards (strict):`, due.length, due);
    
    if (due.length === 0) {
      due = getDueCards(availableCards, { newPerDay: maxNewToday }, true);
      console.log(`[MOBILE DEBUG] Due cards (fallback):`, due.length, due);
    }
    
    setDueCards(due);
    setCurrentDueIndex(0);
  }, [availableCards, todaysNewCards]);

  // Get SRS statistics
  const srsStats = React.useMemo(() => getReviewStats(availableCards), [availableCards]);

  // Handle card flipping
  const flipCard = useCallback(() => {
    console.log(`[MOBILE DEBUG] Flipping card from ${isFlipped} to ${!isFlipped}`);
    // Use function form to ensure immediate update
    setIsFlipped(prev => {
      console.log(`[MOBILE DEBUG] Flip state changing from ${prev} to ${!prev}`);
      return !prev;
    });
  }, [isFlipped]);

  // Enhanced navigation with animations
  const goToNextCard = useCallback(() => {
    if (dueCards.length === 0) return;
    setSwipeAnimation('slide-out-left');
    setTimeout(() => {
      setIsFlipped(false);
      setCurrentDueIndex(prev => (prev + 1) % dueCards.length);
      setSwipeAnimation('slide-in-right');
      setCardEntryAnimation('card-enter');
      setTimeout(() => {
        setSwipeAnimation('');
        setCardEntryAnimation('');
      }, 300);
    }, 200);
  }, [dueCards.length]);

  const goToPrevCard = useCallback(() => {
    if (dueCards.length === 0) return;
    setSwipeAnimation('slide-out-right');
    setTimeout(() => {
      setIsFlipped(false);
      setCurrentDueIndex(prev => prev === 0 ? dueCards.length - 1 : prev - 1);
      setSwipeAnimation('slide-in-left');
      setCardEntryAnimation('card-enter');
      setTimeout(() => {
        setSwipeAnimation('');
        setCardEntryAnimation('');
      }, 300);
    }, 200);
  }, [dueCards.length]);

  // Handle answer selection
  const markCard = useCallback((answer) => {
    if (dueCards.length === 0) return;
    
    const currentCard = dueCards[currentDueIndex];
    if (!currentCard) return;
    
    // Calculate next review using SRS algorithm
    const updatedSrsData = calculateNextReview(currentCard, answer);
    
    // Update the card in wordDefinitions with new SRS data
    const updatedCard = {
      ...currentCard,
      srsData: updatedSrsData
    };
    
    setWordDefinitions(prev => ({
      ...prev,
      [currentCard.key]: updatedCard
    }));
    
    // Update stats
    setStats(prev => ({
      ...prev,
      cardsReviewed: prev.cardsReviewed + 1,
      correctAnswers: answer !== 'incorrect' ? prev.correctAnswers + 1 : prev.correctAnswers
    }));
    
    // If this was a new card, increment today's count
    if (currentCard.srsData.status === 'new') {
      const newCount = todaysNewCards + 1;
      setTodaysNewCards(newCount);
      
      if (selectedProfile !== 'non-saving') {
        const today = new Date().toDateString();
        fetch(`https://polycast-server.onrender.com/api/profile/${selectedProfile}/srs-daily`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today, newCardsToday: newCount })
        }).catch(error => {
          console.error('Error saving daily SRS count:', error);
        });
      }
    }
    
    // Move to next card with animation
    setTimeout(() => {
      setIsFlipped(false);
      
      // Update due cards list
      const now = new Date();
      const updatedDueDate = new Date(updatedSrsData.nextReviewDate);
      const stillDueToday = (updatedDueDate - now) < (24 * 60 * 60 * 1000);
      
      if (stillDueToday && updatedSrsData.status !== 'review') {
        // Move card to end of queue
        const newDueCards = [...dueCards];
        newDueCards.splice(currentDueIndex, 1);
        newDueCards.push(updatedCard);
        setDueCards(newDueCards);
        
        if (currentDueIndex >= newDueCards.length) {
          setCurrentDueIndex(0);
        }
        
        // Trigger entry animation for next card
        setCardEntryAnimation('card-enter');
        setTimeout(() => setCardEntryAnimation(''), 400);
      } else {
        // Remove card from today's queue
        const newDueCards = dueCards.filter((_, index) => index !== currentDueIndex);
        setDueCards(newDueCards);
        
        if (currentDueIndex >= newDueCards.length && newDueCards.length > 0) {
          setCurrentDueIndex(newDueCards.length - 1);
        }
        
        // Trigger entry animation for next card if there is one
        if (newDueCards.length > 0) {
          setCardEntryAnimation('card-enter');
          setTimeout(() => setCardEntryAnimation(''), 400);
        }
      }
      
      // Refresh due cards if queue is empty
      if (dueCards.length <= 1) {
        setTimeout(() => {
          const updatedAvailableCards = [];
          Object.entries(wordDefinitions).forEach(([key, value]) => {
            if (value && value.wordSenseId && value.inFlashcards) {
              const cardToCheck = key === currentCard.key ? updatedCard : value;
              updatedAvailableCards.push({ ...cardToCheck, key });
            }
          });
          
          const maxNewForRefresh = Math.max(0, srsSettings.newCardsPerDay - todaysNewCards);
          let refreshedDueCards = getDueCards(updatedAvailableCards, { newPerDay: maxNewForRefresh }, false);
          
          if (refreshedDueCards.length === 0) {
            refreshedDueCards = getDueCards(updatedAvailableCards, { newPerDay: maxNewForRefresh }, true);
          }
          
          setDueCards(refreshedDueCards);
          setCurrentDueIndex(0);
          
          // Trigger entry animation for refreshed cards
          if (refreshedDueCards.length > 0) {
            setCardEntryAnimation('card-enter');
            setTimeout(() => setCardEntryAnimation(''), 400);
          }
        }, 500);
      }
    }, 200);
  }, [dueCards, currentDueIndex, setWordDefinitions, todaysNewCards, selectedProfile, srsSettings]);

  // Quick action for easy marking
  const quickMarkEasy = useCallback(() => {
    if (dueCards.length === 0 || !isFlipped) return;
    markCard('easy');
  }, [dueCards.length, isFlipped, markCard]);

  // Gesture callbacks
  const gestureCallbacks = useCallback({
    onDrag: (e, startPoint, currentPoint, gesture) => {
      console.log('[DRAG DEBUG] Drag detected:', { isFlipped, gesture });
      
      if (!isFlipped) return; // Only allow dragging on flipped cards
      
      const { deltaX, deltaY, distance } = gesture;
      
      // Only track horizontal drags for answer swiping
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const rotation = deltaX * 0.1; // Slight rotation based on drag
        const opacity = Math.max(0.3, 1 - (Math.abs(deltaX) / 200));
        const swipeThreshold = 100;
        const isInSwipeZone = Math.abs(deltaX) > swipeThreshold;
        
        // Calculate proportional color intensity (0 to 1)
        const colorIntensity = Math.min(1, Math.abs(deltaX) / 150);
        
        console.log('[DRAG DEBUG] Setting drag state:', { deltaX, rotation, opacity, isInSwipeZone, colorIntensity });
        
        setDragState({
          isDragging: true,
          deltaX,
          deltaY: 0,
          rotation,
          opacity,
          isInSwipeZone,
          colorIntensity
        });
      }
    },
    onSwipe: (e, gesture) => {
      e.preventDefault();
      
      if (!isFlipped) {
        // On front of card, only handle flip
        switch (gesture.direction) {
          case 'up':
            flipCard();
            break;
        }
      } else {
        // On back of card, only handle fast swipes as answers (not drags)
        // Drags are handled by onTouchEnd for Tinder-style behavior
        switch (gesture.direction) {
          case 'up':
            // Fast swipe up: Easy
            markCard('easy');
            break;
          // Remove left/right swipe handling here since drag handles it
        }
      }
      
      // Reset drag state after swipe
      setDragState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
    },
    onTap: (e, point) => {
      // Only flip if not dragging and not already animating
      console.log('[TAP DEBUG] Tap detected, isDragging:', dragState.isDragging);
      if (!dragState.isDragging && dragState.deltaX === 0 && dragState.deltaY === 0) {
        e.preventDefault();
        e.stopPropagation();
        flipCard();
      }
    },
    onTouchEnd: () => {
      console.log('[TOUCH END DEBUG] Touch ended, dragState:', dragState);
      
      // Check if card was dragged far enough to trigger auto-swipe
      const swipeThreshold = 100; // pixels
      
      if (dragState.isDragging && Math.abs(dragState.deltaX) > swipeThreshold) {
        console.log('[AUTO-SWIPE] Triggering auto-swipe with deltaX:', dragState.deltaX);
        
        // Determine direction and answer
        if (dragState.deltaX > 0) {
          // Swiped right - Correct
          console.log('[AUTO-SWIPE] Marking as correct');
          markCard('correct');
        } else {
          // Swiped left - Incorrect  
          console.log('[AUTO-SWIPE] Marking as incorrect');
          markCard('incorrect');
        }
        
        // Animate card flying off screen
        setDragState(prev => ({
          ...prev,
          deltaX: dragState.deltaX > 0 ? window.innerWidth : -window.innerWidth,
          opacity: 0
        }));
        
        // Reset after animation and trigger new card entry
        setTimeout(() => {
          setDragState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
          setCardEntryAnimation('card-enter');
          setTimeout(() => setCardEntryAnimation(''), 400);
        }, 300);
      } else {
        console.log('[TOUCH END DEBUG] Not triggering auto-swipe, resetting drag state');
        // Reset drag state when touch ends without swiping
        setDragState({ isDragging: false, deltaX: 0, deltaY: 0, opacity: 1 });
      }
    },
    onLongPress: (e, point) => {
      // Long press to show quick actions
      if (isFlipped) {
        setShowQuickActions(true);
        setTimeout(() => setShowQuickActions(false), 2000);
      }
    }
  }, [goToNextCard, goToPrevCard, flipCard, quickMarkEasy, isFlipped, markCard, dragState.isDragging]);

  // Initialize gesture handler
  useEffect(() => {
    if (!cardContainerRef.current) return;

    gestureHandlerRef.current = new TouchGestureHandler(
      cardContainerRef.current,
      gestureCallbacks
    );

    return () => {
      if (gestureHandlerRef.current) {
        gestureHandlerRef.current.destroy();
      }
    };
  }, [gestureCallbacks]);

  // Calculate session stats
  const sessionDuration = Math.floor((new Date() - stats.sessionStartTime) / 1000 / 60);
  const accuracy = stats.cardsReviewed > 0 ? Math.round((stats.correctAnswers / stats.cardsReviewed) * 100) : 0;

  if (dueCards.length === 0) {
    return (
      <div className="mobile-flashcard-mode">
        <div className="mobile-flashcard-header">
          <button className="mobile-back-btn" onClick={onBack}>
            ← Back
          </button>
          <div className="mobile-header-title">Study Complete</div>
        </div>
        
        <div className="mobile-empty-study-state">
          <div className="mobile-empty-icon">🎉</div>
          <h2>Great work!</h2>
          <p>You've completed all cards for today.</p>
          
          <div className="mobile-session-summary">
            <div className="mobile-summary-stat">
              <div className="mobile-summary-number">{stats.cardsReviewed}</div>
              <div className="mobile-summary-label">Cards Reviewed</div>
            </div>
            <div className="mobile-summary-stat">
              <div className="mobile-summary-number">{accuracy}%</div>
              <div className="mobile-summary-label">Accuracy</div>
            </div>
            <div className="mobile-summary-stat">
              <div className="mobile-summary-number">{sessionDuration}</div>
              <div className="mobile-summary-label">Minutes</div>
            </div>
          </div>
          
          <button className="mobile-done-button" onClick={onBack}>
            Return to Profiles
          </button>
        </div>
      </div>
    );
  }

  const currentCard = dueCards[currentDueIndex];
  if (!currentCard) return null;

  const baseWord = currentCard.word || currentCard.wordSenseId?.replace(/\d+$/, '');
  const defNumber = currentCard.definitionNumber || currentCard.wordSenseId?.match(/\d+$/)?.[0] || '';
  const interval = currentCard?.srsData?.interval || 1;

  return (
    <div className="mobile-flashcard-mode">
      {/* Header */}
      <div className="mobile-flashcard-header">
        <button className="mobile-back-btn" onClick={onBack}>
          ← Back
        </button>
        <div style={{color: 'red', fontSize: '10px'}}>V2.0-HC</div>
        <div className="mobile-header-stats">
          <div className="mobile-header-progress">
            {currentDueIndex + 1} of {dueCards.length}
          </div>
          <div className="mobile-header-accuracy">
            {accuracy}% • {stats.cardsReviewed} done
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mobile-progress-container">
        <div 
          className="mobile-progress-bar"
          style={{ 
            width: `${((currentDueIndex + 1) / dueCards.length) * 100}%` 
          }}
        />
      </div>

      {/* Card Container */}
      <div className="mobile-card-container" ref={cardContainerRef}>
        <div 
          className={`mobile-flashcard ${swipeAnimation} ${cardEntryAnimation}`}
          style={{
            transform: (() => {
              const baseTransform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
              const dragTransform = dragState.isDragging 
                ? `translateX(${dragState.deltaX}px) rotateZ(${dragState.rotation || 0}deg)` 
                : '';
              const finalTransform = dragState.isDragging ? `${dragTransform} ${baseTransform}` : baseTransform;
              console.log('[TRANSFORM DEBUG]', { dragState, isFlipped, finalTransform });
              return finalTransform;
            })(),
            opacity: dragState.opacity,
            transition: dragState.isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease',
            // Add proportional color feedback based on drag distance
            boxShadow: dragState.colorIntensity > 0 
              ? dragState.deltaX > 0 
                ? `0 0 ${30 * dragState.colorIntensity}px rgba(34, 197, 94, ${dragState.colorIntensity}), 0 0 ${60 * dragState.colorIntensity}px rgba(34, 197, 94, ${dragState.colorIntensity * 0.5})` // Proportional green
                : `0 0 ${30 * dragState.colorIntensity}px rgba(239, 68, 68, ${dragState.colorIntensity}), 0 0 ${60 * dragState.colorIntensity}px rgba(239, 68, 68, ${dragState.colorIntensity * 0.5})`  // Proportional red
              : undefined,
            // Add proportional background color overlay
            backgroundColor: dragState.colorIntensity > 0 
              ? dragState.deltaX > 0 
                ? `rgba(34, 197, 94, ${dragState.colorIntensity * 0.1})` // Proportional green background
                : `rgba(239, 68, 68, ${dragState.colorIntensity * 0.1})`  // Proportional red background
              : undefined
          }}
        >
          {/* Front of Card */}
          <div className="mobile-card-front">
            {currentCard.exampleSentencesGenerated ? (
              (() => {
                const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                const sentenceIndex = ((interval - 1) % 5) * 2;
                const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                const nativeTranslation = parts[sentenceIndex + 1] || parts[1] || '';
                const clozeSentence = englishSentence.replace(/~[^~]+~/g, '_____');
                
                return (
                  <div className="mobile-card-content">
                    <div className="mobile-card-sentence">
                      {clozeSentence}
                    </div>
                    {nativeTranslation && (
                      <div className="mobile-card-translation">
                        {nativeTranslation.replace(/~([^~]+)~/g, (match, word) => word)}
                      </div>
                    )}
                    <div className="mobile-card-hint">
                      Tap or swipe up to reveal answer
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="mobile-card-content">
                <div className="mobile-card-word">
                  {baseWord}
                  {defNumber && <span className="mobile-definition-number">({defNumber})</span>}
                </div>
                <div className="mobile-card-pos">{currentCard.partOfSpeech || 'word'}</div>
                <div className="mobile-card-hint">
                  Tap or swipe up to see definition
                </div>
              </div>
            )}
          </div>

          {/* Back of Card */}
          <div className="mobile-card-back">
            <div className="mobile-card-content">
              {currentCard.exampleSentencesGenerated ? (
                (() => {
                  const parts = currentCard.exampleSentencesGenerated.split('//').map(s => s.trim()).filter(s => s.length > 0);
                  const sentenceIndex = ((interval - 1) % 5) * 2;
                  const englishSentence = parts[sentenceIndex] || parts[0] || 'No example available';
                  const highlightedSentence = englishSentence.replace(/~([^~]+)~/g, (match, word) => {
                    return `<span class="mobile-highlighted-word">${word}</span>`;
                  });
                  const exampleNumber = ((interval - 1) % 5) + 1;
                  
                  return (
                    <div className="mobile-card-answer">
                      <div className="mobile-example-label">
                        Example {exampleNumber}:
                      </div>
                      <div 
                        className="mobile-example-sentence"
                        dangerouslySetInnerHTML={{ __html: highlightedSentence }}
                      />
                      {currentCard.disambiguatedDefinition && (
                        <div className="mobile-card-definition">
                          {currentCard.disambiguatedDefinition.definition}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="mobile-card-answer">
                  <div className="mobile-card-word-large">
                    {baseWord}
                  </div>
                  {currentCard.disambiguatedDefinition && (
                    <div className="mobile-card-definition">
                      {currentCard.disambiguatedDefinition.definition}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Swipe Arrows for Back of Card */}
            {isFlipped && (
              <div className="mobile-swipe-arrows">
                <div className="mobile-swipe-arrow mobile-swipe-left">
                  <div className="mobile-arrow-icon">←</div>
                  <div className="mobile-arrow-label">Incorrect</div>
                </div>
                <div className="mobile-swipe-arrow mobile-swipe-right">
                  <div className="mobile-arrow-icon">→</div>
                  <div className="mobile-arrow-label">Correct</div>
                </div>
                <div className="mobile-swipe-arrow mobile-swipe-up">
                  <div className="mobile-arrow-icon">↑</div>
                  <div className="mobile-arrow-label">Easy</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Quick Actions Overlay */}
        {showQuickActions && isFlipped && (
          <div className="mobile-quick-actions-overlay">
            <div className="mobile-quick-action-hint">
              <div className="mobile-quick-hint-text">Quick Actions:</div>
              <div className="mobile-quick-hint-item">↓ Swipe down for Easy</div>
              <div className="mobile-quick-hint-item">← → Swipe for answers</div>
            </div>
          </div>
        )}
        
        {/* Gesture Hints */}
        <div className="mobile-gesture-hints">
          {!isFlipped && (
            <div className="mobile-gesture-hint mobile-gesture-up">
              <span>↑</span>
            </div>
          )}
          {isFlipped && (
            <div className="mobile-gesture-hint mobile-gesture-down">
              <span>↓</span>
            </div>
          )}
        </div>
      </div>


      {/* Answer Buttons */}
      {isFlipped && (
        <div className="mobile-answer-buttons">
          <button 
            className="mobile-answer-btn mobile-incorrect-btn"
            onClick={() => markCard('incorrect')}
          >
            <div className="mobile-btn-emoji">❌</div>
            <div className="mobile-btn-label">Incorrect</div>
            <div className="mobile-btn-time">1 min</div>
          </button>
          
          <button 
            className="mobile-answer-btn mobile-correct-btn"
            onClick={() => markCard('correct')}
          >
            <div className="mobile-btn-emoji">✓</div>
            <div className="mobile-btn-label">Correct</div>
            <div className="mobile-btn-time">
              {formatNextReviewTime(calculateNextReview(currentCard, 'correct').nextReviewDate)}
            </div>
          </button>
          
          <button 
            className="mobile-answer-btn mobile-easy-btn"
            onClick={() => markCard('easy')}
          >
            <div className="mobile-btn-emoji">⭐</div>
            <div className="mobile-btn-label">Easy</div>
            <div className="mobile-btn-time">
              {formatNextReviewTime(calculateNextReview(currentCard, 'easy').nextReviewDate)}
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

MobileFlashcardMode.propTypes = {
  selectedProfile: PropTypes.string.isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired
};

export default MobileFlashcardMode;