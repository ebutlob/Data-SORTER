const { parseText } = require('../lib/parser');

module.exports = async (req, res) => {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, delimiter } = req.body || {};
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing "text" string in body' });
  }

  try {
    const out = parseText(text, delimiter);
    return res.status(200).json(out);
  } catch (err) {
    console.error('[parse]', err);
    return res.status(500).json({ error: 'Parse failed', detail: err.message });
  }
};
