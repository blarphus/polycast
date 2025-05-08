import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import DraggableResizableBox from './DraggableResizableBox';
import ClickableWord from './ClickableWord';

// Helper function to render segments
const renderSegments = (segments, lastPersisted) => {
  if ((!segments || segments.length === 0) && lastPersisted) {
    // Show the last persisted translation if segments are empty
    return <span>{lastPersisted}</span>;
  }
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>; // Display placeholder if no segments and nothing persisted
  }
  return segments.map((segment, index) => (
    <span key={index} className={segment.isNew ? 'new-text' : ''}>
      {index > 0 ? ' ' : ''}{segment.text}
    </span>
  ));
};

// Helper function to render segments as lines (audio mode)
const renderSegmentsStacked = (segments, lastPersisted) => {
  if ((!segments || segments.length === 0) && lastPersisted) {
    return <span>{lastPersisted}</span>;
  }
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {segments.map((segment, index) => (
        <span key={index} className={segment.isNew ? 'new-text' : ''} style={{ marginBottom: 2 }}>
          {segment.text}
        </span>
      ))}
    </div>
  );
};

// Helper function to render all historical segments for a language
const renderHistoryStacked = (segments) => {
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>;
  }
  // Show only the last 10 segments (instead of previous 3)
  const visibleSegments = segments.slice(-10);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {visibleSegments.map((segment, index) => (
        <span key={index} className={segment.isNew ? 'new-text' : ''} style={{ marginBottom: 2 }}>
          {segment.text}
        </span>
      ))}
    </div>
  );
};

// Helper: render a segment with clickable words
const renderSegmentsWithClickableWords = (segments, lastPersisted, selectedWords, handleWordClick, wordDefinitions) => {
  if ((!segments || segments.length === 0) && lastPersisted) {
    return <span>{lastPersisted}</span>;
  }
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>;
  }
  // Each segment on its own line
  return segments.map((segment, segIdx) => {
    // Tokenize: words (with apostrophes/accents), punctuation, and spaces
    // This regex matches words, punctuation, and spaces
    const tokens = segment.text.match(/[\w\p{L}\p{M}'']+|[.,!?;:()\[\]{}—–-]|\s+/gu) || [segment.text];
    
    return (
      <div key={segIdx} className={segment.isNew ? 'new-text' : ''} style={{ display: 'block', marginBottom: 2 }}>
        {tokens.map((token, i) => {
          // Only words (letters, numbers, apostrophes, accents) are clickable
          const isWord = /^[\w\p{L}\p{M}'']+$/u.test(token);
          const canClick = isWord && token.length > 1; // Don't make single letters clickable
          
          // Use the ClickableWord component for words that can be clicked
          if (canClick) {
            return (
              <ClickableWord 
                key={i}
                word={token}
                onWordClick={handleWordClick}
                wordDefinitions={wordDefinitions}
              />
            );
          }
          
          // For non-clickable tokens (spaces, punctuation, etc.)
          return (
            <span
              key={i}
              style={{
                userSelect: 'text',
              }}
            >
              {token}
            </span>
          );
        })}
      </div>
    );
  });
};

// Assign a unique color scheme for each language box
const colorSchemes = [
  { bg: '#2d2a3a', fg: '#fff', accent: '#7c62ff' }, // deep purple
  { bg: '#1b3a4b', fg: '#fff', accent: '#4ad991' }, // teal blue
  { bg: '#4a2c2a', fg: '#fff', accent: '#ffb86b' }, // brown-orange
  { bg: '#2a4a3a', fg: '#fff', accent: '#72e0b2' }, // green
  { bg: '#4a2a4a', fg: '#fff', accent: '#e072e0' }, // purple-pink
  { bg: '#2a3a4a', fg: '#fff', accent: '#72aee0' }, // blue
];

// Utility to get window size
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
}

/**
 * Displays the received transcription and multiple translation texts in a split-screen style layout.
 */
const TranscriptionDisplay = ({ 
  englishSegments, 
  targetLanguages, 
  translations, 
  showLiveTranscript, 
  showTranslation, 
  isTextMode, 
  onTextSubmit, 
  textInputs, 
  setTextInputs,
  selectedWords,
  setSelectedWords,
  wordDefinitions,
  setWordDefinitions
}) => {
  const englishRef = useRef(null);
  const translationRefs = useRef({});
  const [fontSize, setFontSize] = useState(isTextMode ? 18 : 30); // Font size: default to 30 in audio mode
  
  // Dictionary popup state - Netflix-style popups for word definitions
  const [popupInfo, setPopupInfo] = useState({
    word: null,
    position: { x: 0, y: 0 }
  });
  
  useEffect(() => {
    // Update font size default when mode changes
    setFontSize(isTextMode ? 18 : 30);
  }, [isTextMode]);
  
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [langBoxStates, setLangBoxStates] = useState([]);
  const lastPersistedTranslations = useRef({});
  
  // Timeout ref for hiding popup after delay
  const popupTimeoutRef = useRef(null);

  // Handle word click to show dictionary popup
  const handleWordClick = (word, e) => {
    // Get word info (lowercase for lookup)
    const wordLower = word.toLowerCase();
    
    // Get clicked element position for popup
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Check if we're closing the same popup
    if (popupInfo.word === word) {
      setPopupInfo({ word: null, position: { x: 0, y: 0 } });
      return;
    }
    
    // Position popup below the clicked word
    setPopupInfo({ 
      word: word,
      position: { 
        x: rect.left + (rect.width / 2), // Center horizontally on word
        y: rect.bottom + window.scrollY + 5 // Place below word
      }
    });
    
    // Add the word to dictionary if not already there
    const isSelected = selectedWords.some(w => w.toLowerCase() === wordLower);
    if (!isSelected) {
      // Add the word to selected words
      setSelectedWords(prev => [...prev, word]);
      
      // Find the sentence context where this word appears
      const contextSentence = englishSegments.find(segment => 
        segment.text.toLowerCase().includes(wordLower)
      )?.text || "";
      
      // Preload the definition immediately with context
      const apiUrl = `https://polycast-server.onrender.com/api/dictionary/${encodeURIComponent(word)}?context=${encodeURIComponent(contextSentence)}`;
      console.log(`Preloading definition for "${word}" with context, from: ${apiUrl}`);
      
      fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          console.log(`Preloaded definition for "${word}":`, data);
          setWordDefinitions(prev => ({
            ...prev,
            [word.toLowerCase()]: data
          }));
        })
        .catch(err => {
          console.error(`Error preloading definition for ${word}:`, err);
        });
        
      // Generate image for the flashcard at the same time
      const imagePrompt = `Create a visually engaging, wordless flashcard image in the style of Charley Harper. Use bold shapes, minimal detail, and mid-century modern aesthetics to depict the concept in a memorable and metaphorical way. Avoid text or labels. Again, use no text. The word to illustrate is: "${word}".`;
      
      console.log(`Generating image for word: ${word}`);
      
      fetch(`https://polycast-server.onrender.com/api/generate-image?prompt=${encodeURIComponent(imagePrompt)}`, {
        mode: 'cors'
      })
        .then(res => {
          if (!res.ok) throw new Error(`Failed with status: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log(`Image generated for: ${word}`);
          // We need to update wordDefinitions to include the image URL
          setWordDefinitions(prev => ({
            ...prev,
            [word.toLowerCase()]: {
              ...prev[word.toLowerCase()],
              imageUrl: data.url
            }
          }));
        })
        .catch(err => {
          console.error(`Error generating image for ${word}:`, err);
        });
    }
  };

  const handleInputChange = (lang, value) => {
    setTextInputs(inputs => ({ ...inputs, [lang]: value }));
  };

  const handleSubmit = (lang) => {
    if (onTextSubmit && typeof onTextSubmit === 'function') {
      onTextSubmit(lang, textInputs[lang] || '');
    }
  };

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setContainerSize({
          width: window.innerWidth, // Use full viewport width for layout
          height: containerRef.current.offsetHeight
        });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (englishRef.current) {
      const end = englishRef.current.querySelector('.scroll-end');
      if (end) end.scrollIntoView({ behavior: 'auto' });
    }
    Object.values(translationRefs.current).forEach(ref => {
      if (ref && ref instanceof HTMLElement) {
        const end = ref.querySelector('.scroll-end');
        if (end) end.scrollIntoView({ behavior: 'auto' });
      }
    });
  }, [englishSegments, translations]);

  // Listen for font size change events from Controls
  useEffect(() => {
    const handler = (e) => {
      setFontSize(f => {
        const newSize = Math.max(10, Math.min(96, f + (e.detail || 0)));
        const el = document.getElementById('font-size-display');
        if (el) el.textContent = `${newSize}px`;
        return newSize;
      });
    };
    window.addEventListener('changeFontSize', handler);
    // Set initial display
    const el = document.getElementById('font-size-display');
    if (el) el.textContent = `${fontSize}px`;
    return () => window.removeEventListener('changeFontSize', handler);
  }, [fontSize]);

  // Update last persisted translations whenever translations change
  useEffect(() => {
    for (const lang of targetLanguages) {
      const segs = translations[lang];
      if (segs && segs.length > 0) {
        lastPersistedTranslations.current[lang] = segs.map(s => s.text).join(' ');
      }
    }
  }, [translations, targetLanguages]);

  // Center the English box, and make it taller
  // For single language, center translation box too
  // English box min height
  const ENGLISH_BOX_HEIGHT = 180;
  // Responsive layout for 1-4 languages (fit inside container)
  const GAP = 24;
  const SIDE_MARGIN = 24;
  const BOTTOM_MARGIN = 24;
  const boxTop = 20; // vertical offset below English box
  const langCount = targetLanguages.length;
  let langBoxLayout = [];
  const toolbar = document.querySelector('.controls');
  let toolbarCenter = window.innerWidth / 2;
  if (toolbar) {
    const rect = toolbar.getBoundingClientRect();
    toolbarCenter = rect.left + rect.width / 2;
  }
  if (langCount > 0 && langCount <= 4) {
    const availableWidth = containerSize.width - SIDE_MARGIN * 2 - GAP * (langCount - 1);
    const boxWidth = availableWidth / langCount;
    const availableHeight = containerSize.height - ENGLISH_BOX_HEIGHT - boxTop - GAP - BOTTOM_MARGIN;
    const boxHeight = availableHeight > 250 ? availableHeight : 250;
    // Calculate the left offset so the boxes are centered with the toolbar
    const totalBoxesWidth = langCount * boxWidth + (langCount - 1) * GAP;
    const leftOffset = toolbarCenter - totalBoxesWidth / 2;
    for (let idx = 0; idx < langCount; ++idx) {
      langBoxLayout.push({
        x: leftOffset + idx * (boxWidth + GAP),
        y: ENGLISH_BOX_HEIGHT + boxTop,
        w: boxWidth,
        h: boxHeight,
      });
    }
  }

  // English box layout (centered in CSS, matching container)
  let englishBoxInit = { x: 0, y: 0, w: 480, h: ENGLISH_BOX_HEIGHT };
  const englishBoxWidth = containerSize.width > 600 ? 480 : Math.max(320, containerSize.width - 40);
  const containerWidth = containerRef.current?.offsetWidth || containerSize.width;
  englishBoxInit = {
    x: (containerWidth - englishBoxWidth) / 2,
    y: 0, // Use margin for vertical spacing
    w: englishBoxWidth,
    h: ENGLISH_BOX_HEIGHT,
  };

  const renderEnglishBox = () => {
    const scheme = colorSchemes[0];
    return (
      <div
        style={{
          width: '100%',
          overflowY: 'auto',
          background: '#181b2f',
          color: '#fff',
          borderTop: '6px solid #7c62ff',
          borderRadius: 10,
          boxShadow: '0 2px 12px 0 rgba(124, 98, 255, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          padding: 0,
          minHeight: 0,
          flex: 1,
        }}
      >
        <span style={{ letterSpacing: 0.5, textAlign: 'center', fontWeight: 800, fontSize: 20, margin: '18px 0 10px 0', color: '#b3b3e7', textTransform: 'uppercase', opacity: 0.92 }}>
          {isTextMode ? 'English' : 'Transcript'}
        </span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 8, overflow: 'auto' }} ref={englishRef}>
          {isTextMode ? (
            <>
              <textarea
                value={textInputs['English'] ?? ''}
                onChange={e => handleInputChange('English', e.target.value)}
                placeholder={`Type English text here...`}
                style={{
                  width: '100%',
                  height: '100%',
                  flex: 1,
                  fontSize: fontSize,
                  borderRadius: 6,
                  border: `1.5px solid ${scheme.accent}`,
                  padding: 8,
                  resize: 'none',
                  background: scheme.bg,
                  color: scheme.fg,
                  boxSizing: 'border-box',
                  minHeight: 80,
                }}
                onKeyDown={e => {
                  if (isTextMode && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit('English');
                  }
                }}
              />
              <button
                style={{ marginTop: 10, alignSelf: 'center', background: scheme.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
                onClick={() => handleSubmit('English')}
              >
                Submit
              </button>
            </>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <span style={{ fontWeight: 400, fontSize: fontSize }}>
                {renderSegmentsWithClickableWords(englishSegments, null, selectedWords, handleWordClick, wordDefinitions)}
              </span>
              <div className="scroll-end" />
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Main render ---
  // Use flex layout to fill the available vertical space
  const transcriptVisible = showLiveTranscript || isTextMode;
  const translationVisible = showTranslation;

  // Render a translation box for a target language
  const renderLanguageBox = (lang, boxIndex) => {
    const scheme = colorSchemes[boxIndex % colorSchemes.length];
    const segments = translations[lang] || [];
    
    return (
      <div
        key={lang}
        style={{
          position: 'relative',
          background: scheme.bg,
          color: scheme.fg,
          borderTop: `6px solid ${scheme.accent}`,
          borderRadius: 10,
          boxShadow: `0 2px 12px 0 ${scheme.accent}14`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          padding: 0,
          width: '100%',
          marginTop: 8, // Reduced from 16px to 8px for tighter spacing
          overflow: 'hidden',
        }}
      >
        <span style={{ 
          letterSpacing: 0.5, 
          textAlign: 'center', 
          fontWeight: 800, 
          fontSize: 20, 
          margin: '18px 0 10px 0',
          color: scheme.accent + 'cc',
          textTransform: 'uppercase',
          opacity: 0.92,
        }}>
          {lang}
        </span>
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 16, 
          gap: 8, 
          overflow: 'auto', 
          minHeight: 0 
        }} ref={el => translationRefs.current[lang] = el}>
          {isTextMode ? (
            <>
              <textarea
                value={textInputs[lang] ?? ''}
                style={{
                  width: '100%',
                  height: '100%',
                  flex: 1,
                  fontSize: fontSize,
                  borderRadius: 6,
                  border: `1.5px solid ${scheme.accent}`,
                  padding: 8,
                  resize: 'none',
                  background: scheme.bg,
                  color: scheme.fg,
                  boxSizing: 'border-box',
                  minHeight: 80,
                }}
                onChange={e => handleInputChange(lang, e.target.value)}
                onKeyDown={e => {
                  if (isTextMode && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(lang);
                  }
                }}
              />
              <button
                style={{ 
                  marginTop: 10, 
                  alignSelf: 'center', 
                  background: scheme.accent, 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 6, 
                  padding: '6px 18px', 
                  fontWeight: 700, 
                  fontSize: 16, 
                  cursor: 'pointer' 
                }}
                onClick={() => handleSubmit(lang)}
              >
                Submit
              </button>
            </>
          ) : (
            <span style={{ fontWeight: 400, fontSize: fontSize }}>
              {renderSegmentsWithClickableWords(segments, lastPersistedTranslations.current[lang], selectedWords, handleWordClick, wordDefinitions)}
            </span>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="transcription-container" ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 244px)',
        margin: '10px auto 0', // Reduced from 20px to 10px
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 24px 12px', // Reduced bottom padding from 24px to 12px
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Live Transcript Section */}
      {showLiveTranscript && (
        <div style={{ width: '100%', maxHeight: '100%', overflowY: 'hidden' }}>
          {renderEnglishBox()}
        </div>
      )}

      {/* Translations Section */}
      {showTranslation && (
        <div style={{ width: '100%', marginTop: 6 }}> {/* Reduced from 20px to 6px */}
          {targetLanguages.map((lang, i) => (
            renderLanguageBox(lang, i + 1)
          ))}
        </div>
      )}
      
      {/* Dictionary Popup */}
      {popupInfo.word && (
        <ClickableWord 
          word={popupInfo.word}
          wordDefinitions={wordDefinitions}
          onWordClick={handleWordClick}
        />
      )}
    </div>
  );
};

TranscriptionDisplay.propTypes = {
  englishSegments: PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired,
    isNew: PropTypes.bool
  })),
  targetLanguages: PropTypes.arrayOf(PropTypes.string).isRequired,
  translations: PropTypes.object.isRequired,
  showLiveTranscript: PropTypes.bool,
  showTranslation: PropTypes.bool,
  isTextMode: PropTypes.bool.isRequired,
  onTextSubmit: PropTypes.func,
  textInputs: PropTypes.object.isRequired,
  setTextInputs: PropTypes.func.isRequired,
  selectedWords: PropTypes.array.isRequired,
  setSelectedWords: PropTypes.func.isRequired,
  wordDefinitions: PropTypes.object.isRequired,
  setWordDefinitions: PropTypes.func.isRequired
};

TranscriptionDisplay.defaultProps = {
  englishSegments: [],
  translations: {},
  showLiveTranscript: true,
  showTranslation: true,
  isTextMode: false,
  onTextSubmit: null,
};

export default TranscriptionDisplay;
