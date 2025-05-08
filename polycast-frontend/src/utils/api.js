/**
 * API utilities for Polycast
 * Centralizes API URL configuration and common fetch patterns
 */

// Backend server base URL
export const API_BASE_URL = 'https://polycast-server.onrender.com';

/**
 * Make a fetch request to the Polycast API
 * @param {string} endpoint - API endpoint without the base URL
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - Fetch promise
 */
export const fetchApi = async (endpoint, options = {}) => {
  // Ensure endpoint starts with /
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Construct the full URL
  const url = `${API_BASE_URL}${formattedEndpoint}`;
  
  console.log(`Making API request to: ${url}`);
  
  // Make the request
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  // Clone the response to log it
  const clonedResponse = response.clone();
  
  try {
    const text = await clonedResponse.text();
    console.log(`Response from ${url}:`, { 
      status: response.status, 
      statusText: response.statusText,
      body: text.substring(0, 200) + (text.length > 200 ? '...' : '')
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}. Response: ${text}`);
    }
    
    // Parse JSON if possible
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn(`Response is not valid JSON: ${e.message}`);
      return text;
    }
  } catch (error) {
    console.error(`Error in API request to ${url}:`, error);
    throw error;
  }
};

/**
 * Get flashcards for a user
 * @param {string} userId - User ID
 * @param {boolean} dueOnly - Whether to return only due flashcards
 * @returns {Promise} - Fetch promise resolving to flashcards data
 */
export const getFlashcards = (userId, dueOnly = false) => {
  const url = new URL(`${API_BASE_URL}/api/flashcards`);
  url.searchParams.append('userId', userId);
  if (dueOnly) {
    url.searchParams.append('due', 'true');
  }
  
  console.log(`Fetching flashcards from: ${url.toString()}`);
  return fetch(url.toString()).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to fetch flashcards: ${res.status}`);
    }
    return res.json();
  });
};

/**
 * Create a flashcard for a word
 * @param {string} userId - User ID
 * @param {string} word - Word to create flashcard for
 * @param {string} context - Context sentence
 * @returns {Promise} - Fetch promise resolving to created flashcard
 */
export const createFlashcard = (userId, word, context) => {
  return fetchApi('/api/flashcards', {
    method: 'POST',
    body: JSON.stringify({ userId, word, context }),
  });
};

/**
 * Mark a flashcard as reviewed
 * @param {string} userId - User ID
 * @param {string} word - Word on the flashcard
 * @param {string} dictionaryDefinition - Dictionary definition
 * @param {string} rating - Rating (again, hard, good, easy)
 * @returns {Promise} - Fetch promise resolving to updated flashcard
 */
export const updateFlashcardReview = (userId, word, dictionaryDefinition, rating) => {
  return fetchApi('/api/flashcards/mark', {
    method: 'POST',
    body: JSON.stringify({ userId, word, dictionaryDefinition, rating }),
  });
};

/**
 * Generate an image for a word
 * @param {string} prompt - Image generation prompt
 * @returns {Promise} - Fetch promise resolving to image URL
 */
export const generateImage = (prompt) => {
  const url = new URL(`${API_BASE_URL}/api/generate-image`);
  url.searchParams.append('prompt', prompt);
  
  return fetch(url.toString(), { mode: 'cors' })
    .then(res => {
      if (!res.ok) throw new Error(`Failed with status: ${res.status}`);
      return res.json();
    });
};
