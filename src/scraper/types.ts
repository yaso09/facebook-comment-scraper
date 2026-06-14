export interface ScrapedComment {
  id: number;
  display_name: string;
  username: string;
  comment: string;
}

export interface ScrapeResult {
  postUrl: string;
  comments: ScrapedComment[];
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
