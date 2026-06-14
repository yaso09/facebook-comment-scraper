import { Job } from '../scraper/types';

const TTL_MS = 60 * 60 * 1000;

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
