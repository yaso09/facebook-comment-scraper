const { createPage, closeBrowser } = require('./browser');
const { logger } = require('../utils/logger');

const SCRAPE_SCRIPT = `
(async () => {
  const KONTROL_PERIYODU = 700;
  const MAX_TIMEOUT = 7000;
  const MAX_DONGU = 50;
  const uyku = (ms) => new Promise(r => setTimeout(r, ms));

  function gaddarScroll() {
    window.scrollTo(0, document.body.scrollHeight);
    if (document.documentElement) {
      document.documentElement.scrollTop = document.documentElement.scrollHeight;
    }
    const tumDivler = document.querySelectorAll('div');
    tumDivler.forEach(div => {
      try {
        if (div.scrollHeight > div.clientHeight) {
          const style = window.getComputedStyle(div);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll' || div.getAttribute('role') === 'dialog') {
            div.scrollTop = div.scrollHeight;
          }
        }
      } catch (e) {}
    });
    const tumYorumlar = document.querySelectorAll('div[role="article"]');
    if (tumYorumlar.length > 0) {
      tumYorumlar[tumYorumlar.length - 1].scrollIntoView({ block: "end", behavior: "auto" });
    }
  }

  function butonlariTikla() {
    try {
      const butonlar = document.querySelectorAll('div[role="button"], span[role="button"]');
      let tiklamaYapildi = false;
      butonlar.forEach(btn => {
        const metin = btn.innerText ? btn.innerText.toLowerCase() : "";
        if (
          metin.includes("diğer yorumları gör") ||
          metin.includes("daha fazla yorum") ||
          metin.includes("yanıtı gör") ||
          metin.includes("yanıtları gör") ||
          metin.includes("view more comments") ||
          metin.includes("view replies")
        ) {
          btn.click();
          tiklamaYapildi = true;
        }
      });
      return tiklamaYapildi;
    } catch (e) {
      return false;
    }
  }

  for (let i = 1; i <= MAX_DONGU; i++) {
    try {
      const eskiYorumSayisi = document.querySelectorAll('div[role="article"]').length;
      gaddarScroll();
      const butonTiklandi = butonlariTikla();
      let gecenSure = 0;
      let yeniVeriGeldiMi = false;

      while (gecenSure < MAX_TIMEOUT) {
        await uyku(KONTROL_PERIYODU);
        gecenSure += KONTROL_PERIYODU;
        const guncelYorumSayisi = document.querySelectorAll('div[role="article"]').length;
        if (guncelYorumSayisi > eskiYorumSayisi) {
          yeniVeriGeldiMi = true;
          break;
        }
      }

      if (!yeniVeriGeldiMi && !butonTiklandi) break;
    } catch (e) {
      await uyku(1000);
    }
  }

  const commentBlocks = document.querySelectorAll('div[role="article"]');
  const extractedComments = [];

  commentBlocks.forEach((block, index) => {
    try {
      const authorLinkEl = block.querySelector('a[role="link"][href*="facebook.com"], a[role="link"][href^="/"]');
      const authorNameEl = block.querySelector('span[dir="auto"] strong, a[role="link"] span');
      const textEl = block.querySelector('div[dir="auto"]');

      if (authorNameEl && textEl) {
        let username = "Bilinmiyor";

        if (authorLinkEl && authorLinkEl.href) {
          try {
            const urlObj = new URL(authorLinkEl.href);
            let cleanPath = urlObj.pathname.replace(/^\\/+|\\/+$/g, '');

            if (cleanPath && cleanPath !== 'profile.php' && !cleanPath.includes('posts')) {
              username = cleanPath.split('/')[0];
            } else if (urlObj.searchParams.has('id')) {
              username = urlObj.searchParams.get('id');
            }
          } catch (urlErr) {
            const parts = authorLinkEl.href.split('/');
            username = parts[parts.length - 1] || "Bilinmiyor";
          }
        }

        extractedComments.push({
          id: index + 1,
          display_name: authorNameEl.innerText.trim(),
          username: username,
          comment: textEl.innerText.trim()
        });
      }
    } catch (e) {}
  });

  return extractedComments;
})()
`;

async function scrapeFacebookPost(url) {
  const startTime = Date.now();
  const { page, browser } = await createPage();

  try {
    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    logger.info('Waiting for comment section');
    await page.waitForSelector('div[role="article"]', { timeout: 30000 });
    logger.info('Comment section loaded');

    logger.info('Starting scroll/click loop');
    const raw = await page.evaluate(SCRAPE_SCRIPT);
    const comments = Array.isArray(raw) ? raw : [];

    logger.info(`Scraped ${comments.length} comments`);

    return {
      postUrl: url,
      comments,
      totalComments: comments.length,
      scrapedAt: new Date().toISOString(),
      elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Scrape failed: ${msg}`);
    throw err;
  } finally {
    try { await page.close(); } catch { /* ignore */ }
    await closeBrowser(browser);
  }
}

module.exports = { scrapeFacebookPost };
