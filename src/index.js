const express = require('express');
const scrapeRouter = require('./routes/scrape');
const searchRouter = require('./routes/search');
const pageInfoRouter = require('./routes/page-info');
const { logger } = require('./utils/logger');

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/scrape', scrapeRouter);
app.use('/search', searchRouter);
app.use('/page-info', pageInfoRouter);

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
