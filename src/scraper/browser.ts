import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../utils/logger';

let browser: Browser | null = null;

async function launchBrowser(): Promise<Browser> {
  logger.info('Launching headless browser');
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-accelerated-2d-canvas',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
    ],
    ignoreHTTPSErrors: true,
  });
}

function isBrowserActive(): boolean {
  return browser !== null && browser.connected && browser.process() !== null;
}

export async function getBrowser(): Promise<Browser> {
  if (!isBrowserActive()) {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    browser = await launchBrowser();
  }
  return browser!;
}

export async function createPage(): Promise<Page> {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  return page;
}

export async function closeBrowser() {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // browser may already be dead
    }
    browser = null;
    logger.info('Browser closed');
  }
}
