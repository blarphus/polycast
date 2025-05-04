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
      // Use the same backend URL as the WebSocket for consistency
      const apiUrl = `https://polycast-server.onrender.com/api/dictionary/${encodeURIComponent(word)}`;
      console.log(`Fetching definition for "${word}" from: ${apiUrl}`);
      
      fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          console.log(`Received definition for "${word}":`, data);
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
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ 
          textAlign: 'center',
          padding: '40px 20px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '600px'
        }}>
          <h2 style={{ color: '#b3b3e7', marginTop: 0, fontSize: '24px' }}>Dictionary</h2>
          <p style={{ color: '#aaa', fontSize: '16px' }}>Click on words in the transcript to add them to the dictionary.</p>
        </div>
      </div>
    );
  }

  // Get unique words (case-insensitive)
  const uniqueWords = [...new Map(
    selectedWords.map(word => [word.toLowerCase(), word])
  ).values()];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      overflow: 'hidden'
    }}>
      <h2 style={{ 
        color: '#b3b3e7', 
        marginTop: 0, 
        marginBottom: '20px',
        fontSize: '28px',
        alignSelf: 'flex-start'
      }}>Dictionary</h2>
      <div style={{ 
        width: '100%',
        height: 'calc(100% - 60px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'rgba(24, 27, 47, 0.7)',
        borderRadius: '8px'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          color: '#fff'
        }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(124, 98, 255, 0.2)' }}>
              <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid rgba(124, 98, 255, 0.3)', width: '20%' }}>Word</th>
              <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid rgba(124, 98, 255, 0.3)', width: '40%' }}>Spanish Definition</th>
              <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid rgba(124, 98, 255, 0.3)', width: '40%' }}>Context</th>
            </tr>
          </thead>
          <tbody>
            {uniqueWords.map((word, index) => {
              const detail = wordDetails[word.toLowerCase()];
              const isLoading = loading[word.toLowerCase()];
              
              return (
                <tr key={index} style={{ borderBottom: '1px solid rgba(124, 98, 255, 0.15)' }}>
                  <td style={{ padding: '16px', fontWeight: 'bold', color: '#4ad991' }}>
                    {word}
                    {detail && detail.partOfSpeech && !detail.error && (
                      <div style={{ fontSize: '0.8em', color: '#aaa', fontWeight: 'normal', marginTop: '4px' }}>
                        {detail.partOfSpeech}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {isLoading ? (
                      <div style={{ color: '#aaa', fontStyle: 'italic' }}>Loading...</div>
                    ) : detail ? (
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#72aee0' }}>
                          {detail.translation}
                        </div>
                        <div style={{ marginBottom: '5px' }}>
                          {detail.definition}
                        </div>
                        <div style={{ fontStyle: 'italic', fontSize: '0.9em', color: '#aaa', marginTop: '8px' }}>
                          {detail.example}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#ff6b6b' }}>No definition available</div>
                    )}
                  </td>
                  <td style={{ padding: '16px', fontSize: '0.95em', color: '#ccc' }}>
                    <div style={{ fontStyle: 'italic', lineHeight: '1.4' }}>
                      "{findContextSentence(word)}"
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
