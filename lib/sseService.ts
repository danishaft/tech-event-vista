import { searchService, SearchFilters } from './searchService'
import { scrapeLumaEvents, scrapeEventbriteEvents, scrapeLumaEventsStreaming, scrapeEventbriteEventsStreaming, processAndSaveEvents } from './scrapingService'
import { prisma } from './prisma'

export interface SSEEvent {
  type: 'event' | 'platform_status' | 'search_complete' | 'error'
  data: any
  timestamp: string
}

export interface PlatformStatus {
  platform: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  eventsFound: number
  error?: string
}

/**
 * Server-Sent Events service for real-time search results
 * Implements proper SSE streaming with error handling and reconnection support
 */
export class SSEService {
  private readonly MAX_STREAM_DURATION_MS = 60000 // 60 seconds max stream (increased for better results)
  private readonly HEARTBEAT_INTERVAL_MS = 10000 // 10 seconds heartbeat
  private readonly MAX_EVENTS_PER_STREAM = 100
  private readonly LIVE_SCRAPING_TIMEOUT_MS = 30000 // 30 seconds timeout for live scraping (increased)

  /**
   * Stream search results with database-first approach and live scraping fallback
   * @param query - Search query
   * @param filters - Search filters
   * @param platforms - Platforms to scrape if no DB results
   * @returns Async generator for SSE events
   */
  async* streamSearchResults(
    query: string,
    filters: SearchFilters = {},
    platforms: string[] = ['luma', 'eventbrite']
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now()
    let eventCount = 0
    const searchId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      // 1. Check database first
      console.log(`🔍 [${searchId}] Starting search for query: "${query}"`, {
        query,
        filters,
        platforms,
        timestamp: new Date().toISOString(),
        searchId
      })
      
      let dbResults
      try {
        dbResults = await searchService.searchDatabase(query, filters, 50)
      } catch (error: any) {
        console.error(`❌ [${searchId}] Database search failed, falling back to live scraping`, {
          searchId,
          query,
          error: error.message
        })
        // Fall through to live scraping if database search fails
        dbResults = { events: [], total: 0, source: 'database' as const }
      }
            
            console.log(`🔍 [${searchId}] Database search results`, {
              searchId,
              query,
              filters,
              eventsFound: dbResults.events.length,
              source: dbResults.source,
              timestamp: new Date().toISOString()
            })
            
            if (dbResults.events.length > 0) {
        console.log(`✅ [${searchId}] Found ${dbResults.events.length} database results`, {
          searchId,
          eventCount: dbResults.events.length,
          source: dbResults.source,
          duration: Date.now() - startTime,
          platforms: dbResults.events.map(e => e.sourcePlatform)
        })
        
        // Stream database results immediately
        for (const event of dbResults.events) {
          if (eventCount >= this.MAX_EVENTS_PER_STREAM) break
          
          console.log(`📤 [${searchId}] Streaming database event: ${event.title}`, {
            searchId,
            eventId: event.id,
            platform: event.sourcePlatform,
            eventCount: eventCount + 1
          })
          
          yield this.formatSSEEvent('event', {
            event,
            source: 'database',
            platform: event.sourcePlatform,
          })
          eventCount++
        }

        // Stream completion
        console.log(`🎉 [${searchId}] Database search completed`, {
          searchId,
          totalEvents: eventCount,
          source: 'database',
          duration: Date.now() - startTime,
          cached: dbResults.source === 'cache'
        })
        
        yield this.formatSSEEvent('search_complete', {
          totalEvents: eventCount,
          source: 'database',
          cached: dbResults.source === 'cache',
        })

        return
      }

      // 2. No database results - start live scraping with timeout
      console.log(`🚀 [${searchId}] No database results found, starting live scraping with timeout`, {
        searchId,
        query,
        platforms,
        city: filters.city || 'San Francisco',
        duration: Date.now() - startTime,
        timeout: this.LIVE_SCRAPING_TIMEOUT_MS
      })
      
      // Use AbortController for timeout (Web Standard API)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.log(`⏰ [${searchId}] Live scraping timeout reached, aborting`, {
          searchId,
          timeout: this.LIVE_SCRAPING_TIMEOUT_MS
        })
        controller.abort()
      }, this.LIVE_SCRAPING_TIMEOUT_MS)

      try {
      const jobId = await this.startLiveScraping(query, platforms, filters.city || 'San Francisco')
      
      console.log(`📋 [${searchId}] Live scraping job started`, {
        searchId,
        jobId,
        query,
        platforms,
        city: filters.city || 'San Francisco'
      })
      
        // Stream live scraping results with timeout
        // Track events from streaming
        let liveEventCount = 0
        for await (const sseEvent of this.streamLiveScrapingResults(jobId, platforms, startTime, searchId, controller.signal)) {
          yield sseEvent
          // Count events from the stream
          try {
            const eventData = JSON.parse(sseEvent.replace('data: ', '').trim())
            if (eventData.type === 'event') {
              liveEventCount++
            }
          } catch {
            // Not an event, continue
          }
        }
        
        eventCount += liveEventCount
        clearTimeout(timeoutId)
      } catch (error) {
        clearTimeout(timeoutId)
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`⏰ [${searchId}] Live scraping timed out, returning partial results`, {
            searchId,
            timeout: this.LIVE_SCRAPING_TIMEOUT_MS,
            eventCount
          })
          
          // Return timeout event
          yield this.formatSSEEvent('search_complete', {
            totalEvents: eventCount,
            source: 'live_scraping',
            timeout: true,
            message: 'Search timed out - partial results only',
          })
          return
        }
        
        throw error
      }
      
    } catch (error) {
      console.error(`❌ [${searchId}] Search streaming error:`, {
        searchId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration: Date.now() - startTime,
        query,
        platforms
      })
      yield this.formatSSEEvent('error', {
        message: 'Search failed',
        error: (error as Error).message,
      })
    }
  }

  /**
   * Stream live scraping results as they become available
   * @param jobId - Scraping job ID
   * @param platforms - Platforms being scraped
   * @param startTime - Stream start time
   * @returns Async generator for SSE events
   */
  private async* streamLiveScrapingResults(
    jobId: string,
    platforms: string[],
    startTime: number,
    searchId: string,
    abortSignal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    console.log(`🚀 [${searchId}] Starting streamLiveScrapingResults`, {
      searchId,
      jobId,
      platforms,
      startTime,
      timestamp: new Date().toISOString()
    })
    
    let eventCount = 0
    let lastEventId: string | undefined
    const platformStatus: Record<string, PlatformStatus> = {}
    
    // Initialize platform status
    for (const platform of platforms) {
      platformStatus[platform] = {
        platform,
        status: 'pending',
        eventsFound: 0,
      }
    }

    console.log(`📊 [${searchId}] Initializing platform status`, {
      searchId,
      jobId,
      platforms,
      platformStatus: Object.values(platformStatus)
    })

    // Stream initial platform status
    yield this.formatSSEEvent('platform_status', {
      platforms: Object.values(platformStatus),
    })

    // Poll for results with timeout
    const pollInterval = 2000 // 2 seconds
    const maxPollTime = this.MAX_STREAM_DURATION_MS
    let pollCount = 0
    
    console.log(`⏰ [${searchId}] Starting polling loop`, {
      searchId,
      jobId,
      pollInterval,
      maxPollTime,
      platforms
    })
    
    while (Date.now() - startTime < maxPollTime) {
      // Check for abort signal (timeout)
      if (abortSignal?.aborted) {
        console.log(`⏰ [${searchId}] Abort signal received, stopping polling`, {
          searchId,
          jobId,
          pollCount
        })
        break
      }
      
      try {
        pollCount++
        console.log(`🔄 [${searchId}] Polling attempt ${pollCount}`, {
          searchId,
          jobId,
          pollCount,
          elapsed: Date.now() - startTime,
          maxPollTime
        })
        
        // Check job status
        const job = await this.getJobStatus(jobId)
        
        console.log(`🔍 [${searchId}] Job status check`, {
          searchId,
          jobId,
          pollCount,
          jobStatus: job?.status,
          jobExists: !!job
        })
        
        if (!job) {
          console.error(`❌ [${searchId}] Scraping job not found`, {
            searchId,
            jobId,
            pollCount
          })
          yield this.formatSSEEvent('error', {
            message: 'Scraping job not found',
            jobId,
          })
          break
        }

        // Get new events
        const newEvents = await this.getJobEvents(jobId, lastEventId)
        
        console.log(`📥 [${searchId}] Retrieved ${newEvents.length} new events`, {
          searchId,
          jobId,
          pollCount,
          newEventsCount: newEvents.length,
          lastEventId,
          totalEventCount: eventCount
        })
        
        // Stream new events
        for (const event of newEvents) {
          if (eventCount >= this.MAX_EVENTS_PER_STREAM) break
          
          console.log(`📤 [${searchId}] Streaming live event: ${event.title}`, {
            searchId,
            eventId: event.id,
            platform: event.sourcePlatform,
            eventCount: eventCount + 1,
            pollCount
          })
          
          yield this.formatSSEEvent('event', {
            event,
            source: 'live_scraping',
            platform: event.sourcePlatform,
          })
          eventCount++
          lastEventId = event.id // Track last event sent

          // Update platform status
          if (platformStatus[event.sourcePlatform]) {
            platformStatus[event.sourcePlatform].eventsFound++
            platformStatus[event.sourcePlatform].status = 'completed'
          }
        }

        // Stream updated platform status
        yield this.formatSSEEvent('platform_status', {
          platforms: Object.values(platformStatus),
        })

        // Check if job is complete
        if (job.status === 'completed' || job.status === 'failed') {
          console.log(`🏁 [${searchId}] Job completed with status: ${job.status}`, {
            searchId,
            jobId,
            jobStatus: job.status,
            totalEvents: eventCount,
            platformsScraped: platforms.length,
            duration: Date.now() - startTime,
            pollCount
          })
          
          yield this.formatSSEEvent('search_complete', {
            totalEvents: eventCount,
            source: 'live_scraping',
            jobStatus: job.status,
            platformsScraped: platforms.length,
          })
          break
        }

        // Wait before next poll
        await this.delay(pollInterval)
        
      } catch (error) {
        console.error(`❌ [${searchId}] Live scraping stream error:`, {
          searchId,
          jobId,
          pollCount,
          error: (error as Error).message,
          stack: (error as Error).stack,
          duration: Date.now() - startTime
        })
        yield this.formatSSEEvent('error', {
          message: 'Live scraping failed',
          error: (error as Error).message,
        })
        break
      }
    }

    // Stream timeout if max duration reached
    if (Date.now() - startTime >= maxPollTime) {
      console.warn(`⏰ [${searchId}] Search timeout reached`, {
        searchId,
        jobId,
        pollCount,
        duration: Date.now() - startTime,
        maxPollTime,
        totalEvents: eventCount
      })
      
      yield this.formatSSEEvent('search_complete', {
        totalEvents: eventCount,
        source: 'live_scraping',
        timeout: true,
        message: 'Search timeout reached',
      })
    }
  }

  /**
   * Format SSE event with proper structure
   * @param type - Event type
   * @param data - Event data
   * @returns Formatted SSE event string
   */
  formatSSEEvent(type: string, data: any): string {
    try {
      const event: SSEEvent = {
        type: type as any,
        data,
        timestamp: new Date().toISOString(),
      }
      const jsonString = JSON.stringify(event)
      // Ensure proper SSE format: "data: {json}\n\n"
      return `data: ${jsonString}\n\n`
    } catch (error) {
      console.error('❌ [SSE] Failed to format SSE event:', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
        dataType: typeof data
      })
      // Return error event instead
      return `data: ${JSON.stringify({
        type: 'error',
        data: { message: 'Failed to format event', error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString()
      })}\n\n`
    }
  }

  /**
   * Stream heartbeat to keep connection alive
   * @returns Async generator for heartbeat events
   */
  async* streamHeartbeat(): AsyncGenerator<string, void, unknown> {
    while (true) {
      yield `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`
      await this.delay(this.HEARTBEAT_INTERVAL_MS)
    }
  }

  /**
   * Stream error event
   * @param message - Error message
   * @param error - Error details
   * @returns Formatted SSE error event
   */
  streamError(message: string, error?: string): string {
    return this.formatSSEEvent('error', {
      message,
      error,
    })
  }

  /**
   * Start live scraping using existing scrapingService functions
   * @param query - Search query
   * @param platforms - Platforms to scrape
   * @param city - City to search in
   * @returns Scraping job ID
   */
  private async startLiveScraping(query: string, platforms: string[], city: string): Promise<string> {
    try {
      // Create scraping job record
      const jobId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const job = await prisma.scrapingJob.create({
        data: {
          id: jobId,
          platform: 'multi',
          status: 'queued',
          query,
          city,
          platforms,
          startedAt: new Date(),
          eventsScraped: 0,
        },
      })

      console.log(`🚀 [LIVE-SCRAPING] Job created: ${job.id}`, {
        jobId: job.id,
        query,
        platforms,
        city,
        status: job.status,
        timestamp: new Date().toISOString()
      })

      // Process scraping directly (no BullMQ worker - direct processing for search)
      // This ensures immediate results for search queries
      console.log(`✅ [LIVE-SCRAPING] Starting direct scraping for search: ${job.id}`)
      
      // Update job status to running
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: { status: 'running' },
      })
      
      // Run scraping in background (non-blocking)
      // Don't await - let it run while we return job ID immediately
      this.executeScrapingJob(job.id, query, platforms, city).catch((error) => {
        console.error(`❌ [LIVE-SCRAPING] Background scraping failed: ${job.id}`, error)
      })

      return job.id
    } catch (error) {
      console.error('❌ [LIVE-SCRAPING] Failed to start live scraping:', {
        query,
        platforms,
        city,
        error: (error as Error).message,
        stack: (error as Error).stack
      })
      throw new Error('Failed to start live scraping')
    }
  }

  /**
   * Execute scraping job in background - continues even if user disconnects
   * @param jobId - Scraping job ID
   * @param query - Search query
   * @param platforms - Platforms to scrape
   * @param city - City to search in
   */
  private async executeScrapingJob(
    jobId: string,
    query: string,
    platforms: string[],
    city: string
  ): Promise<void> {
    let totalSaved = 0
    const startTime = Date.now()

    console.log(`🔄 [LIVE-SCRAPING] Starting execution for job: ${jobId}`, {
      jobId,
      query,
      platforms,
      city,
      timestamp: new Date().toISOString()
    })

    try {
      for (const platform of platforms) {
        const platformStartTime = Date.now()
        let events: any[] = []
        let saved = 0

        console.log(`🎯 [LIVE-SCRAPING] Starting ${platform} scraping`, {
          jobId,
          platform,
          query,
          city,
          timestamp: new Date().toISOString()
        })

        if (platform === 'luma') {
          // Use streaming scrapeLumaEvents function for real-time results
          console.log(`🔍 [LIVE-SCRAPING] Starting streaming scrapeLumaEvents for job: ${jobId}`)
          const streamingEvents: any[] = []
          
          for await (const event of scrapeLumaEventsStreaming(query, 20)) {
            streamingEvents.push(event)
            console.log(`📦 [LIVE-SCRAPING] Luma streaming event: ${event.title || 'Unknown'} for job: ${jobId}`)
            
            // Process and save each event immediately
            const eventSaved = await processAndSaveEvents([event], 'luma', city)
            console.log(`💾 [LIVE-SCRAPING] Saved Luma event: ${event.title || 'Unknown'} for job: ${jobId}`)
            saved += eventSaved
          }
          
          events = streamingEvents
          console.log(`📊 [LIVE-SCRAPING] scrapeLumaEventsStreaming completed with ${events.length} events for job: ${jobId}`)
        } else if (platform === 'eventbrite') {
          // Use streaming scrapeEventbriteEvents function for real-time results
          console.log(`🔍 [LIVE-SCRAPING] Starting streaming scrapeEventbriteEvents for job: ${jobId}`)
          const streamingEvents: any[] = []
          
          console.log(`🔍 [LIVE-SCRAPING] About to iterate over scrapeEventbriteEventsStreaming generator for job: ${jobId}`)
          let eventCount = 0
          try {
            console.log(`🔍 [LIVE-SCRAPING] Calling scrapeEventbriteEventsStreaming(${city}, ${query}) for job: ${jobId}`)
            const generator = scrapeEventbriteEventsStreaming(city, query)
            console.log(`🔍 [LIVE-SCRAPING] Generator created, starting iteration for job: ${jobId}`)
            for await (const event of generator) {
              eventCount++
              console.log(`🔍 [LIVE-SCRAPING] Received event ${eventCount} from generator for job: ${jobId}`)
              streamingEvents.push(event)
              console.log(`📦 [LIVE-SCRAPING] Eventbrite streaming event: ${event.title || 'Unknown'} for job: ${jobId}`)
              
              // Process and save each event immediately
              const eventSaved = await processAndSaveEvents([event], 'eventbrite', city)
              console.log(`💾 [LIVE-SCRAPING] Saved Eventbrite event: ${event.title || 'Unknown'} for job: ${jobId}`)
              saved += eventSaved
            }
            
            console.log(`🔍 [LIVE-SCRAPING] Generator iteration completed. Total events received: ${eventCount} for job: ${jobId}`)
          } catch (generatorError) {
            console.error(`❌ [LIVE-SCRAPING] Generator iteration failed for job: ${jobId}`, {
              error: generatorError instanceof Error ? generatorError.message : String(generatorError),
              stack: generatorError instanceof Error ? generatorError.stack : undefined,
              city,
              query,
              eventCount
            })
            throw generatorError
          }
          events = streamingEvents
          console.log(`📊 [LIVE-SCRAPING] scrapeEventbriteEventsStreaming completed with ${events.length} events for job: ${jobId}`)
        } else {
          console.warn(`⚠️ [LIVE-SCRAPING] Unknown platform: ${platform} for job: ${jobId}`)
        }

        totalSaved += saved
        const platformDuration = Date.now() - platformStartTime
        
        console.log(`✅ [LIVE-SCRAPING] ${platform} scraping completed`, {
          jobId,
          platform,
          eventsFound: events.length,
          eventsSaved: saved,
          duration: platformDuration,
          query,
          city
        })
      }

      // Update job status
      await prisma.scrapingJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          eventsScraped: totalSaved,
        },
      })

      const totalDuration = Date.now() - startTime
      console.log(`🎉 [LIVE-SCRAPING] Job ${jobId} completed successfully`, {
        jobId,
        totalEventsSaved: totalSaved,
        platforms,
        query,
        city,
        duration: totalDuration,
        timestamp: new Date().toISOString()
      })
    } catch (error: any) {
      const totalDuration = Date.now() - startTime
      console.error(`❌ [LIVE-SCRAPING] Job ${jobId} failed:`, {
        jobId,
        error: error.message,
        stack: error.stack,
        platforms,
        query,
        city,
        duration: totalDuration,
        timestamp: new Date().toISOString()
      })
      
      // Update job status with error
      await prisma.scrapingJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message,
        },
      })
    }
  }

  /**
   * Get scraping job status
   * @param jobId - Scraping job ID
   * @returns Job status or null if not found
   */
  private async getJobStatus(jobId: string): Promise<any | null> {
    try {
      const job = await prisma.scrapingJob.findUnique({
        where: { id: jobId },
      })

      if (!job) return null

      return {
        id: job.id,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        eventsScraped: job.eventsScraped,
        errorMessage: job.errorMessage,
      }
    } catch (error) {
      console.error(`Failed to get job status for ${jobId}:`, error)
      return null
    }
  }

  /**
   * Get events scraped by a job
   * @param jobId - Scraping job ID
   * @param lastEventId - ID of last event sent to client
   * @returns Events scraped by the job
   */
  private async getJobEvents(jobId: string, lastEventId?: string): Promise<any[]> {
    try {
      const job = await prisma.scrapingJob.findUnique({
        where: { id: jobId },
      })

      if (!job) {
        return []
      }

      // Get events scraped after job start time
      // Filter by city and query if available to match job scope
      const whereClause: any = {
        scrapedAt: {
          gte: job.startedAt || new Date(Date.now() - 60000), // Fallback to 1 minute ago if no start time
        },
      }

      // Filter by city if job has city (but don't filter if it's the default)
      // The default "San Francisco" is used when no city is specified in search
      if (job.city && job.city !== 'all') {
        // Handle comma-separated cities
        const cities = job.city.split(',').map(c => c.trim())
        if (cities.length === 1) {
          whereClause.city = cities[0]
        } else {
          whereClause.city = { in: cities }
        }
      }

      // Filter by platforms if job has platforms
      if (job.platforms && job.platforms.length > 0) {
        whereClause.sourcePlatform = { in: job.platforms }
      }

      // Only get events after the last one sent to client
      if (lastEventId) {
        whereClause.id = { gt: lastEventId }
      }

      const events = await prisma.event.findMany({
        where: whereClause,
        orderBy: {
          scrapedAt: 'desc',
        },
        take: 50, // Limit to prevent memory issues
      })

      console.log(`🔍 [getJobEvents] Found ${events.length} events for job ${jobId}`, {
        jobId,
        jobCity: job.city,
        jobPlatforms: job.platforms,
        jobQuery: job.query,
        eventsFound: events.length,
        whereClause: JSON.stringify(whereClause),
      })

      return events
    } catch (error) {
      console.error(`❌ [getJobEvents] Failed to get job events for ${jobId}:`, error)
      return []
    }
  }

  /**
   * Utility function to add delay
   * @param ms - Delay in milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const sseService = new SSEService()
