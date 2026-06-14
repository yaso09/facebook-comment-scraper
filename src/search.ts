import { search, SafeSearchType } from 'duck-duck-scrape';

export type SearchType = 'profile' | 'reel' | 'general';

export interface SearchResultItem {
  title: string;
  url: string;
  description: string;
  hostname: string;
  icon: string;
}

export interface SearchResults {
  query: string;
  searchType: SearchType;
  fullQuery: string;
  noResults: boolean;
  total: number;
  results: SearchResultItem[];
}

const SITE_PREFIXES: Record<SearchType, string> = {
  profile: 'site:facebook.com/p',
  reel: 'site:facebook.com/reel',
  general: 'site:facebook.com',
};

export async function searchFacebook(
  query: string,
  searchType: SearchType = 'general'
): Promise<SearchResults> {
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
