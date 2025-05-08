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
    const dictionary = await loadDictionary(firstLetter);
    
    if (!dictionary) return null;
    
    return dictionary[word] || null;
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
        
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        
        // Parse the response to get the index
        const index = parseInt(response, 10);
        
        if (!isNaN(index) && index >= 1 && index <= definitions.length) {
            return definitions[index - 1];
        } else {
            console.warn(`[FlashcardService] Gemini did not return a valid index: ${response}`);
            return definitions[0]; // Fallback to first definition
        }
    } catch (error) {
        console.error('[FlashcardService] Error during word sense disambiguation:', error);
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
        // Fallback content if Gemini is not available
        return {
            displayDefinition: definition.definition,
            exampleSentence: context,
            clozeSentence: context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___')
        };
    }
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = `The word is "${word}". The selected definition is:
"${definition.partOfSpeech}: ${definition.definition}."

Create a learner-friendly flashcard with:
1. A short explanation (can rephrase the sense)
2. A full sentence that uses the word in this sense
3. A fill-in-the-blank version of the sentence

Original context: "${context}"

Return JSON in this format:
{
  "displayDefinition": "...",
  "exampleSentence": "...",
  "clozeSentence": "..."
}`;

        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();
        
        try {
            // Parse the JSON from the response
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                             response.match(/{[\s\S]*?}/);
            
            const jsonContent = jsonMatch ? jsonMatch[0] : response;
            const flashcardContent = JSON.parse(jsonContent.replace(/```json|```/g, ''));
            
            return {
                displayDefinition: flashcardContent.displayDefinition,
                exampleSentence: flashcardContent.exampleSentence,
                clozeSentence: flashcardContent.clozeSentence
            };
        } catch (jsonError) {
            console.error('[FlashcardService] Error parsing Gemini JSON:', jsonError);
            // Fallback if JSON parsing fails
            return {
                displayDefinition: definition.definition,
                exampleSentence: context,
                clozeSentence: context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___')
            };
        }
    } catch (error) {
        console.error('[FlashcardService] Error generating flashcard content:', error);
        // Fallback content
        return {
            displayDefinition: definition.definition,
            exampleSentence: context,
            clozeSentence: context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___')
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
    // Lookup the word in the dictionary
    const entry = await lookupWord(word);
    if (!entry) {
        console.log(`[FlashcardService] Word "${word}" not found in dictionary`);
        return null;
    }
    
    // Extract definitions
    const definitions = extractDefinitions(entry);
    if (definitions.length === 0) {
        console.log(`[FlashcardService] No definitions found for "${word}"`);
        return null;
    }
    
    // Disambiguate which sense is being used
    const matchedDefinition = await disambiguateWordSense(word, context, definitions);
    if (!matchedDefinition) {
        console.log(`[FlashcardService] Could not disambiguate sense for "${word}"`);
        return null;
    }
    
    // Check if this user already has a flashcard for this word and definition
    const userCards = getUserFlashcards(userId);
    const existingCard = userCards.find(card => 
        card.word.toLowerCase() === word.toLowerCase() && 
        card.dictionaryDefinition === matchedDefinition.definition
    );
    
    if (existingCard) {
        console.log(`[FlashcardService] Flashcard for "${word}" (${matchedDefinition.definition}) already exists for user ${userId}`);
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
