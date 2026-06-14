# Facebook Comment Scraper API

Node.js REST API for scraping Facebook post comments using Puppeteer, plus Facebook-targeted search via DuckDuckGo.

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **Framework:** Express.js
- **Scraper:** Puppeteer (headless browser)
- **Search:** duck-duck-scrape

## API

All endpoints require `x-api-key` header. Returns 401 if missing or invalid.

### `POST /api/scrape`

Submit a scrape job. Returns `jobId` immediately — poll `GET /api/scrape/:jobId` for results.

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://facebook.com/some-post"}'
```

**Response (201):** `{ "jobId": "abc123", "status": "queued" }`

### `GET /api/scrape/:jobId`

Poll job status. States: `queued` → `processing` → `completed` | `failed`

```bash
curl http://localhost:3000/api/scrape/abc123 \
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

### `GET /api/search?q=kelime&type=profile`

Searches Facebook content via DuckDuckGo with `site:facebook.com` prefix.

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `q` | yes | — | Search query |
| `type` | no | `general` | `profile`, `reel`, or `general` |

**Search types:**

| type | Sends to DuckDuckGo | Use case |
|------|---------------------|----------|
| `profile` | `site:facebook.com/p {q}` | Find people |
| `reel` | `site:facebook.com/reel {q}` | Find reels |
| `general` | `site:facebook.com {q}` | General search |

```bash
curl "http://localhost:3000/api/search?q=ahmet&type=profile" \
  -H "x-api-key: your-api-key"
```

**Response:**
```json
{
  "query": "ahmet",
  "searchType": "profile",
  "fullQuery": "site:facebook.com/p ahmet",
  "total": 10,
  "results": [
    { "title": "Ahmet Yılmaz", "url": "https://facebook.com/...", "description": "...", "hostname": "facebook.com" }
  ]
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
npm run dev
```

## Deploy (Railway)

```bash
npm run build
npm start
```

Set `API_KEY` in Railway dashboard → Variables.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | Yes | — | Auth key for all endpoints |
| `PORT` | No | 3000 | Server port |
| `LOG_LEVEL` | No | info | debug, info, warn, error |

## Project Structure

```
src/
├── index.ts              # Express server
├── middleware/auth.ts     # API key auth
├── routes/
│   ├── scrape.ts          # POST + GET /api/scrape
│   └── search.ts          # GET /api/search
├── scraper/
│   ├── browser.ts         # Puppeteer launch
│   ├── facebook.ts        # Facebook scraping logic
│   └── types.ts           # Types
├── storage/job-store.ts   # In-memory job store (1h TTL)
└── utils/logger.ts        # Logger
```
