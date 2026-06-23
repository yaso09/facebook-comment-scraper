const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { scrapePageInfo } = require('../page-info');
const { logger } = require('../utils/logger');

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const url = req.query.url;

  if (!url || !url.trim()) {
    res.status(400).json({ error: 'Missing query parameter "url"' });
    return;
  }

  logger.info(`Page info request: ${url}`);

  try {
    const result = await scrapePageInfo(url.trim());
    res.json({ url, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Page info failed: ${msg}`);
    res.status(500).json({ error: 'Page info failed', detail: msg });
  }
});

module.exports = router;
