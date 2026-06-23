const puppeteer = require('puppeteer-core');
const { logger } = require('./utils/logger');

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

function cleanUrl(link) {
  let clean = link;

  if (/profile\.php/.test(clean)) {
    const id = clean.match(/(?<=id=)([0-9]*)/);
    if (id) clean = 'https://www.facebook.com/' + id[1];
  }

  if (/&id=/.test(clean)) {
    const id = clean.match(/(?<=&id=)([0-9]*)/);
    if (id) clean = 'https://www.facebook.com/' + id[1];
  }

  if (/\?id=/.test(clean)) {
    const id = clean.match(/(?<=\?id=)([0-9]*)/);
    if (id) clean = 'https://www.facebook.com/' + id[1];
  }

  if (/comment_id=/.test(clean)) {
    const name = clean.match(/(?<=www\.facebook\.com\/)([^/]*)/);
    if (name) clean = 'https://www.facebook.com/' + name[1];
  }

  clean = clean.replace(/\/pages\//, '/');
  clean = clean.replace(/facebook\.com\/category\/(.*?)\//, 'facebook.com/');
  clean = clean.replace(/\/posts\//, '/');
  clean = clean.replace(/\/photos\/(.*)/, '');
  clean = clean.replace(/\/public\//, '/');
  clean = clean.replace(/\/videos\/(.*)/, '');
  clean = clean.replace(/\/posts/, '/');
  clean = clean.replace(/(\?)(.*)/, '');
  clean = clean.replace(/\/\/pages\./, '//www.');
  clean = clean.replace(/mbasic\.facebook\.com/, 'www.facebook.com');

  if (/\/people\//.test(clean) || /\/commerce\/products\//.test(clean) || /\/groups\//.test(clean) || /\/hashtag\//.test(clean) || /query=/.test(clean)) {
    clean = clean.replace(/\/?$/, '');
    return clean + '/about';
  }

  const match = clean.match(/(?<=www\.facebook\.com\/)([^/]*)/);
  if (match) {
    clean = 'https://www.facebook.com/' + match[1];
  }

  clean = clean.replace(/\/?$/, '');
  return clean + '/about';
}

function extractPhone(text) {
  const re = /([+]?[+(][0-9]{1,4}[)]?[-\s]?[0-9]{2,7}[-\s]?[0-9]{2,7}[-\s]?[0-9]{4,10})|([\d]{2,4}-[\d]{2,4}-[\d]{2,4})/;
  const m = text.match(re);
  return m ? m[0] : null;
}

function extractEmails(text) {
  const re = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = text.match(re);
  if (!matches) return null;
  return matches.length === 1 ? matches[0] : matches;
}

function extractWebsites(text) {
  const re = /\b(?:https?:\/\/|www\.)\S+\.\S+\b/gi;
  const matches = text.match(re);
  if (!matches) return null;
  return matches.length === 1 ? matches[0] : matches;
}

function extractRating(text) {
  const re = /Rating\s*[·]\s*(\d+(?:\.\d+)?)\s*\((\d+)\s+Reviews?\)/;
  const m = text.match(re);
  if (m) return { rate: m[1], reviews: m[2] };
  return null;
}

function extractSocialLinks(hrefs) {
  const patterns = [
    /(https?%3A%2F%2F(?:www\.)?instagram\.com%2F[\w.-]+)/,
    /(https?%3A%2F%2F(?:www\.)?linkedin\.com%2F[\w.-]+)/,
    /(https?%3A%2F%2F(?:www\.)?youtube\.com%2F[\w.-]+)/,
    /(https?%3A%2F%2F(?:www\.)?twitter\.com%2F[\w.-]+)/,
    /(https?%3A%2F%2F(?:www\.)?pinterest\.com%2F[\w.-]+)/,
  ];

  const found = [];
  for (const href of hrefs) {
    for (const pat of patterns) {
      const m = href.match(pat);
      if (m) {
        found.push(decodeURIComponent(m[1]));
        break;
      }
    }
  }

  if (found.length === 0) return null;
  return found.length === 1 ? found[0] : found;
}

function extractCoordinates(style) {
  if (!style || !style.includes('background-image:')) return null;
  const pattern = /center=([-+]?\d+\.\d+)%2C([-+]?\d+\.\d+)/;
  const m = style.match(pattern);
  if (m) {
    return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  }
  return null;
}

async function scrapePageInfo(url) {
  logger.info(`Page info scrape starting: ${url}`);

  let browser;
  try {
    const browserWSEndpoint = buildBrowserlessEndpoint();
    browser = await puppeteer.connect({
      browserWSEndpoint,
      protocolTimeout: 120_000,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const aboutUrl = cleanUrl(url);
    logger.info(`Navigating to: ${aboutUrl}`);

    await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 60_000 });

    try {
      await page.waitForSelector('body', { timeout: 10_000 });
    } catch {
      throw new Error('Page did not load');
    }

    const result = await page.evaluate(() => {
      const body = document.body;
      const bodyHTML = body.innerHTML;

      const pageName = (document.title || '').replace(' | Facebook', '').trim() || null;

      const layout = bodyHTML.includes('x1yztbdb') ? 'new' :
        bodyHTML.includes('x9orja2') ? 'old' : null;

      return { pageName, layout, bodyHTML };
    });

    if (!result.layout) {
      throw new Error('Not a Facebook page or page is private');
    }

    logger.info(`Detected layout: ${result.layout}`);

    const data = await page.evaluate((layoutType) => {
      const data = {};

      data.page_name = (document.title || '').replace(' | Facebook', '').trim() || null;

      if (layoutType === 'new') {
        const infoEl = document.querySelector('.x1yztbdb .x1iyjqo2');
        const infoText = infoEl ? infoEl.textContent || '' : '';
        const allAnchors = Array.from(document.querySelectorAll('a[href]'));
        const anchorHrefs = allAnchors.map(a => a.href);

        const catEl = infoEl ? infoEl.querySelector('.xat24cr') : null;
        data.page_category = catEl ? catEl.textContent.trim() : null;

        const socialPatterns = [
          /(?:https?:\/\/)?(?:www\.)?instagram\.com/i,
          /(?:https?:\/\/)?(?:www\.)?linkedin\.com/i,
          /(?:https?:\/\/)?(?:www\.)?youtube\.com/i,
          /(?:https?:\/\/)?(?:www\.)?twitter\.com/i,
          /(?:https?:\/\/)?(?:www\.)?pinterest\.com/i,
        ];
        const found = [];
        for (const href of anchorHrefs) {
          for (const pat of socialPatterns) {
            if (pat.test(href) && !found.includes(href)) {
              found.push(href);
              break;
            }
          }
        }
        data.social_media_links = found.length === 1 ? found[0] : found.length > 1 ? found : null;

        const phoneRe = /([+]?[+(][0-9]{1,4}[)]?[\s-]?[0-9]{2,7}[\s-]?[0-9]{2,7}[\s-]?[0-9]{4,10})|([\d]{2,4}-[\d]{2,4}-[\d]{2,4})/;
        const phoneM = infoText.match(phoneRe);
        data.phone_number = phoneM ? phoneM[0] : null;

        const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emailMatches = infoText.match(emailRe);
        data.email = emailMatches ? (emailMatches.length === 1 ? emailMatches[0] : emailMatches) : null;

        const urlRe = /\b(?:https?:\/\/|www\.)\S+\.\S+\b/gi;
        const urlMatches = infoText.match(urlRe);
        if (urlMatches) {
          const filtered = urlMatches.filter(u => !/facebook\.com/i.test(u));
          data.page_website = filtered.length === 1 ? filtered[0] : filtered.length > 1 ? filtered : null;
        } else {
          data.page_website = null;
        }

        const locationEl = infoEl ? infoEl.querySelector('.x1hq5gj4') : null;
        if (locationEl) {
          const span = locationEl.querySelector('span[dir="auto"]');
          data.location = span ? span.textContent.trim() : null;
        } else {
          data.location = null;
        }

        const ratingRe = /Rating\s*[\u00B7\u2022]\s*(\d+(?:\.\d+)?)\s*\((\d+)\s+Reviews?\)/;
        const ratingM = infoText.match(ratingRe);
        if (ratingM) {
          data.page_rate = ratingM[1];
          data.page_review_number = ratingM[2];
        } else {
          data.page_rate = null;
          data.page_review_number = null;
        }

        data.page_likes = null;
        data.page_followers = null;
        data.page_following = null;
        for (const a of allAnchors) {
          const h = a.href || '';
          const t = a.textContent.trim().toLowerCase();
          if (h.includes('followers') && !data.page_followers) {
            data.page_followers = a.textContent.trim().replace(/followers/i, '').trim();
          }
          if (h.includes('likes') && !data.page_likes) {
            data.page_likes = a.textContent.trim().replace(/likes/i, '').trim();
          }
          if (h.includes('following') && !data.page_following) {
            data.page_following = a.textContent.trim().replace(/following/i, '').trim();
          }
        }
      }

      if (layoutType === 'old') {
        const oldEls = document.querySelectorAll('.x9orja2');
        const allText = Array.from(oldEls).map(el => el.textContent || '').join('\n');
        const allAnchors = Array.from(document.querySelectorAll('a[href]'));

        const phoneRe = /([+]?[+(][0-9]{1,4}[)]?[\s-]?[0-9]{2,7}[\s-]?[0-9]{2,7}[\s-]?[0-9]{4,10})|([\d]{2,4}-[\d]{2,4}-[\d]{2,4})/;
        const phoneM = allText.match(phoneRe);
        data.phone_number = phoneM ? phoneM[0] : null;

        const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emailMatches = allText.match(emailRe);
        data.email = emailMatches ? (emailMatches.length === 1 ? emailMatches[0] : emailMatches) : null;

        const urlRe = /\b(?:https?:\/\/|www\.)\S+\.\S+\b/gi;
        const urlMatches = allText.match(urlRe);
        if (urlMatches) {
          const filtered = urlMatches.filter(u => !/facebook\.com/i.test(u));
          data.page_website = filtered.length === 1 ? filtered[0] : filtered.length > 1 ? filtered : null;
        } else {
          data.page_website = null;
        }

        const socialPatterns = [
          /(?:https?:\/\/)?(?:www\.)?instagram\.com/i,
          /(?:https?:\/\/)?(?:www\.)?linkedin\.com/i,
          /(?:https?:\/\/)?(?:www\.)?youtube\.com/i,
          /(?:https?:\/\/)?(?:www\.)?twitter\.com/i,
          /(?:https?:\/\/)?(?:www\.)?pinterest\.com/i,
        ];
        const foundSocial = [];
        for (const a of allAnchors) {
          const h = a.href || '';
          for (const pat of socialPatterns) {
            if (pat.test(h) && !foundSocial.includes(h)) {
              foundSocial.push(h);
              break;
            }
          }
        }
        data.social_media_links = foundSocial.length === 1 ? foundSocial[0] : foundSocial.length > 1 ? foundSocial : null;

        const x78Els = document.querySelectorAll('.x78zum5');
        let category = null;
        let likes = null;
        let followers = null;
        for (const el of x78Els) {
          if (el.className === 'x78zum5' && !category) {
            category = el.textContent.trim();
            const parent = el.parentElement;
            if (parent) {
              const divs = parent.querySelectorAll('div');
              for (const d of divs) {
                if (d.className === 'x78zum5 xdt5ytf xl56j7k') {
                  const t = d.textContent.toLowerCase();
                  if (t.includes('like') && !likes) likes = d.textContent.trim();
                  if (t.includes('follow') && !followers) followers = d.textContent.trim();
                }
              }
            }
          }
        }
        data.page_category = category;
        data.page_likes = likes;
        data.page_followers = followers;
        data.page_following = null;
        data.page_rate = null;
        data.page_review_number = null;
        data.location = null;

        const locEls = document.querySelectorAll('.x5yr21d');
        for (const el of locEls) {
          if (el.className === 'x5yr21d xh8yej3') {
            const inner = el.querySelector('.x1n2onr6');
            if (inner) {
              const div = inner.querySelector('div');
              if (div) {
                const style = div.getAttribute('style');
                if (style && style.includes('background-image:')) {
                  const m = style.match(/center=([-+]?\d+\.\d+)%2C([-+]?\d+\.\d+)/);
                  if (m) {
                    data.location = `https://www.google.com/maps?q=${m[1]},${m[2]}`;
                  }
                }
              }
            }
            break;
          }
        }
      }

      return data;
    }, result.layout);
  } finally {
    if (browser) {
      try {
        if (browser.connected) await browser.disconnect();
      } catch { }
    }
  }
}

module.exports = { scrapePageInfo, cleanUrl };
