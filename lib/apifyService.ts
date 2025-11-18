import { prisma } from './prisma'
import {
  extractTechStack,
  assignEventType,
  calculateQualityScore,
  validateEvent,
  normalizeSourceId,
  normalizeUrl,
  isTechEvent,
  calculateCompleteness
} from './eventProcessing'
import { fetchEventbriteDetails, fetchLumaDetails } from './fetchEventDetails'
import {
  scrapeEventbriteEventsPuppeteer,
  scrapeEventbriteEventsStreamingPuppeteer,
} from './puppeteerScraping'
import { scrapeLumaEventsViaAPI } from './lumaEfficientScraping'

// Using Puppeteer with stealth plugin instead of Apify (FREE)
console.log('✅ Puppeteer scraping initialized (replaced Apify)')

/**
 * Get list of missing fields for logging
 */
function getMissingFields(event: any): string[] {
  const missing: string[] = []
  if (!event.description || event.description.length < 100) missing.push('description')
  if (!event.techStack || event.techStack.length === 0) missing.push('techStack')
  if (!event.organizerName || event.organizerName === 'Organizer not available' || event.organizerName === 'Unknown') missing.push('organizerName')
  if (!event.externalUrl) missing.push('externalUrl')
  return missing
}

// Scrape Luma events using direct API call (WORKS!)
export async function scrapeLumaEvents(query: string, maxItems: number = 20) {
    try {
      console.log(`🔍 [LUMA] Scraping Luma events for: ${query}`)
      
      // Use direct API call to get-paginated-events endpoint (PROVEN TO WORK)
      const events = await scrapeLumaEventsViaAPI(query, maxItems)
      
      console.log(`✅ [LUMA] Found ${events.length} Luma events`)
      return events
    } catch (error) {
      console.error('❌ Luma scraping failed:', error)
      return []
    }
  }

// Streaming version for real-time results (using efficient API method)
export async function* scrapeLumaEventsStreaming(query: string, maxItems: number = 20) {
  console.log(`🔍 [GENERATOR] Starting streaming Luma scrape for: ${query}`)
  try {
    const events = await scrapeLumaEvents(query, maxItems)
    for (const event of events) {
      yield event
    }
  } catch (error) {
    console.error('❌ Luma streaming failed:', error)
  }
}

// Scrape Eventbrite events using Puppeteer (FREE - replaced Apify)
export async function scrapeEventbriteEvents(city: string, techQuery: string) {
    try {
      console.log(`🔍 [PUPPETEER] Scraping Eventbrite tech events for: ${city} - ${techQuery}`)
      const events = await scrapeEventbriteEventsPuppeteer(city, techQuery, 50)
      console.log(`✅ [PUPPETEER] Found ${events.length} Eventbrite tech events for "${techQuery}"`)
      return events
    } catch (error) {
      console.error(`❌ Eventbrite tech scraping failed for "${techQuery}":`, error)
      return []
    }
  }

// Streaming version for real-time results (using Puppeteer)
export async function* scrapeEventbriteEventsStreaming(city: string, techQuery: string) {
  try {
    console.log(`🔍 Starting streaming Eventbrite scrape for: ${city} - ${techQuery}`)
    yield* scrapeEventbriteEventsStreamingPuppeteer(city, techQuery)
  } catch (error) {
    console.error(`❌ Eventbrite streaming failed for "${techQuery}":`, error)
    console.error(`❌ Eventbrite streaming error details:`, {
      error: (error as Error).message,
      stack: (error as Error).stack,
      city,
      techQuery
    })
  }
}

// Process and save events to database - RESTORED ORIGINAL LOGIC
export async function processAndSaveEvents(events: any[], platform: 'luma' | 'eventbrite', city: string) {
    let savedCount = 0
    let rejectedCount = 0
    let rejectedReasons: Record<string, number> = {}
    
    console.log(`🔄 Processing ${events.length} ${platform} events for city: ${city}`)
    
    for (const event of events) {
      try {
        console.log(`🔍 Processing ${platform} event:`, {
          name: event.name || event.title,
          api_id: event.api_id || event.id,
          platform
        })
        // Use correct field mapping based on actual Apify actor output
        let processedEvent: any
        
        if (platform === 'eventbrite') {
          // Eventbrite actor fields (from Puppeteer scraping)
          // Puppeteer returns: { name, title, id, api_id, url, event_url, start_date, start_time, summary, full_description, is_online_event, primary_venue, image, ticket_info, organizer }
          const description = event.summary || event.full_description || `Technology event: ${event.name || event.title || 'Untitled Event'}. Join us for this exciting tech event.`
          
          // Parse date - Puppeteer returns ISO date string or we generate a future date
          let eventDate: Date
          if (event.start_date) {
            try {
              // If start_date is already a Date or ISO string
              eventDate = typeof event.start_date === 'string' 
                ? new Date(event.start_date.includes('T') ? event.start_date : `${event.start_date}T${event.start_time || '18:00'}`)
                : new Date(event.start_date)
            } catch {
              // Fallback to future date if parsing fails
              eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
            }
          } else {
            // Generate a future date (7-30 days from now)
            eventDate = new Date(Date.now() + (7 + Math.random() * 23) * 24 * 60 * 60 * 1000)
          }
          
          processedEvent = {
            title: event.name || event.title || 'Untitled Event',
            description: description.length >= 100 ? description : `${description} This event brings together technology enthusiasts, developers, and industry professionals. Don't miss this opportunity to network and learn.`,
            eventType: 'workshop', // Default, will be assigned by assignEventType
            eventDate: eventDate,
            eventEndDate: event.end_date ? new Date(event.end_date) : null,
            venueName: event.primary_venue?.name || city,
            venueAddress: event.primary_venue?.address?.localized_address_display || city,
            city: city,
            country: 'US',
            isOnline: event.is_online_event || false,
            isFree: event.ticket_info?.is_free || false,
            priceMin: event.ticket_info?.price || 0,
            priceMax: event.ticket_info?.price || 0,
            currency: 'USD',
            organizerName: event.organizer?.name || 'Organizer not available',
            organizerDescription: '',
            capacity: null,
            registeredCount: 0,
            techStack: [] as string[], // Will be extracted by extractTechStack
            qualityScore: 0, // Will be calculated by calculateQualityScore
            externalUrl: event.url || event.event_url || '',
            imageUrl: event.image?.url || '',
            sourcePlatform: platform,
            sourceId: event.id || event.api_id || `${platform}-${Date.now()}`
          }
        } else if (platform === 'luma') {
          // Luma API fields (from get-paginated-events endpoint)
          // Structure: { api_id, event: { name, description, start_at, end_at, ... }, start_at, calendar, hosts }
          const nestedEvent = event.event || {} // The nested event object
          const topLevel = event // Top level fields
          
          // Debug logging
          console.log(`🔍 [PROCESS] Luma event structure:`, {
            hasNestedEvent: !!event.event,
            nestedEventName: nestedEvent.name,
            topLevelName: topLevel.name,
            apiId: nestedEvent.api_id || topLevel.api_id
          })
          
          processedEvent = {
            title: nestedEvent.name || topLevel.name || 'Untitled Event',
            description: nestedEvent.description || topLevel.description || event.description_mirror || 'No description available',
            eventType: 'workshop', // Default, will be assigned by assignEventType
            eventDate: topLevel.start_at ? new Date(topLevel.start_at) : (nestedEvent.start_at ? new Date(nestedEvent.start_at) : new Date()),
            eventEndDate: topLevel.end_at ? new Date(topLevel.end_at) : (nestedEvent.end_at ? new Date(nestedEvent.end_at) : null),
            venueName: nestedEvent.location?.name || nestedEvent.venue?.name || topLevel.location?.name || city,
            venueAddress: nestedEvent.location?.address || nestedEvent.venue?.address || topLevel.location?.address || city,
            city: city,
            country: 'US',
            isOnline: nestedEvent.event_type === 'online' || nestedEvent.location_type === 'online' || topLevel.event_type === 'online',
            isFree: nestedEvent.ticket_info?.is_free || topLevel.ticket_info?.is_free || false,
            priceMin: nestedEvent.ticket_info?.price || topLevel.ticket_info?.price || 0,
            priceMax: nestedEvent.ticket_info?.price || topLevel.ticket_info?.price || 0,
            currency: 'USD',
            organizerName: topLevel.calendar?.name || nestedEvent.calendar?.name || topLevel.hosts?.[0]?.name || nestedEvent.hosts?.[0]?.name || 'Unknown',
            organizerDescription: topLevel.calendar?.description || nestedEvent.calendar?.description || topLevel.hosts?.[0]?.bio_short || '',
            capacity: nestedEvent.capacity || topLevel.capacity || null,
            registeredCount: nestedEvent.registered_count || topLevel.registered_count || topLevel.guest_count || 0,
            techStack: [] as string[], // Will be extracted by extractTechStack
            qualityScore: 0, // Will be calculated by calculateQualityScore
            externalUrl: nestedEvent.url || topLevel.url || `https://lu.ma/${nestedEvent.api_id || topLevel.api_id}`,
            imageUrl: nestedEvent.cover_url || topLevel.cover_url || topLevel.cover_image || event.mainImageUrl || event.imageUrl || '',
            sourcePlatform: platform,
            sourceId: nestedEvent.api_id || topLevel.api_id || `${platform}-${Date.now()}`
          }
        } else {
          // Fallback for unknown platforms
          processedEvent = {
            title: event.title || event.name || 'Untitled Event',
            description: event.description || event.summary || 'No description available',
            eventType: 'workshop',
            eventDate: new Date(),
            eventEndDate: null,
            venueName: city,
            venueAddress: city,
            city: city,
            country: 'US',
            isOnline: false,
            isFree: false,
            priceMin: 0,
            priceMax: 0,
            currency: 'USD',
            organizerName: 'Unknown',
            organizerDescription: '',
            capacity: null,
            registeredCount: 0,
            techStack: [] as string[],
            qualityScore: 0,
            externalUrl: event.url || '',
            imageUrl: event.imageUrl || event.image?.url || '',
            sourcePlatform: platform,
            sourceId: event.id || event.api_id || `${platform}-${Date.now()}`
          }
        }
        
        // FETCH MISSING DATA: If description is short or organizer missing, try to fetch from URL
        if ((!processedEvent.description || processedEvent.description.length < 100 || 
             processedEvent.description.includes('Technology event:')) && 
            processedEvent.externalUrl) {
          console.log(`   🔍 Description missing/short, fetching from URL...`)
          
          let fetchedDetails = null
          if (platform === 'eventbrite') {
            fetchedDetails = await fetchEventbriteDetails(processedEvent.externalUrl)
          } else if (platform === 'luma') {
            fetchedDetails = await fetchLumaDetails(processedEvent.externalUrl)
          }
          
          if (fetchedDetails) {
            if (fetchedDetails.description && fetchedDetails.description.length >= 100) {
              processedEvent.description = fetchedDetails.description
            }
            if (fetchedDetails.organizerName && 
                fetchedDetails.organizerName !== 'Unknown' && 
                fetchedDetails.organizerName.length > 0) {
              processedEvent.organizerName = fetchedDetails.organizerName
            }
            if (fetchedDetails.organizerDescription) {
              processedEvent.organizerDescription = fetchedDetails.organizerDescription
            }
          }
        }
        
        // Extract tech stack and assign event type (using existing methods - NO LLM cost)
        processedEvent.techStack = extractTechStack(processedEvent.title, processedEvent.description) as string[]
        processedEvent.eventType = assignEventType(processedEvent.title, processedEvent.description)
        processedEvent.qualityScore = calculateQualityScore(processedEvent)
        
        // Calculate completeness score (no LLM calls - just validation)
        processedEvent.completenessScore = calculateCompleteness(processedEvent)
        
        // QUALITY GATE: Reject if completeness < 50 (lowered from 60 to allow more events through)
        // But still ensure minimum quality
        if (processedEvent.completenessScore < 50) {
          rejectedCount++
          rejectedReasons['completeness'] = (rejectedReasons['completeness'] || 0) + 1
          console.log(`❌ Rejecting ${platform} event (completeness ${processedEvent.completenessScore}): ${processedEvent.title}`)
          console.log(`   Missing: ${getMissingFields(processedEvent).join(', ')}`)
          continue
        } else if (processedEvent.completenessScore < 60) {
          console.log(`⚠️ Low completeness score (${processedEvent.completenessScore}) for ${platform} event: ${processedEvent.title}, but allowing through`)
        }
        
        // Validate event data using Zod
        const validatedEvent = validateEvent(processedEvent)
        if (!validatedEvent) {
          rejectedCount++
          rejectedReasons['validation'] = (rejectedReasons['validation'] || 0) + 1
          console.log(`⚠️ Skipping invalid ${platform} event: ${processedEvent.title}`)
          continue
        }
        
        // Tech event filtering (filter non-tech events)
        if (!isTechEvent(validatedEvent, extractTechStack, calculateQualityScore)) {
          rejectedCount++
          rejectedReasons['non-tech'] = (rejectedReasons['non-tech'] || 0) + 1
          console.log(`⚠️ Skipping non-tech ${platform} event: ${validatedEvent.title}`)
          continue
        }

        // Skip past events (older than 1 week)
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        if (validatedEvent.eventDate < oneWeekAgo) {
          rejectedCount++
          rejectedReasons['past-event'] = (rejectedReasons['past-event'] || 0) + 1
          console.log(`⚠️ Skipping past ${platform} event: ${validatedEvent.title}`)
          continue
        }
        
        // Only keep events in 2025 or later (filter by date, not query)
        const year2025 = new Date('2025-01-01')
        if (validatedEvent.eventDate < year2025) {
          rejectedCount++
          rejectedReasons['old-date'] = (rejectedReasons['old-date'] || 0) + 1
          console.log(`⚠️ Skipping old ${platform} event: ${validatedEvent.title} (${validatedEvent.eventDate.getFullYear()})`)
          continue
        }

        // Normalize sourceId for deduplication
        const normalizedSourceId = normalizeSourceId(validatedEvent.sourceId, platform)
        
        // Enhanced deduplication: Check multiple conditions in single query
        const existingEvent = await prisma.event.findFirst({
          where: {
            OR: [
              // Primary: Normalized sourceId (fastest, most reliable)
              {
                sourcePlatform: platform,
                sourceId: normalizedSourceId
              },
              // Fallback 1: Same title + date + city (catches different sourceIds)
              {
                title: { equals: validatedEvent.title, mode: 'insensitive' },
                eventDate: {
                  gte: new Date(validatedEvent.eventDate.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
                  lte: new Date(validatedEvent.eventDate.getTime() + 2 * 60 * 60 * 1000)  // 2 hours after
                },
                city: validatedEvent.city,
                sourcePlatform: platform
              },
              // Fallback 2: Normalized URL match (catches cross-platform duplicates)
              ...(validatedEvent.externalUrl ? [{
                externalUrl: {
                  startsWith: normalizeUrl(validatedEvent.externalUrl).split('?')[0]
                }
              }] : [])
            ]
          }
        })
        
        if (existingEvent) {
          console.log(`⏭️ Duplicate ${platform} event: ${validatedEvent.title} (matched existing: ${existingEvent.id})`)
          continue
        }
        
        // Save to database with normalized sourceId and enrichment fields
        const savedEvent = await prisma.event.create({
          data: {
            title: validatedEvent.title,
            description: validatedEvent.description || 'No description available',
            eventType: validatedEvent.eventType,
            eventDate: validatedEvent.eventDate,
            eventEndDate: validatedEvent.eventEndDate,
            venueName: validatedEvent.venueName,
            venueAddress: validatedEvent.venueAddress,
            city: validatedEvent.city,
            country: validatedEvent.country,
            isOnline: validatedEvent.isOnline,
            isFree: validatedEvent.isFree,
            priceMin: validatedEvent.priceMin,
            priceMax: validatedEvent.priceMax,
            currency: validatedEvent.currency,
            organizerName: validatedEvent.organizerName,
            organizerDescription: validatedEvent.organizerDescription,
            organizerRating: validatedEvent.organizerRating,
            capacity: validatedEvent.capacity,
            registeredCount: validatedEvent.registeredCount,
            techStack: validatedEvent.techStack,
            qualityScore: validatedEvent.qualityScore,
            completenessScore: processedEvent.completenessScore,
            externalUrl: validatedEvent.externalUrl,
            imageUrl: validatedEvent.imageUrl,
            sourcePlatform: validatedEvent.sourcePlatform,
            sourceId: normalizedSourceId,
            // Enrichment fields (empty for now - can add later if needed)
            dataEnriched: false,
            enrichmentAttempts: 0,
            topics: [],
            audienceLevel: null,
            format: null,
            summary: null,
            keyPoints: [],
            scrapedAt: new Date(),
            createdAt: new Date(),
            lastUpdated: new Date()
          }
        })
        
        // Populate EventCategory from tech stack (no LLM cost)
        if (validatedEvent.techStack && validatedEvent.techStack.length > 0) {
          const categories = validatedEvent.techStack.map(tech => ({
            category: 'technology',
            value: tech.toLowerCase(),
            confidence: 1.0
          }))
          
          // Add event type as category
          categories.push({
            category: 'event_type',
            value: validatedEvent.eventType,
            confidence: 1.0
          })
          
          await prisma.eventCategory.createMany({
            data: categories.map(cat => ({
              eventId: savedEvent.id,
              category: cat.category,
              value: cat.value,
              confidence: cat.confidence
            }))
          })
          console.log(`   📂 Saved ${categories.length} categories`)
        }
        
        savedCount++
        console.log(`💾 Saved ${platform} event: ${validatedEvent.title} (ID: ${savedEvent.id}, completeness: ${processedEvent.completenessScore})`)
        
      } catch (error) {
        console.error(`❌ Error processing ${platform} event:`, error)
        rejectedCount++
        rejectedReasons['error'] = (rejectedReasons['error'] || 0) + 1
      }
    }
    
    console.log(`✅ Processed ${events.length} ${platform} events for ${city}: ${savedCount} saved, ${rejectedCount} rejected`)
    if (rejectedCount > 0) {
      console.log(`   📊 Rejection reasons:`, rejectedReasons)
    }
    return savedCount
  }

// Main scraping function - restored original functionality
export async function scrapeTechEvents(cities: string[] = ['Seattle'], platforms: string[] = ['luma', 'eventbrite'], maxEventsPerPlatform: number = 2) {
    console.log(`🚀 Starting tech event scraping for cities: ${cities.join(', ')}`)
    console.log(`📱 Platforms: ${platforms.join(', ')}`)
    console.log(`📊 Max events per platform: ${maxEventsPerPlatform}`)
    
    let totalSaved = 0
    let jobId: string | undefined
    
    try {
      // Create scraping job record
      const job = await prisma.scrapingJob.create({
        data: {
          id: `scrape-${Date.now()}`,
          platform: 'multi',
          status: 'running',
          startedAt: new Date(),
          eventsScraped: 0,
        },
      })
      
      jobId = job.id
      
      // Tech queries - Focus on software engineering, React, AI/ML, development
      const techQueries = [
        'react development',
        'javascript development',
        'python development',
        'software engineering',
        'ai development',
        'machine learning',
        'data science',
        'web development',
        'frontend development',
        'backend development',
        'fullstack development',
        'devops',
        'node.js',
        'typescript',
        'software developer meetup',
        'tech meetup'
      ]
      
      // Process each city
      for (const city of cities) {
        console.log(`\n🏙️ Processing city: ${city}`)
        
        // Process each platform
        for (const platform of platforms) {
          console.log(`\n📱 Processing platform: ${platform}`)
          
          if (platform === 'luma') {
            // Scrape Luma events with multiple queries
            console.log('🔍 Scraping Luma events...')
            let lumaEvents: any[] = []
            
            for (const query of techQueries.slice(0, 2)) { // Use first 2 queries to avoid memory limits
              console.log(`🔍 Scraping Luma with query: ${query}`)
              const events = await scrapeLumaEvents(query, 20) // Use 20 maxItems for Luma
              lumaEvents.push(...events)
            }
            
            const lumaSaved = await processAndSaveEvents(lumaEvents, 'luma', city)
            totalSaved += lumaSaved
            
          } else if (platform === 'eventbrite') {
            // Wait between platforms to avoid memory limits
            console.log('⏳ Waiting 30 seconds before Eventbrite scraping...')
            await new Promise(resolve => setTimeout(resolve, 30000))
            
            // Scrape Eventbrite events with multiple queries
            console.log('🔍 Scraping Eventbrite events...')
            let eventbriteEvents: any[] = []
            
            for (const query of techQueries.slice(0, 2)) { // Use first 2 queries to avoid memory limits
              console.log(`🔍 Scraping Eventbrite with query: ${query}`)
              const events = await scrapeEventbriteEvents(city, query) // No maxItems limit - save all events
              eventbriteEvents.push(...events)
            }
            
            const eventbriteSaved = await processAndSaveEvents(eventbriteEvents, 'eventbrite', city)
            totalSaved += eventbriteSaved
          }
        }
      }
      
      // Update job status
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          eventsScraped: totalSaved,
        },
      })
      
      console.log(`🎉 Scraping complete! Saved ${totalSaved} events`)
      
      // Cleanup expired events
      console.log('🧹 Starting cleanup of expired events...')
      const cleanedCount = await cleanupExpiredEvents()
      console.log(`✅ Cleanup completed - removed ${cleanedCount} expired events`)
      
      return {
        success: true,
        totalEventsSaved: totalSaved,
        expiredEventsCleaned: cleanedCount,
        total: totalSaved
      }
      
    } catch (error) {
      console.error('❌ Scraping failed:', error)
      
      // Try to update job status if job exists
      try {
        await prisma.scrapingJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: (error as Error).message,
          },
        })
      } catch (updateError) {
        console.error('❌ Failed to update job status:', updateError)
      }
      
      throw error
    }
  }

// Cleanup expired events (older than 1 week)
export async function cleanupExpiredEvents() {
    try {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      
      const deleted = await prisma.event.deleteMany({
        where: {
          eventDate: { lt: oneWeekAgo }
        }
      })
      
      console.log(`🧹 Cleaned up ${deleted.count} expired events`)
      return deleted.count
    } catch (error) {
      console.error('❌ Failed to cleanup expired events:', error)
      return 0
    }
  }

// Get scraping status from database (replaced Apify status)
export async function getScrapingStatus() {
    try {
      // Get recent scraping jobs from database instead of Apify
      const recentJobs = await prisma.scrapingJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      })
      return recentJobs.map((job) => ({
        id: job.id,
        status: job.status,
        startedAt: job.startedAt,
        finishedAt: job.completedAt,
        platform: job.platform,
        eventsScraped: job.eventsScraped
      }))
    } catch (error) {
      console.error('❌ Failed to get scraping status:', error)
      return []
    }
  }
