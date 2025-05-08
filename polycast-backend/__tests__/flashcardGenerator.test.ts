/**
 * Tests for flashcardGenerator.ts
 */
import { buildFlashcard, buildSensePrompt, buildFallbackFlashcard } from '../services/flashcardGenerator';
import * as llmService from '../services/llmService';

// Mock the llmService
jest.mock('../services/llmService', () => ({
  generateFlashcardContent: jest.fn(),
  extractJsonFromText: jest.fn((text) => JSON.parse(text))
}));

describe('flashcardGenerator', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildSensePrompt', () => {
    it('should create a prompt with word, definitions, and context', () => {
      const word = 'test';
      const definitions = [
        { partOfSpeech: 'noun', definition: 'a procedure for critical evaluation' },
        { partOfSpeech: 'verb', definition: 'to put to the test' }
      ];
      const context = 'I need to test this code';

      const prompt = buildSensePrompt(word, definitions, context);

      // Verify the prompt contains the expected content
      expect(prompt).toContain('test');
      expect(prompt).toContain('a procedure for critical evaluation');
      expect(prompt).toContain('to put to the test');
      expect(prompt).toContain('I need to test this code');
    });

    it('should handle empty context', () => {
      const word = 'test';
      const definitions = [
        { partOfSpeech: 'noun', definition: 'a procedure for critical evaluation' }
      ];
      const context = '';

      const prompt = buildSensePrompt(word, definitions, context);

      expect(prompt).toContain('No context provided');
    });
  });

  describe('buildFlashcard', () => {
    it('should generate a flashcard with Gemini when definitions are available', async () => {
      const mockResponse = JSON.stringify({
        partOfSpeech: 'verb',
        displayDefinition: 'To check if something works correctly',
        exampleSentence: 'I will test the application before releasing it',
        clozeSentence: 'I will ___ the application before releasing it',
        synonyms: 'check, verify, examine, assess, try'
      });

      (llmService.generateFlashcardContent as jest.Mock).mockResolvedValue(mockResponse);

      const word = 'test';
      const definitions = [
        { partOfSpeech: 'verb', definition: 'to put to the test' }
      ];
      const context = 'I need to test this code';

      const flashcard = await buildFlashcard(word, definitions, context);

      // Verify llmService was called with correct prompt
      expect(llmService.generateFlashcardContent).toHaveBeenCalledWith(
        expect.stringContaining('test')
      );

      // Verify flashcard contains expected content
      expect(flashcard.word).toBe('test');
      expect(flashcard.displayDefinition).toBe('To check if something works correctly');
      expect(flashcard.partOfSpeech).toBe('verb');
      expect(flashcard.exampleSentence).toBe('I will test the application before releasing it');
      expect(flashcard.synonyms).toBe('check, verify, examine, assess, try');
    });

    it('should use fallback when Gemini fails', async () => {
      (llmService.generateFlashcardContent as jest.Mock).mockRejectedValue(new Error('API error'));

      const word = 'test';
      const definitions = [
        { partOfSpeech: 'verb', definition: 'to put to the test' }
      ];
      const context = 'I need to test this code';

      const flashcard = await buildFlashcard(word, definitions, context);

      // Verify llmService was called
      expect(llmService.generateFlashcardContent).toHaveBeenCalled();

      // Verify flashcard contains fallback content
      expect(flashcard.word).toBe('test');
      expect(flashcard.dictionaryDefinition).toBe('to put to the test');
      expect(flashcard.partOfSpeech).toBe('verb');
    });

    it('should use fallback when no definitions are available', async () => {
      const word = 'test';
      const definitions: any[] = [];
      const context = 'I need to test this code';

      const flashcard = await buildFlashcard(word, definitions, context);

      // Verify llmService was NOT called
      expect(llmService.generateFlashcardContent).not.toHaveBeenCalled();

      // Verify flashcard contains fallback content
      expect(flashcard.word).toBe('test');
      expect(flashcard.displayDefinition).toContain('not available');
    });
  });

  describe('buildFallbackFlashcard', () => {
    it('should create a basic flashcard with the given word', () => {
      const word = 'test';
      const flashcard = buildFallbackFlashcard(word);

      expect(flashcard.word).toBe('test');
      expect(flashcard.displayDefinition).toContain('not available');
      expect(flashcard.partOfSpeech).toBe('unknown');
    });

    it('should use provided definition when available', () => {
      const word = 'test';
      const definition = { partOfSpeech: 'noun', definition: 'a procedure for critical evaluation' };
      
      const flashcard = buildFallbackFlashcard(word, definition);

      expect(flashcard.word).toBe('test');
      expect(flashcard.dictionaryDefinition).toBe('a procedure for critical evaluation');
      expect(flashcard.partOfSpeech).toBe('noun');
    });
  });
});
