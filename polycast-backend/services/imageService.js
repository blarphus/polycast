// imageService.js
// Service for generating images using OpenAI's DALL·E API

const { Configuration, OpenAIApi } = require('openai');
const config = require('../config/config');

if (!config.openaiApiKey) {
  throw new Error('OpenAI API key is not configured.');
}

const openai = new OpenAIApi(new Configuration({ apiKey: config.openaiApiKey }));

/**
 * Generate an image using OpenAI's DALL·E API
 * @param {string} prompt - The prompt for the image
 * @param {string} size - One of '256x256', '512x512', '1024x1024' (default '1024x1024')
 * @returns {Promise<string>} - The image URL
 */
async function generateImage(prompt, size = '1024x1024') {
  const response = await openai.createImage({
    prompt,
    n: 1,
    size,
    response_format: 'url',
  });
  return response.data.data[0].url;
}

module.exports = { generateImage };
