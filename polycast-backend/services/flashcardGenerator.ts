/**
 * Flashcard Generator Service
 * Manages flashcard generation using the centralized LLM service
 */
import { generateFlashcardContent, extractJsonFromText } from "./llmService";

// Types
interface Definition {
  partOfSpeech: string;
  definition: string;
}

interface Flashcard {
  word: string;
  dictionaryDefinition?: string;
  displayDefinition: string;
  exampleSentence: string;
  clozeSentence: string;
  partOfSpeech: string;
  synonyms?: string;
  created: number;
  nextReview: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
  frequencyRating?: number;
}

/**
 * Build a prompt for sense disambiguation and flashcard generation
 * 
 * @param word - The word to generate a flashcard for
 * @param definitions - Array of possible definitions
 * @param context - The context in which the word was used
 * @returns The prompt for Gemini
 */
export function buildSensePrompt(word: string, definitions: Definition[], context: string): string {
  let prompt = `Create a flashcard for the English word "${word}" for language learners.\n\n`;
  
  prompt += `Possible definitions:\n`;
  definitions.forEach((def, index) => {
    prompt += `${index + 1}. ${def.partOfSpeech}: ${def.definition}\n`;
  });
  
  prompt += `\nContext where the word was used: "${context || 'No context provided.'}"\n\n`;
  
  prompt += `Based on the context, determine the most appropriate definition and return a JSON object with these fields:
  {
    "partOfSpeech": "The part of speech (noun, verb, adjective, etc.)",
    "displayDefinition": "A clear, simple definition suitable for language learners",
    "exampleSentence": "A simple example sentence using the word",
    "clozeSentence": "A sentence with the word replaced by ___",
    "synonyms": "3-5 synonyms separated by commas"
  }

  Only return the JSON object, nothing else.`;
  
  return prompt;
}

/**
 * Create a fallback flashcard when Gemini is unavailable or fails
 * 
 * @param word - The word for the flashcard
 * @param definition - Optional definition to use
 * @returns A basic flashcard with minimal content
 */
export function buildFallbackFlashcard(word: string, definition?: Definition): Flashcard {
  const now = Date.now();
  
  return {
    word,
    dictionaryDefinition: definition?.definition || "No definition available",
    displayDefinition: definition?.definition || `Definition for "${word}" not available`,
    exampleSentence: `Example sentence with the word "${word}"`,
    clozeSentence: `The word ___ is used in a sentence.`,
    partOfSpeech: definition?.partOfSpeech || "unknown",
    synonyms: "",
    created: now,
    nextReview: now,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0
  };
}

/**
 * Build a flashcard using the centralized Gemini API
 * 
 * @param word - The word for the flashcard
 * @param definitions - Array of possible definitions
 * @param context - The context in which the word was used
 * @returns The generated flashcard
 */
export async function buildFlashcard(word: string, definitions: Definition[], context: string): Promise<Flashcard> {
  if (!definitions.length) return buildFallbackFlashcard(word);

  const prompt = buildSensePrompt(word, definitions, context);
  
  try {
    console.log(`[FLASHCARD] Generating flashcard for "${word}" with ${definitions.length} definitions`);
    const response = await generateFlashcardContent(prompt);
    const json = extractJsonFromText(response);
    
    const now = Date.now();
    
    // Create and return the flashcard with the generated content
    return {
      word,
      dictionaryDefinition: definitions[0].definition,
      displayDefinition: json.displayDefinition || definitions[0].definition,
      exampleSentence: json.exampleSentence || `Example with ${word}`,
      clozeSentence: json.clozeSentence || context.replace(new RegExp(`\\b${word}\\b`, 'i'), '___'),
      partOfSpeech: json.partOfSpeech || definitions[0].partOfSpeech,
      synonyms: json.synonyms || "",
      created: now,
      nextReview: now,
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0
    };
  } catch (err) {
    console.error("[FLASHCARD] Gemini error", err);
    return buildFallbackFlashcard(word, definitions[0]);
  }
}
