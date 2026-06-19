const { scrapeFacebookPost } = require('./scraper/facebook');
const { connectBrowser, createPage, closeBrowser } = require('./scraper/browser');
const { searchFacebook } = require('./search');

module.exports = {
  scrapeFacebookPost,
  connectBrowser,
  createPage,
  closeBrowser,
  searchFacebook,
};
