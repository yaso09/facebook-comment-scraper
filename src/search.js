const { search, SafeSearchType } = require('duck-duck-scrape');

const SITE_PREFIXES = {
  profile: 'site:facebook.com/p',
  reel: 'site:facebook.com/reel',
  general: 'site:facebook.com',
};

async function searchFacebook(query, searchType = 'general') {
  const sitePrefix = SITE_PREFIXES[searchType];
  const fullQuery = `${sitePrefix} ${query.trim()}`;

  const result = await search(fullQuery, { safeSearch: SafeSearchType.STRICT });

  return {
    query,
    searchType,
    fullQuery,
    noResults: result.noResults,
    total: result.results.length,
    results: result.results.map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      hostname: r.hostname,
      icon: r.icon,
    })),
  };
}

module.exports = { searchFacebook };
