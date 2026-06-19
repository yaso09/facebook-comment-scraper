const express = require('express');
const scrapeRouter = require('./routes/scrape');
const searchRouter = require('./routes/search');
const { logger } = require('./utils/logger');

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/scrape', scrapeRouter);
app.use('/api/search', searchRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (!process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

module.exports = app;
