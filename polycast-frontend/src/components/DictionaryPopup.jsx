import React from 'react';
import PropTypes from 'prop-types';

/**
 * Netflix-style popup dialog for dictionary lookups
 */
const DictionaryPopup = ({ word, definition, position, onClose }) => {
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dictionary-popup') && !e.target.closest('.clickable-word')) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on ESC key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  if (!definition) {
    return null;
  }
  
  // Extract Spanish translation and definition for clarity
  const spanishTranslation = definition.translation || word;
  const spanishDefinition = definition.definition || 'Loading definition...';
  
  return (
    <div 
      className="dictionary-popup"
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        transform: 'translateX(-50%)',
        background: '#181a2a', // Dark background like Netflix
        color: 'white',
        padding: '16px',
        borderRadius: '6px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.7)',
        zIndex: 1000,
        width: '300px',
        maxWidth: '90vw',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Arrow/triangle at top of popup */}
      <div style={{
        position: 'absolute',
        top: '-10px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '10px solid transparent',
        borderRight: '10px solid transparent',
        borderBottom: '10px solid #181a2a',
      }} />
      
      {/* Close button */}
      <div onClick={onClose} style={{ position: 'absolute', right: 10, top: 10, cursor: 'pointer', fontSize: '1.2rem' }}>×</div>
      
      {/* Word heading (similar to Netflix UI) */}
      <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10, color: '#fff' }}>
        {word}
      </div>
      
      {/* Spanish translation and definition */}
      <div style={{ padding: '8px 0', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 500, marginBottom: 6, color: '#e6e6e6' }}>
          {spanishTranslation}
        </div>
        
        {/* Translation */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: '#7c62ff', fontWeight: 'bold', marginBottom: '4px' }}>Translation:</div>
          <div>{definition.translation || 'No translation available'}</div>
        </div>
        
        {/* Definition */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: '#7c62ff', fontWeight: 'bold', marginBottom: '4px' }}>Definition:</div>
          <div>{definition.definition || 'No definition available'}</div>
        </div>
        
        {/* Examples */}
        {definition.examples && definition.examples.length > 0 && (
          <div>
            <div style={{ color: '#7c62ff', fontWeight: 'bold', marginBottom: '4px' }}>Examples:</div>
            <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>
              {definition.examples.slice(0, 2).map((example, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>{example}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

DictionaryPopup.propTypes = {
  word: PropTypes.string.isRequired,
  definition: PropTypes.object,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

export default DictionaryPopup;
