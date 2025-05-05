const fetch = require('node-fetch');
const config = require('../config/config');

/**
 * Generates an image using OpenAI's DALL-E API
 * @param {string} prompt The prompt to generate an image for
 * @param {string} size The size of the image (default: '1024x1024')
 * @param {string} quality The quality of the image ('standard' or 'hd', default: 'standard')
 * @returns {Promise<string>} A URL to the generated image
 */
async function generateImage(prompt, size = '1024x1024', quality = 'standard') {
    if (!config.openaiApiKey) {
        throw new Error('OpenAI API key is not configured.');
    }

    try {
        console.log(`[Image Generation] Generating image with prompt: "${prompt}"`);
        
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.openaiApiKey}`
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt,
                n: 1,
                size,
                quality
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Image Generation] OpenAI API error:', errorData);
            throw new Error(`OpenAI API responded with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        return data.data[0].url;
    } catch (error) {
        console.error('[Image Generation] Error generating image:', error);
        throw error;
    }
}

module.exports = {
    generateImage
};
