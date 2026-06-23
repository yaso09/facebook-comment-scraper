const { scrapeFacebookPost } = require('./scraper/facebook');
const { connectBrowser, createPage, closeBrowser } = require('./scraper/browser');
const { searchFacebook } = require('./search');
const { scrapePageInfo } = require('./page-info');

module.exports = {
  scrapeFacebookPost,
  connectBrowser,
  createPage,
  closeBrowser,
  searchFacebook,
  scrapePageInfo,
};
