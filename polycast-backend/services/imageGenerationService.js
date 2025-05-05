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
        console.log(`[Image Generation] Request parameters: size=${size}, quality=${quality}`);
        
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

        const responseText = await response.text();
        console.log(`[Image Generation] Raw response: ${responseText.substring(0, 200)}...`);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Image Generation] JSON parse error:', parseError);
            throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
        }

        if (!response.ok) {
            console.error('[Image Generation] OpenAI API error:', data);
            throw new Error(`OpenAI API responded with status ${response.status}: ${data.error?.message || 'Unknown error'}`);
        }

        if (!data.data || !data.data[0] || !data.data[0].url) {
            console.error('[Image Generation] Unexpected response format:', data);
            throw new Error('Invalid response format from OpenAI API');
        }

        console.log(`[Image Generation] Success! Image URL: ${data.data[0].url.substring(0, 50)}...`);
        return data.data[0].url;
    } catch (error) {
        console.error('[Image Generation] Error generating image:', error);
        throw error;
    }
}

module.exports = {
    generateImage
};
