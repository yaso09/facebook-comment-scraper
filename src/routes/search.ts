import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { searchFacebook, SearchType } from '../search';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  const rawType = (req.query.type as string) || 'general';

  if (!q || !q.trim()) {
    res.status(400).json({ error: 'Missing query parameter "q"' });
    return;
  }

  const searchType: SearchType = ['profile', 'reel', 'general'].includes(rawType)
    ? (rawType as SearchType)
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

export default router;
