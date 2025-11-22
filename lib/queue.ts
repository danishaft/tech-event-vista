/**
 * BullMQ Queue Setup
 * Centralized queue configuration for scraping jobs
 */

import { Queue } from 'bullmq'
import { connection } from './redis'

/**
 * Job data interface for scraping jobs
 */
export interface ScrapingJobData {
  jobId: string
  query: string
  platforms: string[]
  city: string
}

/**
 * Scraping queue instance
 * Used for processing search scraping jobs asynchronously
 */
export const scrapingQueue = new Queue<ScrapingJobData>('scraping-queue', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
})


