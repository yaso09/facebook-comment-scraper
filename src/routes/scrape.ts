import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { jobStore } from '../storage/job-store';
import { scrapeFacebookPost } from '../scraper/facebook';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

router.post('/', (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid URL' });
    return;
  }

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  const job = jobStore.create(url);
  logger.info(`Job ${job.id} created for ${url}`);

  processJob(job.id);

  res.status(201).json({ jobId: job.id, status: job.status });
});

router.get('/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const response: Record<string, unknown> = {
    jobId: job.id,
    status: job.status,
  };

  if (job.status === 'completed' && job.result) {
    response.data = job.result;
  } else if (job.status === 'failed') {
    response.error = job.error;
  } else if (job.progress) {
    response.progress = job.progress;
  }

  res.json(response);
});

async function processJob(jobId: string) {
  const job = jobStore.get(jobId);
  if (!job) return;

  jobStore.update(jobId, { status: 'processing' });

  try {
    const result = await scrapeFacebookPost(job.url);
    jobStore.update(jobId, { status: 'completed', result });
    logger.info(`Job ${jobId} completed: ${result.totalComments} comments`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Job ${jobId} failed: ${errorMessage}`);
    jobStore.update(jobId, { status: 'failed', error: errorMessage });
  }
}

export default router;
