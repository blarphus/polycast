import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

// Helper function to render segments
const renderSegments = (segments) => {
  if (!segments || segments.length === 0) {
    return <p>Waiting...</p>; // Display placeholder if no segments
  }
  return segments.map((segment, index) => (
    <span key={index} className={segment.isNew ? 'new-text' : ''}>
      {index > 0 ? ' ' : ''}{segment.text}
    </span>
  ));
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

/**
 * Displays the received transcription and multiple translation texts in a split-screen style layout.
 */
const TranscriptionDisplay = ({ englishSegments, targetLanguages, translations, showLiveEnglish }) => {
  const englishRef = useRef(null);
  const translationRefs = useRef({});

  useEffect(() => {
    if (englishRef.current) {
      englishRef.current.scrollTop = englishRef.current.scrollHeight;
    }
  }, [englishSegments]);

  useEffect(() => {
    Object.keys(translationRefs.current).forEach(lang => {
      const ref = translationRefs.current[lang];
      if (ref) {
        ref.scrollTop = ref.scrollHeight;
      }
    });
  }, [translations]);

  useEffect(() => {
    translationRefs.current = targetLanguages.reduce((acc, lang) => {
      acc[lang] = React.createRef();
      return acc;
    }, {});
  }, [targetLanguages]);

  // Prepare translation boxes (no English)
  const langBoxes = targetLanguages.map((lang, idx) => {
    const scheme = colorSchemes[idx % colorSchemes.length];
    return {
      key: lang,
      label: lang,
      content: renderSegments(translations[lang]),
      ref: el => translationRefs.current[lang] = el,
      color: scheme,
    };
  });

  // Determine grid columns: 2 for 2-4, 3 for 5+
  let gridClass = '';
  if (langBoxes.length <= 4) gridClass = 'two-col';
  else gridClass = 'three-col';

  return (
    <div className="split-transcription-layout">
      {/* Live English box as full-width row above grid */}
      {showLiveEnglish && (
        <div
          className="live-english-box"
          style={{
            background: '#181b2f',
            color: '#fff',
            borderTop: '6px solid #7c62ff',
            boxShadow: '0 4px 20px 0 #7c62ff22',
          }}
        >
          <div className="transcription-box-label" style={{ color: '#7c62ff' }}>
            ENGLISH (LIVE)
          </div>
          <div className="transcription-box-content scrollable-text" ref={englishRef}>
            {renderSegments(englishSegments)}
          </div>
        </div>
      )}
      {/* Language grid below */}
      <div className={`transcription-grid ${gridClass}`}>
        {langBoxes.map((box, idx) => (
          <div
            key={box.key}
            className="transcription-box"
            style={{
              background: box.color.bg,
              color: box.color.fg,
              borderTop: `6px solid ${box.color.accent}`,
              boxShadow: `0 4px 20px 0 ${box.color.accent}22`,
            }}
          >
            <div className="transcription-box-label" style={{ color: box.color.accent }}>
              {box.label}
            </div>
            <div className="transcription-box-content scrollable-text" ref={box.ref}>
              {box.content}
            </div>
          </div>
        ))}
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
};

TranscriptionDisplay.defaultProps = {
  englishSegments: [],
  translations: {},
  showLiveEnglish: true,
};

export default TranscriptionDisplay;
