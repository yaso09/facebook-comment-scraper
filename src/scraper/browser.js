const puppeteer = require('puppeteer-core');
const { logger } = require('../utils/logger');

function buildBrowserlessEndpoint() {
  const token = process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY;
  if (!token) {
    throw new Error('BROWSERLESS_TOKEN (or BROWSERLESS_API_KEY) is required');
  }

  const host = process.env.BROWSERLESS_WS_HOST || 'production-sfo.browserless.io';
  const path = process.env.BROWSERLESS_WS_PATH || '/chromium';
  const endpoint = new URL(`wss://${host}${path}`);
  endpoint.searchParams.set('token', token);

  return endpoint.toString();
}

async function connectBrowser() {
  const browserWSEndpoint = buildBrowserlessEndpoint();
  logger.info('Connecting to Browserless via WebSocket');
  return puppeteer.connect({
    browserWSEndpoint,
    protocolTimeout: 120_000,
  });
}

async function configurePage(page) {
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
}

async function createPage() {
  const browser = await connectBrowser();
  const page = await browser.newPage();
  await configurePage(page);
  return { page, browser };
}

async function closeBrowser(browser) {
  try {
    if (browser.connected) {
      await browser.disconnect();
    }
  } catch {
    // browser may already be closed
  }
  logger.info('Browser disconnected');
}

module.exports = { connectBrowser, createPage, closeBrowser };
