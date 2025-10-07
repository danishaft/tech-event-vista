import { Queue } from 'bullmq'
import { connection } from './redis'

// Production-ready event scraping queue following official BullMQ patterns
export const eventScrapingQueue = new Queue('eventScraping', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 10, // Keep last 10 completed jobs for monitoring
    removeOnFail: 5,      // Keep last 5 failed jobs for debugging
    attempts: 3,          // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,        // Start with 2s delay, exponential backoff
    },
    delay: 1000,          // 1 second delay before processing
  },
})

// Production error handling for queue
eventScrapingQueue.on('error', (err) => {
  console.error('Event scraping queue error:', err)
  // In production, send to monitoring service
})

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully closing event scraping queue...')
  await eventScrapingQueue.close()
})

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully closing event scraping queue...')
  await eventScrapingQueue.close()
})

