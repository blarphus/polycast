// imageService.js
// Service for generating images using OpenAI's image generation API

const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates an image based on a prompt using OpenAI's image generation API.
 * @param {string} prompt - The text prompt to generate the image from.
 * @param {string} [size='1024x1024'] - The desired size of the image (1024x1024, 1792x1024, 1024x1792).
 * @param {string} [moderation='auto'] - Content filtering sensitivity ('auto' or 'low').
 * @returns {Promise<string>} - The URL of the generated image.
 */
async function generateImage(prompt, size = '1024x1024', moderation = 'auto') {
    console.log(`Generating image with prompt: "${prompt}", size: ${size}, moderation: ${moderation}`);
    try {
        // Use the images.generations endpoint with gpt-image-1 model
        const response = await openai.images.generate({
            model: "gpt-image-1", // GPT-4o image generation model
            prompt,
            n: 1,
            size,
            moderation, // Content filtering sensitivity
            // response_format parameter removed as it's not supported
        });

        console.log('Image generated successfully');
        return response.data[0].url;
    } catch (error) {
        console.error('Error generating image:', error.response ? error.response.data : error.message);
        throw new Error('Failed to generate image');
    }
}

module.exports = {
    generateImage,
};
