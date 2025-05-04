const express = require('express');
const router = express.Router();
const { getSpanishDefinition } = require('./services/llmService');

/**
 * POST /api/dictionary-define
 * Body: { word: string }
 * Returns: { definition: string }
 */
router.post('/define', async (req, res) => {
  const { word } = req.body;
  if (!word || typeof word !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid word', detail: 'Word must be a non-empty string.' });
  }
  try {
    const definition = await getSpanishDefinition(word);
    res.json({ definition });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get definition', detail: err.stack || null });
  }
});

module.exports = router;
