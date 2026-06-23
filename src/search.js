const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const { logger } = require('./utils/logger');

const FACEBOOK_HOSTS = ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'mbasic.facebook.com'];

function classifyUrl(url) {
  try {
    const u = new URL(url);
    if (!FACEBOOK_HOSTS.includes(u.hostname)) return 'general';
    const path = u.pathname;
    if (/^\/(p|photo|photos)\//.test(path) || path.includes('profile.php')) return 'profile';
    if (/^\/reel\//.test(path)) return 'reel';
    return 'general';
  } catch {
    return 'general';
  }
}

function cleanGoogleUrl(href) {
  if (!href) return null;
  if (href.startsWith('/url?q=')) {
    const u = new URL(href, 'https://www.google.com');
    const q = u.searchParams.get('q');
    if (q) return q;
  }
  if (href.startsWith('http')) return href;
  return null;
}

function parseResults(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('div.g').each((_i, el) => {
    const container = $(el);
    const titleEl = container.find('h3').first();
    const linkEl = container.find('a[href]').first();
    const snippetEl = container.find('.VwiC3b, [data-sncf], .lEBKkf, span.aCOpRe').first();

    const title = titleEl.text().trim();
    const rawHref = linkEl.attr('href');
    const url = cleanGoogleUrl(rawHref);
    const description = snippetEl.text().trim();

    if (title && url) {
      results.push({
        title,
        url,
        description,
        type: classifyUrl(url),
      });
    }
  });

  return results;
}

function buildBrowserlessEndpoint() {
  const token = process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY;
  if (!token) {
    throw new Error('BROWSERLESS_TOKEN (or BROWSERLESS_API_KEY) is required for Google search');
  }
  const host = process.env.BROWSERLESS_WS_HOST || 'production-sfo.browserless.io';
  const path = process.env.BROWSERLESS_WS_PATH || '/chromium';
  const endpoint = new URL(`wss://${host}${path}`);
  endpoint.searchParams.set('token', token);
  return endpoint.toString();
}

async function searchFacebook(query, searchType) {
  const fullQuery = `site:facebook.com ${query.trim()}`;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}&hl=en&ie=UTF-8`;

  logger.info(`Google search via puppeteer: "${fullQuery}"`);

  let browser;
  try {
    const browserWSEndpoint = buildBrowserlessEndpoint();
    browser = await puppeteer.connect({
      browserWSEndpoint,
      protocolTimeout: 60_000,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30_000 });

    const consentSelector = '[aria-label="Accept all"], #L2AGLb, button:has(div:contains("Accept all")), form[action*="consent"]';
    try {
      await page.waitForSelector(consentSelector, { timeout: 3_000 });
      await page.click(consentSelector);
      await page.waitForSelector('h3', { timeout: 8_000 });
    } catch {
      // no consent banner or already accepted
    }

    try {
      await page.waitForSelector('h3', { timeout: 10_000 });
    } catch {
      logger.warn('Google returned no h3 elements (possibly blocked or no results)');
    }

    const html = await page.content();
    await page.close();

    const allResults = parseResults(html);
    logger.info(`Google search returned ${allResults.length} raw results`);

    let filtered = allResults;
    if (searchType && searchType !== 'general') {
      filtered = allResults.filter((r) => r.type === searchType);
    }

    return {
      query,
      searchType: searchType || 'general',
      fullQuery,
      total: filtered.length,
      results: filtered,
    };
  } finally {
    if (browser) {
      try {
        if (browser.connected) await browser.disconnect();
      } catch { }
    }
  }
}

module.exports = { searchFacebook };
