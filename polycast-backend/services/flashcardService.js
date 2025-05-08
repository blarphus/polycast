// flashcardService.js
// Handles dictionary lookups, word sense disambiguation, and flashcard management
const fs = require('fs').promises;
const path = require('path');
const { google } = require('@google/generative-ai');

// Initialize Gemini API
const API_KEY = process.env.GEMINI_API_KEY;
let genAI;
if (API_KEY) {
    genAI = new google.GenerativeAI(API_KEY);
} else {
    console.warn('[FlashcardService] Gemini API Key not found. Word sense disambiguation will be limited.');
}

// In-memory storage for user flashcards (in production, this would be a database)
const userFlashcards = new Map();

// Dictionary cache to avoid repeated file reads
const dictionaryCache = new Map();

/**
 * Loads a dictionary file for a specific letter
 * @param {string} letter - The first letter of the word
 * @returns {Object} The dictionary data for that letter
 */
async function loadDictionary(letter) {
    letter = letter.toLowerCase();
    
    // Check if already in cache
    if (dictionaryCache.has(letter)) {
        return dictionaryCache.get(letter);
    }
    
    // Load from file
    try {
        const filePath = path.join(__dirname, '..', 'dictionary-data', `${letter}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        const dictionary = JSON.parse(data);
        
        // Cache the dictionary
        dictionaryCache.set(letter, dictionary);
        return dictionary;
    } catch (error) {
        console.error(`[FlashcardService] Error loading dictionary for letter ${letter}:`, error);
        return null;
    }
}

/**
 * Look up a word in the dictionary
 * @param {string} word - The word to look up
 * @returns {Object|null} The word's dictionary entry or null if not found
 */
async function lookupWord(word) {
    word = word.toLowerCase().trim();
    if (!word) return null;
    
    const firstLetter = word.charAt(0);
    console.log(`[DICTIONARY_DEBUG] Looking up word "${word}" in dictionary file "${firstLetter}.json"`);
    
    const dictionary = await loadDictionary(firstLetter);
    
    if (!dictionary) {
        console.log(`[DICTIONARY_DEBUG] Dictionary for letter "${firstLetter}" not found or could not be loaded`);
        return null;
    }
    
    const result = dictionary[word] || null;
    console.log(`[DICTIONARY_DEBUG] Lookup result for "${word}": ${result ? 'Found' : 'Not found'}`);
    if (result) {
        console.log(`[DICTIONARY_DEBUG] Number of meanings found for "${word}": ${Object.keys(result.MEANINGS || {}).length}`);
    }
    
    return result;
}

/**
 * Extract definitions from a dictionary entry
 * @param {Object} entry - Dictionary entry
 * @returns {Array} Array of definition objects with partOfSpeech and definition
 */
function extractDefinitions(entry) {
    if (!entry || !entry.MEANINGS) return [];
    
    const definitions = [];
    Object.entries(entry.MEANINGS).forEach(([key, value]) => {
        definitions.push({
            partOfSpeech: value[0],
            definition: value[1]
        });
    });
    
    return definitions;
}

/**
 * Use Gemini to disambiguate which sense of the word is being used
 * @param {string} word - The word to disambiguate
 * @param {string} context - The sentence or context in which the word appears
 * @param {Array} definitions - Array of possible definitions
 * @returns {Object|null} The matched definition or null if unable to disambiguate
 */
async function disambiguateWordSense(word, context, definitions) {
    if (!genAI || !definitions || definitions.length === 0) {
        // If no Gemini or no definitions, return the first definition if available
        console.log(`[DICTIONARY_DEBUG] No Gemini API or no definitions available for word: "${word}"`);
        return definitions.length > 0 ? definitions[0] : null;
    }
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Create the prompt for disambiguation
        let prompt = `Here is a sentence:\n"${context}"\n\n`;
        prompt += `Here are possible definitions for the word "${word}":\n\n`;
        
        definitions.forEach((def, index) => {
            prompt += `${index + 1}. ${def.partOfSpeech}: ${def.definition}\n`;
        });
        
        prompt += `\nWhich definition best matches the word "${word}" as used in the sentence? Return only the index number.`;
        
        // Log the entire prompt for debugging
        console.log(`[DICTIONARY_DEBUG] Gemini disambiguation prompt for "${word}":\n${prompt}`);
        
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        
        // Log the Gemini response
        console.log(`[DICTIONARY_DEBUG] Gemini disambiguation response for "${word}": "${response}"`);
        
        // Parse the response to get the index
        const index = parseInt(response, 10);
        
        if (!isNaN(index) && index >= 1 && index <= definitions.length) {
            const selectedDefinition = definitions[index - 1];
            console.log(`[DICTIONARY_DEBUG] Selected definition for "${word}": ${selectedDefinition.partOfSpeech} - "${selectedDefinition.definition}"`);
            return selectedDefinition;
        } else {
            console.warn(`[DICTIONARY_DEBUG] Gemini did not return a valid index: "${response}". Falling back to first definition.`);
            return definitions[0]; // Fallback to first definition
        }
    } catch (error) {
        console.error('[DICTIONARY_DEBUG] Error during word sense disambiguation:', error);
        return definitions[0]; // Fallback to first definition
    }
}

/**
 * Generate flashcard content using Gemini
 * @param {string} word - The word for the flashcard
 * @param {Object} definition - The definition object
 * @param {string} context - The context in which the word was used
 * @returns {Object} The generated flashcard content
 */
async function generateFlashcardContent(word, definition, context) {
    if (!genAI) {
        console.log(`[DICTIONARY_DEBUG] Gemini not available for flashcard content generation for "${word}". Using fallback content.`);
        return {
            displayDefinition: definition.definition,
            exampleSentence: context || `Example with ${word}`,
            clozeSentence: context ? context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___') : `The word ___ means ${definition.definition.substring(0, 30)}...`,
            synonyms: ''
        };
    }
    
    try {
        console.log(`[DICTIONARY_DEBUG] Generating flashcard content for "${word}" with definition: "${definition.definition}"`);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Simplified prompt structure that focuses on just getting a simple definition
        const prompt = `Provide a simple, clear definition of the English word "${word}" for language learners.

The dictionary definition is: "${definition.partOfSpeech}: ${definition.definition}."

Please respond with 1-2 sentences only - focus on clarity for non-native English speakers.`;
        
        console.log(`[DICTIONARY_DEBUG] Flashcard generation prompt for "${word}":\n${prompt}`);
        
        // Get response from Gemini
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        console.log(`[DICTIONARY_DEBUG] Gemini flashcard response for "${word}":\n${response}`);
        
        // No need for JSON parsing - use the text directly
        const displayDefinition = response.substring(0, 200); // Keep it reasonably short
        
        // Create a cloze sentence by replacing the word with blanks
        const clozeSentence = context 
            ? context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___') 
            : `The word ___ means ${definition.definition.substring(0, 30)}...`;
        
        return {
            displayDefinition: displayDefinition,
            exampleSentence: context || `Example: ${word} is used to describe something.`,
            clozeSentence: clozeSentence,
            synonyms: '' // Leave empty for now
        };
    } catch (error) {
        console.error('[DICTIONARY_DEBUG] Error generating flashcard content:', error);
        
        // Fallback content when there's an error
        return {
            displayDefinition: definition.definition,
            exampleSentence: context || `Example with ${word}`,
            clozeSentence: context ? context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___') : `The word ___ means ${definition.definition.substring(0, 30)}...`,
            synonyms: ''
        };
    }
}

/**
 * Creates a new flashcard for a user
 * @param {string} userId - The user ID
 * @param {string} word - The word for the flashcard
 * @param {string} context - The context in which the word was used
 * @returns {Object} The created flashcard or null if creation failed
 */
async function createFlashcard(userId, word, context) {
    try {
        // Lookup the word in the dictionary
        const entry = await lookupWord(word);
        if (!entry) {
            console.log(`[DICTIONARY_DEBUG] Word "${word}" not found in dictionary`);
            // Return a minimal valid flashcard with default content instead of null
            return {
                word,
                dictionaryDefinition: "No definition found in dictionary",
                displayDefinition: `Definition for "${word}" not found in our dictionary`,
                exampleSentence: context || `Example with ${word}`,
                clozeSentence: context ? context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___') : `Example with ___`,
                partOfSpeech: "unknown",
                created: Date.now(),
                nextReview: Date.now(),
                interval: 1,
                easeFactor: 2.5,
                repetitions: 0
            };
        }
        
        // Extract definitions
        const definitions = extractDefinitions(entry);
        if (definitions.length === 0) {
            console.log(`[DICTIONARY_DEBUG] No definitions found for "${word}"`);
            // Return a minimal valid flashcard with default content
            return {
                word,
                dictionaryDefinition: "No definition extracted",
                displayDefinition: `No definition details available for "${word}"`,
                exampleSentence: context || `Example with ${word}`,
                clozeSentence: context ? context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___') : `Example with ___`,
                partOfSpeech: "unknown",
                created: Date.now(),
                nextReview: Date.now(),
                interval: 1,
                easeFactor: 2.5,
                repetitions: 0
            };
        }
        
        // Disambiguate which sense is being used
        const matchedDefinition = await disambiguateWordSense(word, context, definitions);
        if (!matchedDefinition) {
            console.log(`[DICTIONARY_DEBUG] Could not disambiguate sense for "${word}"`);
            // Use the first definition as fallback
            const fallbackDefinition = definitions[0];
            return {
                word,
                dictionaryDefinition: fallbackDefinition.definition,
                displayDefinition: fallbackDefinition.definition,
                exampleSentence: context || `Example with ${word}`,
                clozeSentence: context ? context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___') : `Example with ___`,
                partOfSpeech: fallbackDefinition.partOfSpeech || "unknown",
                created: Date.now(),
                nextReview: Date.now(),
                interval: 1,
                easeFactor: 2.5,
                repetitions: 0
            };
        }
        
        // Check if this user already has a flashcard for this word and definition
        const userCards = getUserFlashcards(userId);
        const existingCard = userCards.find(card => 
            card.word.toLowerCase() === word.toLowerCase() && 
            card.dictionaryDefinition === matchedDefinition.definition
        );
        
        if (existingCard) {
            console.log(`[DICTIONARY_DEBUG] Flashcard for "${word}" (${matchedDefinition.definition}) already exists for user ${userId}`);
            return existingCard;
        }
        
        // Generate flashcard content
        const flashcardContent = await generateFlashcardContent(word, matchedDefinition, context);
        
        // Create the flashcard object
        const now = Date.now();
        const flashcard = {
            word,
            dictionaryDefinition: matchedDefinition.definition,
            displayDefinition: flashcardContent.displayDefinition,
            exampleSentence: flashcardContent.exampleSentence,
            clozeSentence: flashcardContent.clozeSentence,
            partOfSpeech: matchedDefinition.partOfSpeech,
            created: now,
            nextReview: now, // Due immediately
            interval: 1, // In days
            easeFactor: 2.5,
            repetitions: 0
        };
        
        // Add to user's flashcards
        if (!userFlashcards.has(userId)) {
            userFlashcards.set(userId, []);
        }
        userFlashcards.get(userId).push(flashcard);
        
        return flashcard;
        
    } catch (error) {
        console.error(`[DICTIONARY_DEBUG] Error in createFlashcard for word "${word}":`, error);
        // Return a minimal valid flashcard with error information
        return {
            word,
            dictionaryDefinition: "Error occurred during lookup",
            displayDefinition: `Could not process "${word}" due to an error`,
            exampleSentence: context || `Example with ${word}`,
            clozeSentence: context ? context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___') : `Example with ___`,
            partOfSpeech: "unknown",
            created: Date.now(),
            nextReview: Date.now(),
            interval: 1,
            easeFactor: 2.5,
            repetitions: 0
        };
    }
}

/**
 * Get all flashcards for a user
 * @param {string} userId - The user ID
 * @param {boolean} dueOnly - Whether to return only due flashcards
 * @returns {Array} The user's flashcards
 */
function getUserFlashcards(userId, dueOnly = false) {
    if (!userFlashcards.has(userId)) {
        userFlashcards.set(userId, []);
    }
    
    const cards = userFlashcards.get(userId);
    
    if (dueOnly) {
        const now = Date.now();
        return cards.filter(card => card.nextReview <= now);
    }
    
    return cards;
}

/**
 * Update a flashcard after review
 * @param {string} userId - The user ID
 * @param {string} word - The word on the flashcard
 * @param {string} dictionaryDefinition - The dictionary definition
 * @param {string} rating - The user's rating (again, hard, good, easy)
 * @returns {Object|null} The updated flashcard or null if not found
 */
function updateFlashcardReview(userId, word, dictionaryDefinition, rating) {
    if (!userFlashcards.has(userId)) {
        return null;
    }
    
    const cards = userFlashcards.get(userId);
    const cardIndex = cards.findIndex(card => 
        card.word.toLowerCase() === word.toLowerCase() && 
        card.dictionaryDefinition === dictionaryDefinition
    );
    
    if (cardIndex === -1) {
        return null;
    }
    
    const card = cards[cardIndex];
    
    // Apply spaced repetition algorithm (simplified SM-2)
    let easeDelta = 0;
    let intervalMultiplier = 1;
    let repetitionsDelta = 0;
    
    switch (rating.toLowerCase()) {
        case 'again':
            easeDelta = -0.2;
            intervalMultiplier = 1; // Reset interval
            repetitionsDelta = 0;
            break;
        case 'hard':
            easeDelta = -0.1;
            intervalMultiplier = 1.2;
            repetitionsDelta = 1;
            break;
        case 'good':
            easeDelta = 0;
            intervalMultiplier = 2.0;
            repetitionsDelta = 1;
            break;
        case 'easy':
            easeDelta = 0.1;
            intervalMultiplier = 2.5;
            repetitionsDelta = 1;
            break;
        default:
            // Invalid rating
            return card;
    }
    
    // Update card properties
    card.easeFactor = Math.max(1.3, Math.min(2.5, card.easeFactor + easeDelta));
    card.repetitions += repetitionsDelta;
    
    // Calculate next interval in milliseconds
    const newIntervalDays = rating.toLowerCase() === 'again' 
        ? 1 // Reset to 1 day for 'again'
        : Math.max(1, Math.round(card.interval * intervalMultiplier));
    
    card.interval = newIntervalDays;
    card.nextReview = Date.now() + (newIntervalDays * 86400 * 1000); // Convert days to milliseconds
    
    // Update the card in the collection
    cards[cardIndex] = card;
    
    return card;
}

module.exports = {
    lookupWord,
    extractDefinitions,
    disambiguateWordSense,
    createFlashcard,
    getUserFlashcards,
    updateFlashcardReview
};
