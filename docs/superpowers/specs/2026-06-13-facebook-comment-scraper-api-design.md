# Facebook Comment Scraper API — Design Spec

## Overview

Rewrite the existing Python+Selenium Facebook comment scraper as a Node.js/TypeScript REST API using Puppeteer, deployable on Railway or Render (free tier).

## Architecture

```
POST /api/scrape  ─→  { jobId }
GET  /api/scrape/:jobId  ─→  { status, data }
```

Async job-based pattern: the scrape runs in the background, the client polls for results.

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js 20+ | User request |
| Language | TypeScript | Type safety |
| Framework | Express.js | Simple, well-known |
| Scraper | Puppeteer + puppeteer-infinite-scroller | Browser automation |
| Job State | In-memory Map | Railway single-instance |
| Auth | API Key (x-api-key header) | User request |
| Deploy | Railway / Render free tier | Long timeouts, Puppeteer support |

## API Endpoints

### `POST /api/scrape`

Submit a new scrape job.

- **Auth:** `x-api-key` header required
- **Body:** `{ "url": "https://facebook.com/..." }`
- **Response (201):** `{ "jobId": "abc123", "status": "queued" }`

### `GET /api/scrape/:jobId`

Poll job status and retrieve results.

- **Response (200) — pending:** `{ jobId, status: "queued" }`
- **Response (200) — processing:** `{ jobId, status: "processing", progress: { commentsSoFar } }`
- **Response (200) — completed:** `{ jobId, status: "completed", data: { postUrl, comments, totalComments, scrapedAt, elapsedSeconds } }`
- **Response (200) — failed:** `{ jobId, status: "failed", error }`

## Scraping Logic

1. Launch headless Chromium via Puppeteer
2. Navigate to the Facebook post URL
3. Wait for the comment section to render
4. Click "more comments" links repeatedly until no more appear
5. Use `puppeteer-infinite-scroller` to scroll and trigger lazy-loaded comments
6. Extract comment data from the DOM (text, author, timestamp, likes, replies)
7. Store result in job store

## Project Structure

```
src/
├── index.ts                 # Express app bootstrap
├── routes/scrape.ts         # POST + GET handlers
├── scraper/
│   ├── browser.ts           # Puppeteer launch config
│   ├── facebook.ts          # Facebook comment extraction
│   └── types.ts             # Shared TypeScript interfaces
├── middleware/auth.ts        # API key check
├── storage/job-store.ts      # In-memory job store with TTL
└── utils/logger.ts           # Simple logger
```
