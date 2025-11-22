/**
 * BullMQ Worker for Processing Scraping Jobs
 * Handles asynchronous scraping jobs from the queue
 */

import { Worker } from 'bullmq'
import { connection } from '../redis'
import { type ScrapingJobData } from '../queue'
import { prisma } from '../prisma'
import {
  scrapeLumaEvents,
  scrapeEventbriteEvents,
  processApifyLumaEvents,
  processPuppeteerLumaEvents,
  processApifyEventbriteEvents,
  processPuppeteerEventbriteEvents,
} from '../scrapingService'

/**
 * Worker processor function
 * Processes scraping jobs from the queue
 */
async function processScrapingJob(job: { data: ScrapingJobData }) {
  const { jobId, query, platforms, city } = job.data

  let totalSaved = 0
  let foundResults = false

  try {
    // Process platforms sequentially - stop when we find results
    // This is faster for users - try Luma first, only try Eventbrite if Luma has no results
    for (const platform of platforms) {
      // Type guard: ensure platform is valid
      if (platform !== 'luma' && platform !== 'eventbrite') {
        console.warn(`⚠️ [WORKER] Skipping invalid platform: ${platform}`)
        continue
      }

      const validPlatform: 'luma' | 'eventbrite' = platform

      try {
        let events: any[] = []
        let source: 'apify' | 'puppeteer' = 'puppeteer'

        if (validPlatform === 'luma') {
          const result = await scrapeLumaEvents(query, 50)
          events = result.events
          source = result.source
        } else if (validPlatform === 'eventbrite') {
          const result = await scrapeEventbriteEvents(city, query)
          events = result.events
          source = result.source
        }

        if (events.length > 0) {
          // Process events in batches (not one-by-one)
          let saved = 0
          if (validPlatform === 'luma') {
            if (source === 'apify') {
              saved = await processApifyLumaEvents(events, city)
            } else {
              saved = await processPuppeteerLumaEvents(events, city)
            }
          } else if (validPlatform === 'eventbrite') {
            if (source === 'apify') {
              saved = await processApifyEventbriteEvents(events, city)
            } else {
              saved = await processPuppeteerEventbriteEvents(events, city)
            }
          }

          totalSaved += saved
          foundResults = true
          break // Stop processing other platforms - we found results!
        }
      } catch (platformError) {
        console.error(`❌ [WORKER] ${validPlatform} scraping failed for ${city}`, {
          jobId,
          platform: validPlatform,
          city,
          error: (platformError as Error).message,
        })
        // Continue to next platform if this one failed
      }
    }

    // Update job status to completed
    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        eventsScraped: totalSaved,
      },
    })

    return { success: true, totalSaved }
  } catch (error) {
    console.error(`❌ [WORKER] Job ${jobId} failed:`, {
      jobId,
      error: (error as Error).message,
      stack: (error as Error).stack,
    })

    // Update job status to failed
    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: (error as Error).message,
      },
    })

    throw error // Re-throw to trigger BullMQ retry logic
  }
}

/**
 * Create and export worker instance
 */
export const scrapingWorker = new Worker<ScrapingJobData>(
  'scraping-queue',
  processScrapingJob,
  {
    connection,
    concurrency: 1, // Process one job at a time
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  }
)

// Worker event handlers for debugging
scrapingWorker.on('active', (job) => {
  // Job started
})

scrapingWorker.on('completed', (job) => {
  // Job completed
})

scrapingWorker.on('failed', (job, err) => {
  console.error(`❌ [WORKER] Job ${job?.id} failed:`, err.message)
  if (err.stack) {
    console.error(`   Stack:`, err.stack)
  }
})

scrapingWorker.on('error', (err) => {
  console.error(`❌ [WORKER] Worker error:`, err.message)
  if (err.stack) {
    console.error(`   Stack:`, err.stack)
  }
})

scrapingWorker.on('stalled', (jobId) => {
  console.warn(`⚠️ [WORKER] Job ${jobId} stalled (taking too long)`)
})

// Verify worker is ready
scrapingWorker.on('ready', () => {
  // Worker ready
})

// Log when worker closes
scrapingWorker.on('closed', () => {
  // Worker closed
})


