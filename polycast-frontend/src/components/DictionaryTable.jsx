import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Component for displaying selected words in a dictionary-style table
 * with Spanish translations and definitions
 */
const DictionaryTable = ({ selectedWords, englishSegments }) => {
  const [wordDetails, setWordDetails] = useState({});
  const [loading, setLoading] = useState({});

  // Extract context sentence for a word from the transcript
  const findContextSentence = (word) => {
    if (!englishSegments || !englishSegments.length) return "No context available";
    
    // Case-insensitive search
    const wordLower = word.toLowerCase();
    
    // Search in every segment
    for (const segment of englishSegments) {
      const text = segment.text;
      // Check if word is in this segment (case insensitive)
      if (text.toLowerCase().includes(wordLower)) {
        return text;
      }
    }
    
    return "No context found";
  };

  // Fetch definitions for each word
  useEffect(() => {
    // Process any new words without definitions
    const wordsToFetch = selectedWords.filter(word => 
      !wordDetails[word.toLowerCase()] && !loading[word.toLowerCase()]
    );

    if (wordsToFetch.length === 0) return;

    // Mark words as loading
    const newLoading = { ...loading };
    wordsToFetch.forEach(word => {
      newLoading[word.toLowerCase()] = true;
    });
    setLoading(newLoading);

    // Fetch each word's definition
    wordsToFetch.forEach(word => {
      fetch(`/api/dictionary/${encodeURIComponent(word)}`)
        .then(res => res.json())
        .then(data => {
          setWordDetails(prev => ({
            ...prev,
            [word.toLowerCase()]: data
          }));
          setLoading(prev => ({
            ...prev,
            [word.toLowerCase()]: false
          }));
        })
        .catch(err => {
          console.error(`Error fetching definition for ${word}:`, err);
          setLoading(prev => ({
            ...prev,
            [word.toLowerCase()]: false
          }));
          // Add error state to wordDetails
          setWordDetails(prev => ({
            ...prev,
            [word.toLowerCase()]: { 
              error: true,
              translation: word,
              definition: "Error obteniendo definición",
              example: "N/A",
              partOfSpeech: "unknown"
            }
          }));
        });
    });
  }, [selectedWords, wordDetails, loading]);

  // Show loading state if no words selected
  if (selectedWords.length === 0) {
    return (
      <div className="dictionary-table-container" style={{
        padding: '20px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h2 style={{ color: '#333', marginTop: 0 }}>Dictionary</h2>
        <p style={{ color: '#666' }}>Click on words in the transcript to add them to the dictionary.</p>
      </div>
    );
  }

  // Get unique words (case-insensitive)
  const uniqueWords = [...new Map(
    selectedWords.map(word => [word.toLowerCase(), word])
  ).values()];

  return (
    <div className="dictionary-table-container" style={{
      padding: '20px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxHeight: '80vh',
      overflowY: 'auto',
      width: '100%'
    }}>
      <h2 style={{ color: '#333', marginTop: 0 }}>Dictionary</h2>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: '15px'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Word</th>
            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Spanish Definition</th>
            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Context</th>
          </tr>
        </thead>
        <tbody>
          {uniqueWords.map((word, index) => {
            const detail = wordDetails[word.toLowerCase()];
            const isLoading = loading[word.toLowerCase()];
            
            return (
              <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>
                  {word}
                  {detail && detail.partOfSpeech && !detail.error && (
                    <div style={{ fontSize: '0.8em', color: '#666', fontWeight: 'normal' }}>
                      {detail.partOfSpeech}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px 10px' }}>
                  {isLoading ? (
                    <div>Loading...</div>
                  ) : detail ? (
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#1976d2' }}>
                        {detail.translation}
                      </div>
                      <div style={{ marginBottom: '5px' }}>
                        {detail.definition}
                      </div>
                      <div style={{ fontStyle: 'italic', fontSize: '0.9em', color: '#666' }}>
                        {detail.example}
                      </div>
                    </div>
                  ) : (
                    <div>No definition available</div>
                  )}
                </td>
                <td style={{ padding: '12px 10px', fontSize: '0.9em', color: '#555' }}>
                  <div style={{ fontStyle: 'italic' }}>
                    "{findContextSentence(word)}"
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

DictionaryTable.propTypes = {
  selectedWords: PropTypes.arrayOf(PropTypes.string).isRequired,
  englishSegments: PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired,
    isNew: PropTypes.bool
  }))
};

export default DictionaryTable;
