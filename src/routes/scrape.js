const { Router } = require('express');
const { waitUntil } = require('@vercel/functions');
const { authMiddleware } = require('../middleware/auth');
const { jobStore } = require('../storage/job-store');
const { scrapeFacebookPost } = require('../scraper/facebook');
const { logger } = require('../utils/logger');

const router = Router();

router.use(authMiddleware);

router.post('/', async (req, res) => {
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

  const job = await jobStore.create(url);
  logger.info(`Job ${job.id} created for ${url}`);

  if (process.env.VERCEL) {
    waitUntil(processJob(job.id));
  } else {
    void processJob(job.id);
  }

  res.status(201).json({ jobId: job.id, status: job.status });
});

router.get('/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = await jobStore.get(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const response = {
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

async function processJob(jobId) {
  const job = await jobStore.get(jobId);
  if (!job) return;

  await jobStore.update(jobId, { status: 'processing' });

  try {
    const result = await scrapeFacebookPost(job.url);
    await jobStore.update(jobId, { status: 'completed', result });
    logger.info(`Job ${jobId} completed: ${result.totalComments} comments`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Job ${jobId} failed: ${errorMessage}`);
    await jobStore.update(jobId, { status: 'failed', error: errorMessage });
  }
}

module.exports = router;
