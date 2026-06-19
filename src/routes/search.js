const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { searchFacebook } = require('../search');
const { logger } = require('../utils/logger');

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const q = req.query.q;
  const rawType = req.query.type || 'general';

  if (!q || !q.trim()) {
    res.status(400).json({ error: 'Missing query parameter "q"' });
    return;
  }

  const searchType = ['profile', 'reel', 'general'].includes(rawType)
    ? rawType
    : 'general';

  logger.info(`Search: type=${searchType} query="${q}"`);

  try {
    const results = await searchFacebook(q.trim(), searchType);
    res.json(results);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Search failed: ${msg}`);
    res.status(500).json({ error: 'Search failed', detail: msg });
  }
});

module.exports = router;
