'use strict';

const express = require('express');
const path = require('path');
const { parseText } = require('./lib/parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.post('/api/parse', (req, res) => {
  const { text, delimiter } = req.body || {};
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'body must include "text" as a string' });
  }
  try {
    const out = parseText(text, delimiter);
    res.json(out);
  } catch (err) {
    console.error('[parse]', err);
    res.status(500).json({ error: 'parse failed', detail: err.message });
  }
});

app.use((req, res) => res.status(404).json({ error: 'not found' }));

app.listen(PORT, () => console.log(`data-sorter listening on :${PORT}`));
