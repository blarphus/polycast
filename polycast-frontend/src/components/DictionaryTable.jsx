import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

// Utility: get first sentence from transcript containing the word
function findSampleSentence(segments, word) {
  const lower = word.toLowerCase();
  for (const segment of segments) {
    // Split into sentences (basic split, can improve)
    const sentences = segment.text.match(/[^.!?]+[.!?]?/g) || [];
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(lower)) {
        return sentence.trim();
      }
    }
  }
  return '';
}

// Fetch Spanish definition from Gemini
async function fetchGeminiDefinition(word) {
  // You may want to proxy this via backend for security
  const prompt = `Da una definición de diccionario en español para la palabra inglesa "${word}". Responde solo con la definición, como para un diccionario de aprendizaje.`;
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

const DictionaryTable = ({ selectedWords, englishSegments }) => {
  const [definitions, setDefinitions] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    // For each word, fetch definition if not already fetched
    selectedWords.forEach(word => {
      if (!definitions[word.toLowerCase()] && !loading[word.toLowerCase()]) {
        setLoading(l => ({ ...l, [word.toLowerCase()]: true }));
        fetchGeminiDefinition(word)
          .then(def => {
            setDefinitions(d => ({ ...d, [word.toLowerCase()]: def }));
            setLoading(l => ({ ...l, [word.toLowerCase()]: false }));
          })
          .catch(() => {
            setDefinitions(d => ({ ...d, [word.toLowerCase()]: 'Error fetching definition.' }));
            setLoading(l => ({ ...l, [word.toLowerCase()]: false }));
          });
      }
    });
  }, [selectedWords]);

  // Unique, case-insensitive words (show original casing for first click)
  const uniqueWords = [...selectedWords.reduce((map, w) => {
    const lower = w.toLowerCase();
    if (!map.has(lower)) map.set(lower, w);
    return map;
  }, new Map()).values()];

  return (
    <div style={{ maxWidth: 700, margin: '36px auto', background: '#23243a', borderRadius: 14, padding: 24, boxShadow: '0 2px 16px #0002' }}>
      <h2 style={{ color: '#fff', marginBottom: 20, fontWeight: 800, fontSize: 26 }}>Dictionary Table</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#e6eaff', color: '#222', fontWeight: 700 }}>
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Word</th>
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Definición (español)</th>
            <th style={{ padding: '10px 8px', textAlign: 'left' }}>Sample Sentence</th>
          </tr>
        </thead>
        <tbody>
          {uniqueWords.length === 0 ? (
            <tr><td colSpan={3} style={{ textAlign: 'center', padding: 18, color: '#888' }}>No words selected.</td></tr>
          ) : uniqueWords.map(word => (
            <tr key={word} style={{ borderBottom: '1px solid #e3eaf2' }}>
              <td style={{ padding: '8px 8px', fontWeight: 700 }}>{word}</td>
              <td style={{ padding: '8px 8px', minWidth: 220 }}>
                {loading[word.toLowerCase()] ? <span style={{ color: '#1976d2' }}>Loading…</span> : definitions[word.toLowerCase()] || ''}
              </td>
              <td style={{ padding: '8px 8px' }}>
                {findSampleSentence(englishSegments, word) || <span style={{ color: '#aaa' }}>No sentence found</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

DictionaryTable.propTypes = {
  selectedWords: PropTypes.arrayOf(PropTypes.string).isRequired,
  englishSegments: PropTypes.arrayOf(PropTypes.shape({ text: PropTypes.string.isRequired })).isRequired,
};

export default DictionaryTable;
