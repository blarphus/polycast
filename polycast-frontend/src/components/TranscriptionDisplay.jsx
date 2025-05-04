import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

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

// Helper: render a segment with clickable words
const renderSegmentsWithClickableWords = (segments, lastPersisted, selectedWords, handleWordClick) => {
  if ((!segments || segments.length === 0) && lastPersisted) {
    return <span>{lastPersisted}</span>;
  }
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>;
  }
  // Each segment on its own line
  return segments.map((segment, segIdx) => {
    // Match words (including apostrophes, accents, Unicode letters) and punctuation separately
    // Only words will be clickable
    // This regex matches words with apostrophes and accents, and separates punctuation
    const tokens = segment.text.match(/([\p{L}\p{M}\d']+|[^\p{L}\p{M}\d'\s]+)/gu) || [];
    return (
      <div key={segIdx} className={segment.isNew ? 'new-text' : ''} style={{ display: 'block', marginBottom: 2 }}>
        {tokens.map((token, i) => {
          // Only words (letters, numbers, apostrophes, accents) are clickable
          const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
          return (
            <span
              key={i}
              onClick={isWord ? (e => { e.stopPropagation(); handleWordClick(token); }) : undefined}
              style={{
                cursor: isWord ? 'pointer' : 'default',
                color: isWord && selectedWords.includes(token) ? '#1976d2' : undefined,
                background: isWord && selectedWords.includes(token) ? 'rgba(25,118,210,0.07)' : undefined,
                borderRadius: isWord && selectedWords.includes(token) ? 3 : undefined,
                transition: 'color 0.2s',
                marginRight: 0,
                marginLeft: 0,
                userSelect: 'text',
              }}
            >
              {/* Only add space if previous token was a word and this is also a word */}
              {i > 0 && /[\p{L}\p{M}\d']$/u.test(tokens[i-1]) && isWord ? ' ' : ''}{token}
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
const TranscriptionDisplay = ({ englishSegments, targetLanguages, translations, showLiveEnglish, isTextMode, onTextSubmit, textInputs, setTextInputs }) => {
  const englishRef = useRef(null);
  const translationRefs = useRef({});
  const [fontSize, setFontSize] = useState(isTextMode ? 18 : 30); // Font size: default to 30 in audio mode
  useEffect(() => {
    // Update font size default when mode changes
    setFontSize(isTextMode ? 18 : 30);
  }, [isTextMode]);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  const [langBoxStates, setLangBoxStates] = useState([]);
  const lastPersistedTranslations = useRef({});
  const [selectedWords, setSelectedWords] = useState([]);

  // Helper: add/remove word from list
  const handleWordClick = word => {
    setSelectedWords(prev => {
      if (prev.includes(word)) {
        return prev.filter(w => w !== word);
      } else {
        return [...prev, word];
      }
    });
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
                {renderSegmentsWithClickableWords(englishSegments, null, selectedWords, handleWordClick)}
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
  const transcriptVisible = showLiveEnglish || isTextMode;
  return (
    <div
      ref={containerRef}
      className="split-transcription-layout"
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 244px)',
        margin: '20px auto 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 24px 24px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        gap: 0,
      }}
    >
      {/* Transcript/English box always renders and updates first */}
      {transcriptVisible && (
        <div style={{ width: '100%', flex: '0 0 33.5%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>{renderEnglishBox()}</div>
      )}
      {/* Language boxes fill the remaining space */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: langCount === 1 ? 'center' : 'flex-start',
          flex: '1 1 66.5%',
          alignItems: 'stretch',
          minHeight: 0,
          gap: 24,
          boxSizing: 'border-box',
          marginTop: 24,
        }}
      >
        {targetLanguages.map((lang, idx) => {
          const scheme = colorSchemes[(idx + 1) % colorSchemes.length];
          const layout = langBoxLayout[idx] || { x: 0, y: 0, w: 320, h: 250 };
          const segments = translations[lang] || [];
          return (
            <div
              key={lang}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                maxHeight: '100%',
                overflow: 'hidden',
                margin: 0,
                background: scheme.bg,
                color: scheme.fg,
                borderTop: `4px solid ${scheme.accent}`,
                borderRadius: 12,
                boxShadow: '0 2px 12px 0 rgba(124, 98, 255, 0.07)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'stretch',
                padding: 0,
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 8, overflow: 'auto', minHeight: 0 }} ref={el => translationRefs.current[lang] = el}>
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
                      style={{ marginTop: 10, alignSelf: 'center', background: scheme.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
                      onClick={() => handleSubmit(lang)}
                    >
                      Submit
                    </button>
                  </>
                ) : (
                  <span style={{ fontWeight: 400, fontSize: fontSize }}>
                    {renderHistoryStacked(segments)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        position: 'absolute',
        top: 24,
        right: 24,
        minWidth: 120,
        background: 'rgba(255,255,255,0.93)',
        color: '#1976d2',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(25,118,210,0.08)',
        padding: '12px 16px',
        zIndex: 2,
        fontSize: 17,
        maxHeight: '50vh',
        overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#1976d2', fontSize: 15, letterSpacing: 0.4 }}>Clicked Words</div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {selectedWords.map((word, i) => (
            <li key={i} style={{ padding: '2px 0', borderBottom: '1px solid #e3eaf2' }}>{word}</li>
          ))}
          {selectedWords.length === 0 && <li style={{ color: '#888' }}>No words clicked</li>}
        </ul>
      </div>
    </div>
  );
};

TranscriptionDisplay.propTypes = {
  englishSegments: PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired,
    isNew: PropTypes.bool.isRequired,
  })),
  translations: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired,
    isNew: PropTypes.bool.isRequired,
  }))),
  targetLanguages: PropTypes.arrayOf(PropTypes.string).isRequired,
  showLiveEnglish: PropTypes.bool,
  isTextMode: PropTypes.bool,
  onTextSubmit: PropTypes.func,
  textInputs: PropTypes.object.isRequired,
  setTextInputs: PropTypes.func.isRequired,
};

TranscriptionDisplay.defaultProps = {
  englishSegments: [],
  translations: {},
  showLiveEnglish: true,
  isTextMode: false,
  onTextSubmit: null,
};

export default TranscriptionDisplay;
