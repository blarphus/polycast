const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');

let genAI;
let model;

function initializeLLM() {
    if (!config.googleApiKey) {
        throw new Error('Google API Key (GOOGLE_API_KEY) is not configured in .env');
    }
    if (!genAI) {
        genAI = new GoogleGenerativeAI(config.googleApiKey);
        model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' });
    }
}

async function defineWordInContext(word, sentence) {
    initializeLLM();
    const prompt = `Define the word "${word}" as used in the following sentence in Spanish. Sentence: "${sentence}"`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text().trim();
}

async function batchDefineWords(pairs) {
    return Promise.all(pairs.map(async ({ word, sentence }) => {
        try {
            const definition = await defineWordInContext(word, sentence);
            return { word, definition, sentence };
        } catch (e) {
            return { word, definition: 'Error: ' + e.message, sentence };
        }
    }));
}

module.exports = { batchDefineWords };
