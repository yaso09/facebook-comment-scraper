import express from 'express';
import scrapeRouter from './routes/scrape';
import searchRouter from './routes/search';
import { logger } from './utils/logger';
import { closeBrowser } from './scraper/browser';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/scrape', scrapeRouter);
app.use('/api/search', searchRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

async function shutdown() {
  logger.info('Shutting down...');
  await closeBrowser();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
