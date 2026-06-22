# Facebook Comment Scraper API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Python+Selenium Facebook comment scraper as a Node.js/TypeScript REST API using Puppeteer, deployable on Railway/Render.

**Architecture:** Express.js REST API with async job pattern. POST `/api/scrape` queues a job and returns a jobId; GET `/api/scrape/:jobId` returns status/results. The scraper uses Puppeteer + `puppeteer-infinite-scroller` to scroll and extract all Facebook comments.

**Tech Stack:** Node.js 20+, TypeScript, Express.js, Puppeteer, puppeteer-infinite-scroller, In-Memory job store with TTL

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "facebook-comment-scraper-api",
  "version": "1.0.0",
  "description": "REST API for scraping Facebook post comments using Puppeteer",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^22.0.0",
    "puppeteer-infinite-scroller": "^1.0.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `.env.example`**

```
API_KEY=your-secret-api-key-here
PORT=3000
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: node_modules created, package-lock.json generated

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .env.example .gitignore package-lock.json
git commit -m "chore: scaffold Node.js TypeScript project"
```

---

### Task 2: Shared types

**Files:**
- Create: `src/scraper/types.ts`

- [ ] **Step 1: Create `src/scraper/types.ts`**

```typescript
export interface Reply {
  id: string;
  text: string;
  author: string;
  authorUrl: string;
  authorProfilePic: string;
  timestamp: string;
  likes: number;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  authorUrl: string;
  authorProfilePic: string;
  timestamp: string;
  likes: number;
  replies: Reply[];
}

export interface ScrapeResult {
  postUrl: string;
  comments: Comment[];
  totalComments: number;
  scrapedAt: string;
  elapsedSeconds: number;
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  url: string;
  createdAt: number;
  updatedAt: number;
  result?: ScrapeResult;
  error?: string;
  progress?: {
    commentsSoFar: number;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scraper/types.ts
git commit -m "feat: add shared TypeScript interfaces"
```

---

### Task 3: Logger utility

**Files:**
- Create: `src/utils/logger.ts`

- [ ] **Step 1: Create `src/utils/logger.ts`**

```typescript
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/logger.ts
git commit -m "feat: add logger utility"
```

---

### Task 4: Auth middleware

**Files:**
- Create: `src/middleware/auth.ts`

- [ ] **Step 1: Create `src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
    return;
  }

  next();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware/auth.ts
git commit -m "feat: add API key auth middleware"
```

---

### Task 5: Job store (in-memory with TTL)

**Files:**
- Create: `src/storage/job-store.ts`

- [ ] **Step 1: Create `src/storage/job-store.ts`**

```typescript
import { Job, JobStatus } from '../scraper/types';

const TTL_MS = 60 * 60 * 1000; // 1 hour

class JobStore {
  private jobs = new Map<string, Job>();

  create(url: string): Job {
    const job: Job = {
      id: crypto.randomUUID(),
      status: 'queued',
      url,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.jobs.set(job.id, job);
    this.scheduleCleanup(job.id);
    return job;
  }

  get(id: string): Job | undefined {
    const job = this.jobs.get(id);
    if (job && Date.now() - job.createdAt > TTL_MS) {
      this.jobs.delete(id);
      return undefined;
    }
    return job;
  }

  update(id: string, updates: Partial<Job>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, updates, { updatedAt: Date.now() });
    return job;
  }

  private scheduleCleanup(id: string) {
    setTimeout(() => {
      this.jobs.delete(id);
    }, TTL_MS);
  }
}

export const jobStore = new JobStore();
```

- [ ] **Step 2: Commit**

```bash
git add src/storage/job-store.ts
git commit -m "feat: add in-memory job store with TTL"
```

---

### Task 6: Puppeteer browser setup

**Files:**
- Create: `src/scraper/browser.ts`

- [ ] **Step 1: Create `src/scraper/browser.ts`**

```typescript
import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../utils/logger';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    logger.info('Launching headless browser');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--single-process',
      ],
    });
  }
  return browser;
}

export async function createPage(): Promise<Page> {
  const b = await getBrowser();
  const page = await b.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  return page;
}

export async function closeBrowser() {
  if (browser && browser.connected) {
    await browser.close();
    browser = null;
    logger.info('Browser closed');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scraper/browser.ts
git commit -m "feat: add Puppeteer browser setup"
```

---

### Task 7: Facebook scraper logic with puppeteer-infinite-scroller

**Files:**
- Create: `src/scraper/facebook.ts`
- Depends on: `src/scraper/types.ts`, `src/scraper/browser.ts`, `puppeteer-infinite-scroller`

- [ ] **Step 1: Create `src/scraper/facebook.ts`**

```typescript
import { Page } from 'puppeteer';
import puppeteerInfiniteScroller from 'puppeteer-infinite-scroller';
import { createPage } from './browser';
import { Comment, Reply, ScrapeResult } from './types';
import { logger } from '../utils/logger';

function extractCommentData(): Comment[] {
  const comments: Comment[] = [];
  const commentElements = document.querySelectorAll('[data-commentid]');

  for (const el of commentElements) {
    try {
      const commentId = el.getAttribute('data-commentid') || '';
      const textEl = el.querySelector('[dir="ltr"]');
      const authorLink = el.querySelector('a[href*="facebook.com"]');
      const authorImg = el.querySelector('img');
      const likeEl = el.querySelector('[data-tooltip-content*="like"]');
      const timeEl = el.querySelector('abbr');

      const text = textEl ? (textEl as HTMLElement).innerText.trim() : '';
      const author = authorLink ? (authorLink as HTMLElement).innerText.trim() : 'Unknown';
      const authorUrl = authorLink ? (authorLink as HTMLAnchorElement).href : '';
      const authorProfilePic = authorImg ? (authorImg as HTMLImageElement).src : '';
      const likes = likeEl ? parseInt(likeEl.textContent?.trim() || '0', 10) || 0 : 0;
      const timestamp = timeEl ? (timeEl as HTMLElement).getAttribute('title') || '' : '';

      const replyElements = el.querySelectorAll('[data-commentid] [data-commentid]');
      const replies: Reply[] = [];
      for (const replyEl of replyElements) {
        const replyTextEl = replyEl.querySelector('[dir="ltr"]');
        const replyAuthorLink = replyEl.querySelector('a[href*="facebook.com"]');
        const replyAuthorImg = replyEl.querySelector('img');
        const replyLikeEl = replyEl.querySelector('[data-tooltip-content*="like"]');
        const replyTimeEl = replyEl.querySelector('abbr');

        replies.push({
          id: replyEl.getAttribute('data-commentid') || '',
          text: replyTextEl ? (replyTextEl as HTMLElement).innerText.trim() : '',
          author: replyAuthorLink ? (replyAuthorLink as HTMLElement).innerText.trim() : 'Unknown',
          authorUrl: replyAuthorLink ? (replyAuthorLink as HTMLAnchorElement).href : '',
          authorProfilePic: replyAuthorImg ? (replyAuthorImg as HTMLImageElement).src : '',
          timestamp: replyTimeEl ? (replyTimeEl as HTMLElement).getAttribute('title') || '' : '',
          likes: replyLikeEl ? parseInt(replyLikeEl.textContent?.trim() || '0', 10) || 0 : 0,
        });
      }

      comments.push({
        id: commentId,
        text,
        author,
        authorUrl,
        authorProfilePic,
        timestamp,
        likes,
        replies,
      });
    } catch {
      // skip malformed comment elements
    }
  }

  return comments;
}

async function clickMoreButtons(page: Page) {
  let clicked = 0;
  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    const buttons = await page.$$eval(
      'a[href*="comment"]:not([href*="comment_id"])',
      (elements) =>
        elements
          .filter((el) => {
            const text = (el as HTMLElement).innerText.toLowerCase();
            return text.includes('more comments') || text.includes('view') || text.includes('show');
          })
          .map((el) => el as HTMLElement)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;

    if (buttons.length === 0) {
      retries++;
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    for (const btn of buttons) {
      try {
        await (btn as unknown as HTMLElement).click();
        clicked++;
        await new Promise((r) => setTimeout(r, 500));
      } catch {
        // stale element
      }
    }
    retries = 0;
    await new Promise((r) => setTimeout(r, 1500));
  }

  logger.info(`Clicked ${clicked} 'more comments' buttons`);
}

function createScrapePageFunction() {
  return () => {
    // Click "See More" on long comments
    document.querySelectorAll('a[href*="see_more"]').forEach((el) => {
      try {
        (el as HTMLElement).click();
      } catch {
        // ignore
      }
    });

    // Also attempt to click "more comments" buttons from within the page
    document.querySelectorAll('a').forEach((el) => {
      const text = (el as HTMLElement).innerText.toLowerCase();
      if (text.includes('more comments') || text.includes('view more')) {
        try {
          (el as HTMLElement).click();
        } catch {
          // ignore
        }
      }
    });

    return extractCommentData();
  };
}

export async function scrapeFacebookPost(url: string): Promise<ScrapeResult> {
  const startTime = Date.now();
  const page = await createPage();

  try {
    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for comment section to appear
    await page.waitForSelector('[data-commentid]', { timeout: 30000 });
    logger.info('Comment section loaded');

    // Use puppeteer-infinite-scroller to scroll and load all comments
    logger.info('Starting infinite scroll for comment loading');
    const options = {
      scrollDelay: 1500,
      itemCount: 0, // 0 = scroll until no new content loads
      pageFunction: createScrapePageFunction(),
    };

    const scrapedData = await puppeteerInfiniteScroller(page, options);
    const flatComments: Comment[] = scrapedData.flat() as Comment[];

    // Deduplicate comments by id
    const seen = new Set<string>();
    const uniqueComments = flatComments.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    logger.info(`Scraped ${uniqueComments.length} unique comments`);

    const result: ScrapeResult = {
      postUrl: url,
      comments: uniqueComments,
      totalComments: uniqueComments.length,
      scrapedAt: new Date().toISOString(),
      elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
    };

    return result;
  } finally {
    await page.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scraper/facebook.ts
git commit -m "feat: add Facebook comment scraper with puppeteer-infinite-scroller"
```

---

### Task 8: Scrape route (POST + GET)

**Files:**
- Create: `src/routes/scrape.ts`

- [ ] **Step 1: Create `src/routes/scrape.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { jobStore } from '../storage/job-store';
import { scrapeFacebookPost } from '../scraper/facebook';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// POST /api/scrape — submit a new scrape job
router.post('/', (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid URL' });
    return;
  }

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  const job = jobStore.create(url);
  logger.info(`Job ${job.id} created for ${url}`);

  // Process in background (response sent immediately)
  processJob(job.id);

  res.status(201).json({ jobId: job.id, status: job.status });
});

// GET /api/scrape/:jobId — poll job status
router.get('/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const response: Record<string, unknown> = {
    jobId: job.id,
    status: job.status,
  };

  if (job.status === 'completed' && job.result) {
    response.data = job.result;
  } else if (job.status === 'failed') {
    response.error = job.error;
  } else if (job.progress) {
    response.progress = job.progress;
  }

  res.json(response);
});

async function processJob(jobId: string) {
  const job = jobStore.get(jobId);
  if (!job) return;

  jobStore.update(jobId, { status: 'processing' });

  try {
    const result = await scrapeFacebookPost(job.url);
    jobStore.update(jobId, { status: 'completed', result });
    logger.info(`Job ${jobId} completed: ${result.totalComments} comments`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Job ${jobId} failed: ${errorMessage}`);
    jobStore.update(jobId, { status: 'failed', error: errorMessage });
  }
}

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/scrape.ts
git commit -m "feat: add scrape routes (POST + GET)"
```

---

### Task 9: Express app entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```typescript
import express from 'express';
import scrapeRouter from './routes/scrape';
import { logger } from './utils/logger';
import { closeBrowser } from './scraper/browser';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/scrape', scrapeRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  await closeBrowser();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
```

- [ ] **Step 2: Verify the app compiles and starts**

Run: `npx tsc`
Expected: `dist/` directory created with compiled JS

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add Express app entry point"
```

---

### Task 10: Railway deployment config

**Files:**
- Create: `railway.json`
- Create: `Dockerfile` (optional, Railway auto-detects Node.js)

- [ ] **Step 1: Create `railway.json`**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add railway.json
git commit -m "chore: add Railway deployment config"
```

---

### Task 11: Final verification

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: dist/ folder contains compiled JavaScript

- [ ] **Step 2: Verify all files exist**

Run: `dir src /s /b`
Expected:
```
src\index.ts
src\middleware\auth.ts
src\routes\scrape.ts
src\scraper\browser.ts
src\scraper\facebook.ts
src\scraper\types.ts
src\storage\job-store.ts
src\utils\logger.ts
```

- [ ] **Step 3: Start the server (test mode, no actual scraping)**

Run: `set API_KEY=test123 && npx ts-node src/index.ts`
Expected: `[timestamp] [INFO] Server running on port 3000`

- [ ] **Step 4: Verify health endpoint**

In a new terminal, run: `curl http://localhost:3000/health`
Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 5: Stop server**

Press Ctrl+C
