// imageService.js
// Service for generating images using OpenAI's DALL·E API

const OpenAI = require('openai');
const config = require('../config/config');

if (!config.openaiApiKey) {
  throw new Error('OpenAI API key is not configured.');
}

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * Generate an image using OpenAI's image generation API
 * @param {string} basePrompt - The core concept for the image (e.g., the word)
 * @param {string} size - One of '1024x1024', '1024x1792', '1792x1024' (default '1024x1024')
 * @returns {Promise<string>} - The image URL
 */
async function generateImage(basePrompt, size = '1024x1024') {
  // Construct the full prompt with style and constraints
  const fullPrompt = `A Charley Harper style illustration depicting ${basePrompt}. Focus on bold shapes and minimal detail. IMPORTANT: The image must contain absolutely no text, letters, or numbers whatsoever.`;

  console.log(`Generating image with prompt: "${fullPrompt}" and size: ${size}`); // Added logging

  try {
    const response = await openai.images.generate({
      model: "gpt-image-1", // Specify the newer model
      prompt: fullPrompt, // Use the enhanced prompt
      n: 1,
      size,
      response_format: 'url',
      // quality: "hd", // Optional: uncomment for higher definition if supported and desired
      // style: "vivid" // Optional: uncomment for potentially more vibrant images
    });

    if (response.data && response.data.length > 0 && response.data[0].url) {
        console.log("Image generated successfully:", response.data[0].url); // Added logging
        return response.data[0].url;
    } else {
        console.error("Invalid response format from OpenAI API:", response);
        throw new Error('Invalid response format from OpenAI API.');
    }
  } catch (error) {
    console.error('Error generating image:', error.response ? error.response.data : error.message);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

module.exports = { generateImage };
