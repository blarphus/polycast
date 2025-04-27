import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import DraggableResizableBox from './DraggableResizableBox';

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

// Utility to get window size
function useWindowSize() {
  const [size, useState] = useState({ width: window.innerWidth, height: window.innerHeight });
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
  const [fontSize, setFontSize] = useState(18);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  const [langBoxStates, setLangBoxStates] = useState([]);

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
          width: containerRef.current.offsetWidth,
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
    const handler = (e) => setFontSize(f => {
      const newSize = Math.max(10, Math.min(48, f + (e.detail || 0)));
      // Also update the display in the controls
      const el = document.getElementById('font-size-display');
      if (el) el.textContent = `${newSize}px`;
      return newSize;
    });
    window.addEventListener('changeFontSize', handler);
    // Set initial display
    const el = document.getElementById('font-size-display');
    if (el) el.textContent = `${fontSize}px`;
    return () => window.removeEventListener('changeFontSize', handler);
  }, [fontSize]);

  // Center the English box, and make it taller
  // For single language, center translation box too
  // English box min height
  const ENGLISH_BOX_HEIGHT = 140;
  // Responsive layout for 1-4 languages (fit inside container)
  const GAP = 24;
  const SIDE_MARGIN = 12;
  const BOTTOM_MARGIN = 36;
  const boxTop = 20; // vertical offset below English box
  const langCount = targetLanguages.length;
  let langBoxLayout = [];
  if (langCount > 0 && langCount <= 4) {
    const availableWidth = containerSize.width - SIDE_MARGIN * 2 - GAP * (langCount - 1);
    const boxWidth = availableWidth / langCount;
    const availableHeight = containerSize.height - ENGLISH_BOX_HEIGHT - boxTop - GAP - BOTTOM_MARGIN;
    const boxHeight = availableHeight > 250 ? availableHeight : 250;
    for (let idx = 0; idx < langCount; ++idx) {
      langBoxLayout.push({
        x: SIDE_MARGIN + idx * (boxWidth + GAP),
        y: ENGLISH_BOX_HEIGHT + boxTop,
        w: boxWidth,
        h: boxHeight,
      });
    }
  }

  const langBoxes = targetLanguages.map((lang, idx) => {
    const scheme = colorSchemes[idx % colorSchemes.length];
    const layout = langBoxLayout[idx] || { x: 120 + idx * 280, y: 180, w: 270, h: 140 };
    return {
      key: lang,
      label: lang,
      content: isTextMode ? (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <textarea
            value={textInputs[lang] ?? ''}
            onChange={e => handleInputChange(lang, e.target.value)}
            placeholder={`Type ${lang} text here...`}
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
            }}
          />
          <button
            style={{ alignSelf: 'flex-end', background: scheme.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontWeight: 700, cursor: 'pointer', fontSize: fontSize - 2, marginTop: 8 }}
            onClick={() => handleSubmit(lang)}
          >
            Submit
          </button>
        </div>
      ) : renderSegments(translations[lang]),
      color: scheme,
      initX: layout.x,
      initY: layout.y,
      initW: layout.w,
      initH: layout.h,
    };
  });

  const renderEnglishBox = () => {
    const scheme = colorSchemes[0];
    if (isTextMode) {
      return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
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
            }}
          />
          <button
            style={{ alignSelf: 'flex-end', background: scheme.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontWeight: 700, cursor: 'pointer', fontSize: fontSize - 2, marginTop: 8 }}
            onClick={() => handleSubmit('English')}
          >
            Submit
          </button>
        </div>
      );
    } else {
      if (textInputs['English']) {
        return <span>{textInputs['English']}</span>;
      }
      return renderSegments(englishSegments);
    }
  };

  return (
    <div ref={containerRef} className="split-transcription-layout" style={{ position: 'relative', width: '100%', height: `calc(100vh - 260px - ${BOTTOM_MARGIN}px)`, margin: `0 auto ${BOTTOM_MARGIN}px auto`, overflow: 'hidden', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {showLiveEnglish && (
        <DraggableResizableBox
          initX={containerSize.width / 2 - 350}
          initY={20}
          initW={700}
          initH={ENGLISH_BOX_HEIGHT}
          bounds={false}
          style={{
            background: '#181b2f',
            color: '#fff',
            borderTop: '6px solid #7c62ff',
            marginBottom: 24,
            padding: '18px 20px',
            fontSize: fontSize,
            fontWeight: 600,
            borderRadius: 8,
            maxWidth: 900,
            minHeight: ENGLISH_BOX_HEIGHT,
            boxShadow: '0 2px 12px rgba(0,0,0,0.13)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <span style={{ letterSpacing: 0.5 }}>English</span>
          <div style={{ marginTop: 8, fontWeight: 400, fontSize: fontSize, width: '100%', textAlign: 'center' }} ref={englishRef}>
            {renderEnglishBox()}
            <div className="scroll-end" />
          </div>
        </DraggableResizableBox>
      )}
      <div style={{ width: '100%', display: 'flex', justifyContent: langCount === 1 ? 'center' : 'flex-start' }}>
        {langBoxes.map(box => (
          <DraggableResizableBox
            key={box.key}
            initX={box.initX}
            initY={box.initY}
            initW={box.initW}
            initH={box.initH}
            bounds={false}
            style={{
              background: box.color.bg,
              color: box.color.fg,
              borderTop: `6px solid ${box.color.accent}`,
              borderRadius: 8,
              boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
              padding: '12px 16px',
              fontSize: fontSize,
              fontWeight: 500,
              minWidth: 180,
              minHeight: 250,
              cursor: 'move',
              userSelect: 'none',
              overflow: 'auto',
              margin: langCount === 1 ? '0 auto' : undefined,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 7, fontSize: fontSize - 2, letterSpacing: 0.5 }}>{box.label}</div>
            <div style={{ fontWeight: 400, fontSize: fontSize, overflowY: 'auto', height: 'calc(100% - 32px)' }} ref={el => translationRefs.current[box.label] = el}>
              {box.content}
              <div className="scroll-end" />
            </div>
          </DraggableResizableBox>
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
