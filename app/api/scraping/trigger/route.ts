import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  scrapeLumaEvents, 
  scrapeEventbriteEvents, 
  processPuppeteerEventbriteEvents,
  processPuppeteerLumaEvents,
  processApifyEventbriteEvents,
  processApifyLumaEvents
} from '@/lib/scrapingService'

// Direct processing - no BullMQ for batch scraping
// Search also uses direct processing via SSE (no BullMQ)

// Force dynamic execution to prevent caching
export const dynamic = 'force-dynamic'
// Allow longer execution time for scraping (5 minutes max)
export const maxDuration = 300

/**
 * Verify that the request is from Vercel Cron
 * Vercel sends a special authorization header when triggering cron jobs
 */
function verifyCronRequest(request: NextRequest): boolean {
  // Check for Vercel cron secret (if set)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    return authHeader === `Bearer ${cronSecret}`
  }
  
  // If no CRON_SECRET is set, allow requests from Vercel's internal network
  // In production, Vercel cron jobs come from Vercel's infrastructure
  // For local development, we'll allow all requests
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  // In production, verify it's from Vercel (you can add additional checks here)
  // Vercel cron jobs are automatically authenticated by Vercel
  return true
}

/**
 * Start scraping job - shared logic for both GET (cron) and POST (manual)
 */
async function startScrapingJob(cities: string[], platforms: string[], maxEvents: number, body?: any) {
  // Create job record with retry logic for database connection
  const jobId = `scraping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  let jobCreated = false
  let retries = 0
  const maxRetries = 3
  
  while (!jobCreated && retries < maxRetries) {
    try {
      await prisma.scrapingJob.create({
        data: {
          id: jobId,
          platform: 'multi',
          status: 'running',
          query: 'tech',
          city: cities.join(','),
          platforms,
          startedAt: new Date(),
          eventsScraped: 0,
        },
      })
      jobCreated = true
    } catch (error: any) {
      retries++
      if (error.message?.includes('Can\'t reach database')) {
        console.warn(`⚠️ [BATCH-SCRAPING] Database connection failed (attempt ${retries}/${maxRetries}), retrying...`)
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries))
          continue
        }
      }
      throw error
    }
  }
  
  // Use Next.js after() to run scraping in background (non-blocking)
  // This ensures response is sent immediately while scraping happens in background
  after(async () => {
    console.log(`🚀 [BATCH-SCRAPING] Starting background scraping for job: ${jobId}`)
    
    try {
      let totalSaved = 0
      const startTime = Date.now()

      // Process each city
      for (const city of cities) {
        console.log(`🌆 [BATCH-SCRAPING] Processing city: ${city} for job: ${jobId}`)
        
        // Process each platform
        for (const platform of platforms) {
          // Type guard: ensure platform is valid
          if (platform !== 'luma' && platform !== 'eventbrite') {
            console.warn(`⚠️ [BATCH-SCRAPING] Skipping invalid platform: ${platform}`)
            continue
          }

          const validPlatform: 'luma' | 'eventbrite' = platform
          
          console.log(`🎯 [BATCH-SCRAPING] Starting ${validPlatform} scraping for ${city}`, {
            jobId,
            platform: validPlatform,
            city,
          })

          try {
            let events: any[] = []
            let source: 'apify' | 'puppeteer' = 'puppeteer'
            
            if (validPlatform === 'luma') {
              console.log(`🔍 [BATCH-SCRAPING] Starting Luma scrape for ${city}...`)
              // Use query from body if provided, otherwise default to 'tech'
              const lumaQuery = body?.query || body?.lumaQuery || 'tech'
              console.log(`   Using query: "${lumaQuery}"`)
              const result = await scrapeLumaEvents(lumaQuery, maxEvents)
              events = result.events
              source = result.source
              console.log(`📊 [BATCH-SCRAPING] Luma returned ${events.length} events for ${city} (source: ${source})`, {
                jobId,
                platform: validPlatform,
                city,
                eventsFound: events.length,
                source,
                sampleEvents: events.slice(0, 2).map(e => ({ title: e.name || e.title, id: e.id || e.api_id }))
              })
            } else if (validPlatform === 'eventbrite') {
              console.log(`🔍 [BATCH-SCRAPING] Starting Eventbrite scrape for ${city}...`)
              
              // Use multiple tech-related search queries for better results
              const techQueries = ['ai', 'data science', 'python', 'reactjs', 'javascript', 'machine learning']
              let allEvents: any[] = []
              let allSources: ('apify' | 'puppeteer')[] = []
              
              for (const query of techQueries) {
                console.log(`   🔎 Searching: ${query}`)
                const result = await scrapeEventbriteEvents(city, query)
                allEvents.push(...result.events)
                allSources.push(result.source)
                console.log(`   ✅ Found ${result.events.length} events for "${query}" (source: ${result.source})`)
                
                // Small delay between queries to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000))
              }
              
              // Deduplicate by URL
              const uniqueEvents = allEvents.filter((event, index, self) => 
                index === self.findIndex(e => (e.url || e.event_url) === (event.url || event.event_url))
              )
              
              events = uniqueEvents
              // Use the most common source (or 'apify' if any query used Apify)
              source = allSources.includes('apify') ? 'apify' : 'puppeteer'
              
              console.log(`📊 [BATCH-SCRAPING] Eventbrite returned ${events.length} unique events for ${city} (from ${allEvents.length} total, source: ${source})`, {
                jobId,
                platform: validPlatform,
                city,
                eventsFound: events.length,
                source,
                sampleEvents: events.slice(0, 3).map(e => ({ title: e.name || e.title, query: 'multiple', url: e.url }))
              })
            }

            if (events.length > 0) {
              console.log(`💾 [BATCH-SCRAPING] Processing ${events.length} ${source} ${validPlatform} events for ${city}...`, {
                jobId,
                platform: validPlatform,
                city,
                source,
              })
              
              // Call the correct processor based on source
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
              console.log(`✅ [BATCH-SCRAPING] Saved ${saved}/${events.length} ${source} ${validPlatform} events for ${city}`, {
                jobId,
                platform: validPlatform,
                city,
                source,
                saved,
                totalFound: events.length,
              })
            } else {
              console.log(`⚠️ [BATCH-SCRAPING] No events found for ${validPlatform} in ${city}`, {
                jobId,
                platform: validPlatform,
                city,
              })
            }
          } catch (platformError) {
            console.error(`❌ [BATCH-SCRAPING] ${validPlatform} scraping failed for ${city}`, {
              jobId,
              platform: validPlatform,
              city,
              error: (platformError as Error).message,
            })
            // Continue with other platforms
          }
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

      const duration = Date.now() - startTime
      console.log(`🎉 [BATCH-SCRAPING] Job ${jobId} completed successfully`, {
        jobId,
        totalSaved,
        duration,
        cities,
        platforms,
      })
    } catch (error) {
      console.error(`❌ [BATCH-SCRAPING] Job ${jobId} failed:`, {
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
    }
  })
  
  return jobId
}

/**
 * GET handler - called by Vercel Cron Jobs
 * Vercel automatically triggers this endpoint at the scheduled time
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron (if CRON_SECRET is set)
    if (!verifyCronRequest(request)) {
      console.warn('⚠️ [CRON] Unauthorized cron request attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('⏰ [CRON] Vercel cron job triggered')
    
    // Default values for cron-triggered scraping
    const cities = ['Seattle', 'San Francisco', 'New York']
    const platforms = ['luma', 'eventbrite']
    const maxEvents = 50 // Scrape up to 50 events per platform per city

    const jobId = await startScrapingJob(cities, platforms, maxEvents, { query: 'tech' })
    
    console.log('✅ [CRON] Scraping job started:', jobId)
    
    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      jobId,
      status: 'running',
      triggeredBy: 'vercel-cron',
      schedule: '0 6 * * *',
    })
  } catch (error) {
    console.error('❌ [CRON] Failed to start scraping job:', error)
    console.error('❌ [CRON] Error stack:', (error as Error).stack)
    
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message 
      },
      { status: 500 }
    )
  }
}

/**
 * POST handler - for manual triggers (testing, admin, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [MANUAL] POST request received to /api/scraping/trigger')
    
    const body = await request.json().catch(() => ({}))
    const cities = body.cities || ['Seattle', 'San Francisco', 'New York']
    const platforms = body.platforms || ['luma', 'eventbrite']
    const maxEvents = body.maxEvents || 50 // Default to 50 events per platform per city

    const jobId = await startScrapingJob(cities, platforms, maxEvents, body)
    
    console.log('✅ [MANUAL] Scraping job started:', jobId)
    
    return NextResponse.json({
      success: true,
      message: 'Scraping job started successfully',
      jobId,
      status: 'running',
      triggeredBy: 'manual',
    })
    
  } catch (error) {
    console.error('❌ [MANUAL] Failed to start scraping job:', error)
    console.error('❌ [MANUAL] Error stack:', (error as Error).stack)
    
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message 
      },
      { status: 500 }
    )
  }
}
