import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * DictionaryTable
 * ----------------
 * Renders *every individual word sense* currently stored in `wordDefinitions`.
 * A word sense qualifies for display when:
 *   • `inFlashcards === true`   – it is an active entry the learner saved
 *   • `wordSenseId` exists      – guarantees uniqueness for React keys
 *   • `disambiguatedDefinition` – holds the English/Spanish definitions we want to show
 *
 * The table does **not** depend on `selectedWords`; it just trusts the canonical
 * `wordDefinitions` object delivered by the parent component (usually populated
 * in TranscriptionDisplay.jsx after sense‑disambiguation and flashcard creation).
 */
const DictionaryTable = ({ wordDefinitions, onRemoveWord }) => {
  // ────────────────────────────────────────────────────────────────────────────
  // Build an ordered list of entries to show
  // ────────────────────────────────────────────────────────────────────────────
  const entriesToDisplay = useMemo(() => {
    return Object.values(wordDefinitions || {})
      .filter(
        (e) =>
          e &&
          e.inFlashcards === true &&
          Boolean(e.wordSenseId) &&
          Boolean(e.disambiguatedDefinition)
      )
      .sort((a, b) => {
        // 1️⃣ Alphabetical by word
        const cmpWord = (a.word || '').localeCompare(b.word || '');
        if (cmpWord !== 0) return cmpWord;

        // 2️⃣ Then by part of speech
        const cmpPos = (a.partOfSpeech || '').localeCompare(b.partOfSpeech || '');
        if (cmpPos !== 0) return cmpPos;

        // 3️⃣ Finally by creation timestamp (oldest first)
        return (a.cardCreatedAt || '').localeCompare(b.cardCreatedAt || '');
      });
  }, [wordDefinitions]);

  // ────────────────────────────────────────────────────────────────────────────
  // Empty‑state UI
  // ────────────────────────────────────────────────────────────────────────────
  if (entriesToDisplay.length === 0) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: '#aaa',
          fontStyle: 'italic',
        }}
      >
        Your dictionary is empty. Click words in the transcript to add them here.
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Main table UI
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
        <thead>
          <tr style={{ backgroundColor: 'rgba(124, 98, 255, 0.2)' }}>
            <th style={{ padding: 12, textAlign: 'left' }}>Word</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Part&nbsp;of&nbsp;Speech</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Spanish</th>
            <th style={{ padding: 12, textAlign: 'left' }}>English</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Context</th>
            {onRemoveWord && <th style={{ padding: 12 }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {entriesToDisplay.map((entry) => {
            const {
              word,
              partOfSpeech,
              wordSenseId,
              contextSentence,
              disambiguatedDefinition,
            } = entry;

            const englishDef = disambiguatedDefinition?.definition ?? 'N/A';
            const spanishDef =
              disambiguatedDefinition?.spanish_equivalent ??
              disambiguatedDefinition?.translation ??
              'N/A';

            return (
              <tr
                key={wordSenseId}
                style={{ borderBottom: '1px solid rgba(124, 98, 255, 0.15)' }}
              >
                {/* Word */}
                <td style={{ padding: 12, fontWeight: 600, color: '#4ad991' }}>{word}</td>

                {/* POS */}
                <td style={{ padding: 12 }}>{partOfSpeech ?? 'N/A'}</td>

                {/* Spanish Definition */}
                <td style={{ padding: 12 }}>{spanishDef}</td>

                {/* English Definition */}
                <td style={{ padding: 12 }}>{englishDef}</td>

                {/* Context sentence */}
                <td style={{ padding: 12, fontStyle: 'italic' }}>
                  {contextSentence ?? 'N/A'}
                </td>

                {/* Remove button (optional) */}
                {onRemoveWord && (
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => onRemoveWord(wordSenseId)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#ff6b6b',
                        border: 'none',
                        borderRadius: 4,
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

DictionaryTable.propTypes = {
  wordDefinitions: PropTypes.object.isRequired,
  onRemoveWord: PropTypes.func, // optional – only needed if removal UI is desired
};

export default DictionaryTable;
