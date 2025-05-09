import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import WordDefinitionPopup from './WordDefinitionPopup';

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
const renderSegmentsWithClickableWords = (segments, lastPersisted, selectedWords, handleWordClick, isWordInSelectedListFn) => {
  // Default implementation if no function is provided
  const checkWordInList = isWordInSelectedListFn || ((word) => {
    return selectedWords.some(w => w.toLowerCase() === word.toLowerCase());
  });
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
    const tokens = segment.text.match(/([\p{L}\p{M}\d']+|[.,!?;:]+|\s+)/gu) || [];
    return (
      <div key={segIdx} className={segment.isNew ? 'new-text' : ''} style={{ display: 'block', marginBottom: 2 }}>
        {tokens.map((token, i) => {
          // Only words (letters, numbers, apostrophes, accents) are clickable
          const isWord = /^[\p{L}\p{M}\d']+$/u.test(token);
          return (
            <span
              key={i}
              onClick={isWord ? (e => { 
                e.stopPropagation(); 
                handleWordClick(token, e); // Pass the event to get the position
              }) : undefined}
              style={{
                cursor: isWord ? 'pointer' : 'default',
                color: isWord && checkWordInList(token, segment.text) ? '#1976d2' : undefined,
                background: isWord && checkWordInList(token, segment.text) ? 'rgba(25,118,210,0.07)' : undefined,
                borderRadius: isWord && checkWordInList(token, segment.text) ? 3 : undefined,
                transition: 'color 0.2s',
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
  setWordDefinitions,
  isStudentMode = false
}) => {
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
  
  // State for word definition popup
  const [popupInfo, setPopupInfo] = useState({
    visible: false,
    word: '',
    position: { x: 0, y: 0 }
  });

  // Only shows the popup when a word is clicked, doesn't add the word to dictionary
  const handleWordClick = async (word, event) => {
    if (!event) return;
    
    const wordLower = word.toLowerCase();
    
    // Calculate position for popup
    const rect = event.currentTarget.getBoundingClientRect();
    
    // Position popup right next to the word
    const viewportWidth = window.innerWidth;
    const popupWidth = 380; // Match width from CSS
    
    // Calculate optimal position to avoid going off screen
    const spaceOnRight = viewportWidth - rect.right;
    const fitsOnRight = spaceOnRight >= popupWidth + 10;
    
    // Position to the right if there's room, otherwise to the left
    const xPos = fitsOnRight ? rect.right + 5 : rect.left - popupWidth - 5;
    
    // Get the element that was clicked
    const clickedElement = event.currentTarget;
    
    // Find the parent segment element (which is the div containing the clicked word)
    let segmentElement = clickedElement.closest('div');
    let segmentText = segmentElement?.textContent || "";
    
    // Use the segment text as context rather than just finding the first occurrence
    let contextSentence = segmentText || "";
    
    // If we couldn't get context from the clicked element, fall back to finding it in englishSegments
    if (!contextSentence) {
      contextSentence = englishSegments.find(segment => 
        segment.text.toLowerCase().includes(wordLower)
      )?.text || "";
    }
    
    console.log(`Using context for "${word}": "${contextSentence}"`, { from: segmentText ? 'clicked element' : 'segments search' });
    
    // Format the context with the target word emphasized with asterisks for Gemini
    // (we'll use a case-insensitive replace to maintain the original casing of the word)
    if (contextSentence) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      contextSentence = contextSentence.replace(regex, (match) => `*${match}*`);
      console.log(`Context with emphasis: ${contextSentence}`);
    }
    
    // Check if word exists in wordDefinitions
    const existingWordData = wordDefinitions[wordLower];
    const isAlreadyInDictionary = existingWordData ? doesWordSenseExist(word, contextSentence) : false;
    
    // Set initial popup state
    setPopupInfo({
      visible: true,
      word: word,
      position: {
        x: Math.max(5, Math.min(viewportWidth - popupWidth - 5, xPos)), // Keep on screen
        y: rect.top - 5 // Position slightly above the word
      },
      loading: true, // Set loading state while we fetch definitions
      contextSentence: contextSentence, // Store context for reference
      wordAddedToDictionary: isAlreadyInDictionary // Set to true if already in dictionary
    });
    
    try {
      // Step 1: Fetch Gemini definition with context
      const apiUrl = `https://polycast-server.onrender.com/api/dictionary/${encodeURIComponent(word)}?context=${encodeURIComponent(contextSentence)}`;
      console.log(`Fetching definition for "${word}" with context, from: ${apiUrl}`);
      
      const geminiFetch = fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          console.log(`Received definition for "${word}":`, data);
          return data;
        })
        .catch(err => {
          console.error(`Error fetching definition for ${word}:`, err);
          return null;
        });
      
      // Step 2: Fetch dictionary definition from JSON files
      const firstLetter = word.charAt(0).toLowerCase();
      const dictUrl = `https://polycast-server.onrender.com/api/local-dictionary/${encodeURIComponent(firstLetter)}/${encodeURIComponent(word.toUpperCase())}?context=${encodeURIComponent(contextSentence)}`;
      
      console.log(`Fetching dictionary definition for "${word}" from: ${dictUrl}`);
      
      const dictFetch = fetch(dictUrl)
        .then(res => res.json())
        .then(dictData => {
          console.log(`Received dictionary definition for "${word}":`, dictData);
          return dictData;
        })
        .catch(err => {
          console.error(`Error fetching dictionary definition for ${word}:`, err);
          return null;
        });
      
      // Wait for both fetches to complete
      const [geminiData, dictData] = await Promise.all([geminiFetch, dictFetch]);
      
      // Step 3: If we have multiple definitions, disambiguate using Gemini
      let disambiguatedDefinition = null;
      
      if (dictData && dictData.allDefinitions && dictData.allDefinitions.length > 1) {
        // Use the disambiguation API to find the correct sense
        try {
          console.log(`Disambiguating definition for "${word}" in context: "${contextSentence}"`);
          
          const disambiguationResponse = await fetch('https://polycast-server.onrender.com/api/disambiguate-word', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              word: word,
              contextSentence: contextSentence,
              definitions: dictData.allDefinitions
            })
          }).then(res => res.json());
          
          console.log(`Disambiguation result:`, disambiguationResponse);
          disambiguatedDefinition = disambiguationResponse.disambiguatedDefinition;
        } catch (error) {
          console.error(`Error disambiguating definition for ${word}:`, error);
          // Fall back to first definition if disambiguation fails
          disambiguatedDefinition = dictData.allDefinitions[0];
        }
      } else if (dictData && dictData.allDefinitions && dictData.allDefinitions.length === 1) {
        // Only one definition, no need to disambiguate
        disambiguatedDefinition = dictData.allDefinitions[0];
      }
      
      // Update the wordDefinitions state with all the data
      setWordDefinitions(prev => ({
        ...prev,
        [wordLower]: {
          ...geminiData, // Gemini API definition
          dictionaryDefinition: dictData, // Full dictionary data
          disambiguatedDefinition: disambiguatedDefinition, // The most relevant definition
          contextSentence: contextSentence // Save the context for flashcards
        }
      }));
      
      // Update popup info to remove loading state
      setPopupInfo(prev => ({
        ...prev,
        loading: false
      }));
    } catch (error) {
      console.error(`Error processing definitions for ${word}:`, error);
      
      // Update popup info to remove loading state even on error
      setPopupInfo(prev => ({
        ...prev,
        loading: false
      }));
    }
  };
  
  // Function to check if a word in a specific context is in the selected words list
  const isWordInSelectedList = (word, contextSentence) => {
    if (!word || !contextSentence) return false;
    
    const wordLower = word.toLowerCase();
    const wordData = wordDefinitions[wordLower];
    
    // Basic check (backward compatibility)
    if (!wordData) return selectedWords.some(w => w.toLowerCase() === wordLower);
    
    // Get the part of speech from the contextual word if possible
    let currentPoS = null;
    
    // Try to determine part of speech from the context
    if (wordData.disambiguatedDefinition) {
      currentPoS = wordData.disambiguatedDefinition.partOfSpeech;
    } else if (wordData.dictionaryDefinition && wordData.dictionaryDefinition.partOfSpeech) {
      currentPoS = wordData.dictionaryDefinition.partOfSpeech;
    }
    
    // With our new storage format, check if this word has multiple senses
    if (wordData.hasMultipleSenses && wordData.allSenses) {
      // Check each stored sense for this word
      for (const senseKey of wordData.allSenses) {
        const sense = wordDefinitions[senseKey];
        if (!sense || !sense.inFlashcards) continue;
        
        // Check if contexts are similar - this matches by sentence contexts
        const contextMatch = sense.contextSentence && 
                           contextSentence && 
                           (contextSentence.includes(sense.contextSentence) || 
                            sense.contextSentence.includes(contextSentence));
                            
        // If contexts match or parts of speech match for this specific case
        if (contextMatch || (currentPoS && sense.partOfSpeech === currentPoS)) {
          return true;
        }
      }
      return false;
    }
    
    // Fallback for legacy format: check all entries for matching contexts
    for (const entry of Object.values(wordDefinitions)) {
      if (entry.contextSentence && 
          entry.contextSentence.toLowerCase().includes(wordLower) &&
          contextSentence.includes(entry.contextSentence) &&
          entry.inFlashcards === true) {
        return true;
      }
    }
    
    return false;
  };
  
  // Get all existing flashcard sense IDs
  const getAllFlashcardSenseIds = () => {
    return Object.values(wordDefinitions)
      .filter(def => def.wordSenseId && def.inFlashcards)
      .map(def => def.wordSenseId);
  };
  
  // Function to check if a specific word sense already exists
  const doesWordSenseExist = (word, contextSentence) => {
    if (!word || !contextSentence) return false;
    
    const wordLower = word.toLowerCase();
    
    // Get the current definition from wordDefinitions
    const currentWordData = wordDefinitions[wordLower];
    if (!currentWordData) return false;
    
    // Extract current definition and part of speech
    const currentDefinition = currentWordData.disambiguatedDefinition || 
                             (currentWordData.dictionaryDefinition && 
                              currentWordData.dictionaryDefinition.allDefinitions && 
                              currentWordData.dictionaryDefinition.allDefinitions[0]) ||
                             currentWordData.definition;

    if (!currentDefinition) return false;
    
    const currentPartOfSpeech = currentDefinition.partOfSpeech || 
                              (currentWordData.dictionaryDefinition && currentWordData.dictionaryDefinition.partOfSpeech) ||
                              currentWordData.partOfSpeech;
    
    // With our new storage format, check if this word has multiple senses
    if (currentWordData.hasMultipleSenses && currentWordData.allSenses) {
      // Check each stored sense for this word
      for (const senseKey of currentWordData.allSenses) {
        const sense = wordDefinitions[senseKey];
        if (!sense || !sense.inFlashcards) continue;
        
        // Check context similarity
        const contextMatch = sense.contextSentence && 
                           (contextSentence.includes(sense.contextSentence) || 
                            sense.contextSentence.includes(contextSentence));
        
        if (contextMatch) {
          console.log(`Found matching context for ${word}: "${contextSentence}" matches "${sense.contextSentence}"`);
          return true;
        }
        
        // If context doesn't match, check part of speech and definition
        if (sense.partOfSpeech && currentPartOfSpeech && 
            sense.partOfSpeech === currentPartOfSpeech) {
          
          // Get definition texts
          const defText1 = currentDefinition.definition || '';
          const defText2 = sense.disambiguatedDefinition?.definition || '';
          
          // Check similarity
          const similarDefinition = (defText1 && defText2 && 
                                  (defText1.includes(defText2) || 
                                   defText2.includes(defText1) ||
                                   defText1.substring(0, 25) === defText2.substring(0, 25)));
          
          if (similarDefinition) {
            console.log(`Found matching definition for ${word} (${sense.partOfSpeech}): ${defText1} matches ${defText2}`);
            return true;
          }
        }
      }
      return false;
    }
    
    // Fallback for legacy format: check all entries for context and definition matches
    for (const entry of Object.values(wordDefinitions)) {
      if (entry.inFlashcards !== true) continue;
      
      // Check if this is a specific sense entry of a different word
      if (entry.word && entry.word !== wordLower) continue;
      
      // First check context - if sentences are similar, likely same meaning
      const contextMatch = entry.contextSentence && 
                          entry.contextSentence.toLowerCase().includes(wordLower) &&
                          (contextSentence.includes(entry.contextSentence) || 
                           entry.contextSentence.includes(contextSentence));
      
      if (contextMatch) return true;
      
      // If context doesn't match, check if definitions are the same
      const entryDefinition = entry.disambiguatedDefinition || 
                             (entry.dictionaryDefinition && 
                              entry.dictionaryDefinition.allDefinitions && 
                              entry.dictionaryDefinition.allDefinitions[0]) ||
                             entry.definition;
      
      if (!entryDefinition) continue;
      
      // Check if the part of speech matches
      const posMatch = currentPartOfSpeech === (entryDefinition.partOfSpeech || entry.partOfSpeech);
      
      // Check if the definition text matches
      const defText1 = currentDefinition.definition || '';
      const defText2 = entryDefinition.definition || '';
      
      // Simple similarity check
      const similarDefinition = (defText1 && defText2 && 
                                (defText1.includes(defText2) || 
                                 defText2.includes(defText1) ||
                                 defText1.substring(0, 25) === defText2.substring(0, 25)));
      
      if (posMatch && similarDefinition) {
        console.log(`Found matching definition for ${word}: ${defText1} matches ${defText2}`);
        return true;
      }
    }
    
    return false;
  };

  // Function to add word to dictionary when the + button is clicked
  const handleAddWordToDictionary = async (word) => {
    const wordLower = word.toLowerCase();
    console.log(`Adding "${word}" to dictionary...`);
    
    // Immediately update the popup to show the checkmark
    setPopupInfo(prev => ({
      ...prev,
      wordAddedToDictionary: true
    }));
    
    // Get the word data with definitions
    const wordData = wordDefinitions[wordLower];
    
    if (!wordData) {
      console.error('No definition data found for word:', word);
      return;
    }
    
    // Get the context sentence from the word data
    const contextSentence = wordData.contextSentence || '';
    
    // Check if this specific sense of the word is already in the dictionary
    if (doesWordSenseExist(word, contextSentence)) {
      console.log(`This specific sense of "${word}" is already in the dictionary: "${contextSentence.substring(0, 30)}..."`);
      // Update UI to show it's already added, but don't duplicate
      setPopupInfo(prev => ({
        ...prev, 
        wordAddedToDictionary: true,
        existingWordSense: true
      }));
      return;
    }
    
    // Add the word to the selectedWords right away to update UI
    // Note: we now just store the word text. The actual context is stored in wordDefinitions
    setSelectedWords(prev => {
      // We now allow multiple entries of the same word with different senses
      console.log(`Adding "${word}" to selected words list in context: "${contextSentence.substring(0, 30)}..."`);
      // Still add to the list for backward compatibility
      if (!prev.some(w => w.toLowerCase() === wordLower)) {
        return [...prev, word];
      }
      return prev;
    });
    if (!contextSentence) {
      console.error('No context sentence found for word:', word);
      return;
    }
    
    try {
      // Get dictionary definitions from the word data
      const dictData = wordData.dictionaryDefinition;
      
      // We need to check if dictData exists and has valid content
      if (!dictData) {
        console.warn(`No dictionary data found for word: ${word}. Using disambiguated definition instead.`);
        // If we don't have dictionary definition, but we do have a disambiguated definition, use that
        if (wordData.disambiguatedDefinition) {
          console.log(`Using disambiguated definition for ${word}:`, wordData.disambiguatedDefinition);
        } else if (wordData.definition) {
          console.log(`Using Gemini definition for ${word}:`, wordData.definition);
        } else {
          console.error(`No usable definition found for word: ${word}`);
          return;
        }
      } else if (!dictData.definitions || dictData.definitions.length === 0) {
        // Some responses have dictData.definitions instead of dictData.allDefinitions
        if (dictData.allDefinitions && dictData.allDefinitions.length > 0) {
          console.log(`Using allDefinitions for ${word}:`, dictData.allDefinitions[0]);
        } else {
          console.warn(`Dictionary data has no definitions array for word: ${word}. Using disambiguated definition.`);
          if (!wordData.disambiguatedDefinition && !wordData.definition) {
            console.error(`No usable definition found for word: ${word}`);
            return;
          }
        }
      }
      
      // Get all existing flashcard sense IDs
      const existingFlashcardSenseIds = getAllFlashcardSenseIds();
      
      // Get the best definition based on what's available
      const bestDefinition = wordData.disambiguatedDefinition || 
                             (dictData && dictData.allDefinitions && dictData.allDefinitions.length > 0 ? 
                                dictData.allDefinitions[0] : 
                                (dictData && dictData.definitions && dictData.definitions.length > 0 ? 
                                   dictData.definitions[0] : 
                                   null));
      
      if (!bestDefinition) {
        console.error(`No definition found for ${word} in context: ${contextSentence}`);
        return;
      }
      
      // Get the part of speech from the best available source
      const partOfSpeech = bestDefinition.partOfSpeech || 
                           (dictData && dictData.partOfSpeech) ||
                           wordData.partOfSpeech ||
                           'unknown';
      
      // Generate a unique word sense ID based on the context
      const wordSenseId = `${wordLower}_${partOfSpeech}_${Date.now()}`;
      
      // Check if this sense already exists in flashcards
      if (existingFlashcardSenseIds.includes(wordSenseId)) {
        console.log(`This sense of "${word}" already exists in flashcards. No new card needed.`);
        // The word is still added to selectedWords above for UI consistency
        return;
      }
      
      // Define disambiguatedDefinition for the rest of the code
      const disambiguatedDefinition = bestDefinition;
      
      if (!disambiguatedDefinition || !wordSenseId) {
        console.error('Failed to disambiguate definition for word:', word);
        return;
      }
      
      // Generate the image prompt based on the specific definition
      const definition = disambiguatedDefinition.definition;
      
      const imagePrompt = `Create a visually engaging, wordless flashcard image in the style of Charley Harper. Use bold shapes, minimal detail, and mid-century modern aesthetics to depict this specific meaning of the word "${word}" (${partOfSpeech}): "${definition}". Avoid text or labels. Create a metaphorical image representation of this exact meaning.`;
      
      console.log(`Generating image for specific sense of word: ${word} (${partOfSpeech})`);
      
      try {
        // TEMPORARILY DISABLED IMAGE GENERATION
        // const imageResponse = await fetch(`https://polycast-server.onrender.com/api/generate-image?prompt=${encodeURIComponent(imagePrompt)}`, {
        //   mode: 'cors'
        // })
        //   .then(res => {
        //     if (!res.ok) throw new Error(`Failed with status: ${res.status}`);
        //     return res.json();
        //   });
        
        // Use placeholder image instead of generating one
        const imageResponse = { url: 'https://placehold.co/300x200/1a1a2e/CCCCCC?text=Placeholder+Image' };
        
        console.log(`Using placeholder image for: ${word} (sense ID: ${wordSenseId})`);
        
        // Update the WordDefinitions state to include the flashcard data
        // We'll use the wordSenseId as a key to store different senses separately
        setWordDefinitions(prev => {
          // Store this specific sense with a unique key that includes the word and part of speech
          const senseKey = `${wordLower}_${partOfSpeech}`;
          
          // Create a copy of existing word data to preserve any previous word senses
          const existingWordData = prev[wordLower] || {};
          
          return {
            ...prev,
            // Store the basic word data under the word key
            [wordLower]: {
              ...existingWordData,
              // Add basic info
              hasMultipleSenses: true, // Flag that this word has multiple senses
              allSenses: [...(existingWordData.allSenses || []), senseKey] // Track all senses of this word
            },
            // Store the specific sense under a unique key
            [senseKey]: {
              word: wordLower,
              imageUrl: imageResponse.url,
              wordSenseId: wordSenseId,
              contextSentence: contextSentence,
              disambiguatedDefinition: disambiguatedDefinition,
              inFlashcards: true, // Mark that this word is now in flashcards with this sense
              cardCreatedAt: new Date().toISOString(),
              partOfSpeech: partOfSpeech
            }
          };
        });
        
        // Force popup to update with checkmark
        setPopupInfo(prev => ({
          ...prev,
          wordAddedToDictionary: true
        }));
        
        console.log(`Successfully added "${word}" to dictionary with definition: ${definition}`);
      } catch (imageError) {
        console.error(`Error generating image for ${word}:`, imageError);
        // Still update state without image using the same pattern
        setWordDefinitions(prev => {
          // Store this specific sense with a unique key that includes the word and part of speech
          const senseKey = `${wordLower}_${partOfSpeech}`;
          
          // Create a copy of existing word data to preserve any previous word senses
          const existingWordData = prev[wordLower] || {};
          
          return {
            ...prev,
            // Store the basic word data under the word key
            [wordLower]: {
              ...existingWordData,
              // Add basic info
              hasMultipleSenses: true, // Flag that this word has multiple senses
              allSenses: [...(existingWordData.allSenses || []), senseKey] // Track all senses of this word
            },
            // Store the specific sense under a unique key
            [senseKey]: {
              word: wordLower,
              wordSenseId: wordSenseId,
              contextSentence: contextSentence,
              disambiguatedDefinition: disambiguatedDefinition,
              inFlashcards: true, // Mark that this word is now in flashcards with this sense
              cardCreatedAt: new Date().toISOString(),
              partOfSpeech: partOfSpeech
            }
          };
        });
      }
    } catch (error) {
      console.error(`Error creating flashcard for ${word}:`, error);
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
                {renderSegmentsWithClickableWords(englishSegments, null, selectedWords, handleWordClick, isWordInSelectedList)}
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

  // ...existing logic...

  return (
    <div
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
      {/* Word Definition Popup */}
      {popupInfo.visible && wordDefinitions[popupInfo.word.toLowerCase()] && (
        <WordDefinitionPopup 
          word={popupInfo.word}
          definition={wordDefinitions[popupInfo.word.toLowerCase()]}
          dictDefinition={wordDefinitions[popupInfo.word.toLowerCase()]?.dictionaryDefinition}
          disambiguatedDefinition={wordDefinitions[popupInfo.word.toLowerCase()]?.disambiguatedDefinition}
          position={popupInfo.position}
          isInDictionary={doesWordSenseExist(popupInfo.word, wordDefinitions[popupInfo.word.toLowerCase()]?.contextSentence)}
          onAddToDictionary={handleAddWordToDictionary}
          loading={popupInfo.loading}
          onClose={() => setPopupInfo(prev => ({ ...prev, visible: false }))}
        />
      )}
      {/* Transcript/English box always renders and updates first */}
      {transcriptVisible && (
        <div style={{ width: translationVisible ? '100%' : '100%', flex: translationVisible ? '0 0 33.5%' : '1 1 100%', minHeight: 0, display: 'flex', flexDirection: 'column', transition: 'flex 0.3s, width 0.3s' }}>{renderEnglishBox()}</div>
      )}
      {/* Language boxes fill the remaining space */}
      {translationVisible && (
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
            
            // For student mode, always use Spanish translations if available regardless of language label
            const segments = isStudentMode && lang === 'Spanish' 
              ? (translations['Spanish'] || translations[Object.keys(translations)[0]] || []) 
              : (translations[lang] || []);
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
                  {isStudentMode ? 'Spanish' : lang}
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
  setWordDefinitions: PropTypes.func.isRequired,
  isStudentMode: PropTypes.bool
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
