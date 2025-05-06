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
 * @param {string} [size='1024x1024'] - The desired size of the image.
 * @param {string} [quality='standard'] - The quality of the image ('standard' or 'hd').
 * @param {string} [style='vivid'] - The style of the generated images ('vivid' or 'natural').
 * @returns {Promise<string>} - The URL of the generated image.
 */
async function generateImage(prompt, size = '1024x1024', quality = 'standard', style = 'vivid') {
    console.log(`Generating image with prompt: "${prompt}", size: ${size}, quality: ${quality}, style: ${style}`);
    try {
        // Use the modern images.generate endpoint with gpt-image-1 model
        const response = await openai.images.generate({
            model: "gpt-image-1", // Specify the newer GPT-based image model
            prompt,
            n: 1,
            size,
            quality, // Added quality parameter
            style,   // Added style parameter
            response_format: 'url',
        });

        console.log('Image generated successfully:', response.data[0].url);
        // The response structure for images.generate is slightly different
        return response.data[0].url;
    } catch (error) {
        console.error('Error generating image:', error.response ? error.response.data : error.message);
        throw new Error('Failed to generate image');
    }
}

module.exports = {
    generateImage,
};
