const { Redis } = require('@upstash/redis');

const TTL_MS = 60 * 60 * 1000;
const TTL_SECONDS = 60 * 60;
const JOB_KEY_PREFIX = 'job:';

class MemoryJobStore {
  constructor() {
    this.jobs = new Map();
  }

  async create(url) {
    const job = {
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

  async get(id) {
    const job = this.jobs.get(id);
    if (job && Date.now() - job.createdAt > TTL_MS) {
      this.jobs.delete(id);
      return undefined;
    }
    return job;
  }

  async update(id, updates) {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, updates, { updatedAt: Date.now() });
    return job;
  }

  scheduleCleanup(id) {
    setTimeout(() => {
      this.jobs.delete(id);
    }, TTL_MS);
  }
}

class RedisJobStore {
  constructor(redis) {
    this.redis = redis;
  }

  key(id) {
    return `${JOB_KEY_PREFIX}${id}`;
  }

  async create(url) {
    const job = {
      id: crypto.randomUUID(),
      status: 'queued',
      url,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.redis.set(this.key(job.id), job, { ex: TTL_SECONDS });
    return job;
  }

  async get(id) {
    const job = await this.redis.get(this.key(id));
    if (!job) return undefined;
    if (Date.now() - job.createdAt > TTL_MS) {
      await this.redis.del(this.key(id));
      return undefined;
    }
    return job;
  }

  async update(id, updates) {
    const job = await this.get(id);
    if (!job) return undefined;
    const updated = { ...job, ...updates, updatedAt: Date.now() };
    await this.redis.set(this.key(id), updated, { ex: TTL_SECONDS });
    return updated;
  }
}

function hasRedisEnv() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    process.env.KV_URL ||
    process.env.REDIS_URL
  );
}

function createRedisClient() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Redis.fromEnv();
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return new Redis({
    url: process.env.KV_URL || process.env.REDIS_URL,
  });
}

function createJobStore() {
  if (hasRedisEnv()) {
    return new RedisJobStore(createRedisClient());
  }
  return new MemoryJobStore();
}

const jobStore = createJobStore();

module.exports = { jobStore };
