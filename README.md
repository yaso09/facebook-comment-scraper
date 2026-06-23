# Facebook Comment Scraper API

Node.js REST API for scraping Facebook post comments and page info using Puppeteer, plus Facebook-targeted search via Google.

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** JavaScript
- **Framework:** Express.js
- **Scraper:** Puppeteer-core via Browserless.io (WebSocket)
- **Search:** Google via Puppeteer (Browserless.io)

## API

All endpoints require `x-api-key` header. Returns 401 if missing or invalid.

### `POST /scrape`

Submit a scrape job. Returns `jobId` immediately — poll `GET /scrape/:jobId` for results.

```bash
curl -X POST http://localhost:3000/scrape \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://facebook.com/some-post"}'
```

**Response (201):** `{ "jobId": "abc123", "status": "queued" }`

### `GET /scrape/:jobId`

Poll job status. States: `queued` → `processing` → `completed` | `failed`

```bash
curl http://localhost:3000/scrape/abc123 \
  -H "x-api-key: your-api-key"
```

**Response (completed):**
```json
{
  "jobId": "abc123",
  "status": "completed",
  "data": {
    "postUrl": "https://facebook.com/...",
    "comments": [
      { "id": 1, "display_name": "Mustafa Gümüşay", "username": "mustafa.gumusay.969", "comment": "Great post!" }
    ],
    "totalComments": 42,
    "scrapedAt": "2026-06-14T12:00:00Z",
    "elapsedSeconds": 15
  }
}
```

**Response (failed):** `{ "jobId": "abc123", "status": "failed", "error": "..." }`

### `GET /search?q=kelime&type=profile`

Searches Facebook content via **Google** using Puppeteer (Browserless.io).  
Every result URL is classified by type — `type` parameter acts as a **filter**, not a query modifier.

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `q` | yes | — | Search query |
| `type` | no | `general` | Filter: `profile`, `reel`, or `general` |

**URL-based type classification:**

| Type | URL pattern |
|------|-------------|
| `profile` | `/p/`, `/photo/`, `/photos/`, `profile.php` |
| `reel` | `/reel/` |
| `general` | Everything else |

```bash
curl "http://localhost:3000/search?q=ahmet&type=profile" \
  -H "x-api-key: your-api-key"
```

**Response:**
```json
{
  "query": "ahmet",
  "searchType": "profile",
  "fullQuery": "site:facebook.com ahmet",
  "total": 5,
  "results": [
    { "title": "Ahmet Yılmaz", "url": "https://facebook.com/p/123", "description": "...", "type": "profile" }
  ]
}
```

### `GET /page-info?url=https://facebook.com/SomePage`

Scrapes public Facebook page information (name, category, contact, social links, stats) using Puppeteer (Browserless.io).

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `url` | yes | — | Full Facebook page URL |

```bash
curl "http://localhost:3000/page-info?url=https://facebook.com/SomePage" \
  -H "x-api-key: your-api-key"
```

**Response:**
```json
{
  "url": "https://facebook.com/SomePage",
  "page_name": "SomePage",
  "page_category": "Brand",
  "email": "contact@example.com",
  "phone_number": "+90 555 123 4567",
  "page_website": "https://example.com",
  "social_media_links": [
    "https://instagram.com/somepage",
    "https://twitter.com/somepage"
  ],
  "location": "İstanbul, Türkiye",
  "page_likes": "1.2M",
  "page_followers": "1.5M",
  "page_following": "100",
  "page_rate": "4.6",
  "page_review_number": "1240"
}
```

### `GET /health`

```bash
curl http://localhost:3000/health
```
```json
{ "status": "ok", "timestamp": "2026-06-14T12:00:00Z" }
```

## Quick Start

```bash
git clone <repo>
cd facebook-comment-scraper
npm install
set API_KEY=my-secret-key
set BROWSERLESS_TOKEN=your-browserless-token
npm run dev
```

## Deploy (Vercel)

1. Push repo to GitHub and import in [Vercel](https://vercel.com).
2. Add **Upstash Redis** from [Vercel Marketplace](https://vercel.com/marketplace?category=storage&search=redis) — required for async scrape job polling across serverless invocations.
3. Set environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | Yes | Auth key for all endpoints |
| `BROWSERLESS_TOKEN` | Yes | [Browserless.io](https://browserless.io) API token |
| `UPSTASH_REDIS_REST_URL` | Yes (Vercel) | Auto-set when Redis is linked |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (Vercel) | Auto-set when Redis is linked |

Optional Browserless overrides: `BROWSERLESS_WS_HOST` (default `production-sfo.browserless.io`), `BROWSERLESS_WS_PATH` (default `/chromium`).

Scrape jobs run in the background via `waitUntil` (max 300s on Pro). Hobby plan has a 60s function limit — upgrade or shorten scrapes if needed.

## Deploy (Railway)

```bash
npm start
```

Set `API_KEY` and `BROWSERLESS_TOKEN` in Railway dashboard → Variables. Redis is optional on Railway (in-memory job store works with a single replica).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | Yes | — | Auth key for all endpoints |
| `BROWSERLESS_TOKEN` | Yes | — | Browserless.io API token for remote Chromium |
| `BROWSERLESS_WS_HOST` | No | `production-sfo.browserless.io` | Browserless WebSocket host |
| `BROWSERLESS_WS_PATH` | No | `/chromium` | Browserless WebSocket path |
| `UPSTASH_REDIS_REST_URL` | Vercel | — | Upstash Redis REST URL (job polling) |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel | — | Upstash Redis REST token |
| `PORT` | No | 3000 | Server port (local/Railway only) |
| `LOG_LEVEL` | No | info | debug, info, warn, error |

## Project Structure

```
src/
├── index.js              # Express server
├── lib.js                # Public exports
├── page-info.js           # Facebook page info scraper
├── middleware/auth.js    # API key auth
├── routes/
│   ├── scrape.js         # POST + GET /scrape
│   ├── search.js         # GET /search
│   └── page-info.js      # GET /page-info
├── scraper/
│   ├── browser.js        # puppeteer-core → Browserless WebSocket
│   └── facebook.js       # Facebook scraping logic
├── storage/job-store.js  # In-memory or Upstash Redis job store (1h TTL)
└── utils/logger.js       # Logger
api/
└── index.js              # Vercel serverless entry
```
