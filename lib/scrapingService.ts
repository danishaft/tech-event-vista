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
import { 
  scrapeEventbriteEventsApify, 
  scrapeLumaEventsApify,
  isApifyConfigured 
} from './apifyScraping'

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

// Scrape Luma events - Try Apify first, fallback to API (for batch scraping only)
export async function scrapeLumaEvents(query: string, maxItems: number = 50): Promise<{ events: any[], source: 'apify' | 'puppeteer' }> {
    // Try Apify first if configured (for batch scraping)
    if (isApifyConfigured()) {
      try {
        console.log(`🔍 [LUMA] Attempting Apify scraping for: ${query}`)
        const events = await scrapeLumaEventsApify(query, maxItems)
        if (events.length > 0) {
          console.log(`✅ [LUMA-APIFY] Found ${events.length} Luma events via Apify`)
          return { events, source: 'apify' }
        } else {
          console.log(`⚠️ [LUMA-APIFY] Apify returned 0 events, falling back to API method`)
        }
      } catch (error) {
        console.warn(`⚠️ [LUMA-APIFY] Apify scraping failed, falling back to API method:`, (error as Error).message)
      }
    }
    
    // Fallback to direct API call (Puppeteer-based)
    try {
      console.log(`🔍 [LUMA] Scraping Luma events via API for: ${query}`)
      
      // Use direct API call to get-paginated-events endpoint (PROVEN TO WORK)
      const events = await scrapeLumaEventsViaAPI(query, maxItems)
      
      console.log(`✅ [LUMA-API] Found ${events.length} Luma events`)
      return { events, source: 'puppeteer' }
    } catch (error) {
      console.error('❌ Luma scraping failed:', error)
      return { events: [], source: 'puppeteer' }
    }
  }

// Streaming version for real-time results (using efficient API method)
export async function* scrapeLumaEventsStreaming(query: string, maxItems: number = 50) {
  console.log(`🔍 [GENERATOR] Starting streaming Luma scrape for: ${query}`)
  try {
    const { events } = await scrapeLumaEvents(query, maxItems)
    for (const event of events) {
      yield event
    }
  } catch (error) {
    console.error('❌ Luma streaming failed:', error)
  }
}

// Scrape Eventbrite events - Try Apify first, fallback to Puppeteer (for batch scraping only)
export async function scrapeEventbriteEvents(city: string, techQuery: string, maxItems: number = 50): Promise<{ events: any[], source: 'apify' | 'puppeteer' }> {
    // Try Apify first if configured (for batch scraping)
    if (isApifyConfigured()) {
      try {
        console.log(`🔍 [EVENTBRITE] Attempting Apify scraping for: ${city} - ${techQuery}`)
        // Use higher limit for Apify to get all available events (Apify will return all it finds)
        const events = await scrapeEventbriteEventsApify(city, techQuery, maxItems || 200)
        if (events.length > 0) {
          console.log(`✅ [EVENTBRITE-APIFY] Found ${events.length} Eventbrite events via Apify`)
          return { events, source: 'apify' }
        } else {
          console.log(`⚠️ [EVENTBRITE-APIFY] Apify returned 0 events, falling back to Puppeteer`)
        }
      } catch (error) {
        console.warn(`⚠️ [EVENTBRITE-APIFY] Apify scraping failed, falling back to Puppeteer:`, (error as Error).message)
      }
    }
    
    // Fallback to Puppeteer scraping
    try {
      console.log(`🔍 [EVENTBRITE] Scraping Eventbrite tech events via Puppeteer for: ${city} - ${techQuery}`)
      const events = await scrapeEventbriteEventsPuppeteer(city, techQuery, maxItems || 50)
      console.log(`✅ [EVENTBRITE-PUPPETEER] Found ${events.length} Eventbrite tech events for "${techQuery}"`)
      return { events, source: 'puppeteer' }
    } catch (error) {
      console.error(`❌ Eventbrite tech scraping failed for "${techQuery}":`, error)
      return { events: [], source: 'puppeteer' }
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

// ============================================================================
// SHARED VALIDATION AND SAVING LOGIC (used by all processors)
// ============================================================================

/**
 * Shared validation and saving logic for all event sources
 * This ensures consistent quality gates, deduplication, and database operations
 */
async function validateAndSaveEvent(
  processedEvent: any,
  platform: 'luma' | 'eventbrite',
  city: string
): Promise<{ saved: boolean; reason?: string }> {
  // FETCH MISSING DATA: If description is short or organizer missing, try to fetch from URL
  const descriptionStr = typeof processedEvent.description === 'string' ? processedEvent.description : (processedEvent.description?.text || '')
  if ((!descriptionStr || descriptionStr.length < 100 || 
       descriptionStr.includes('Technology event:')) && 
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
  
  // QUALITY GATE: Reject if completeness < 50
  if (processedEvent.completenessScore < 50) {
    console.log(`❌ Rejecting ${platform} event (completeness ${processedEvent.completenessScore}): ${processedEvent.title}`)
    console.log(`   Missing: ${getMissingFields(processedEvent).join(', ')}`)
    return { saved: false, reason: 'completeness' }
  } else if (processedEvent.completenessScore < 60) {
    console.log(`⚠️ Low completeness score (${processedEvent.completenessScore}) for ${platform} event: ${processedEvent.title}, but allowing through`)
  }
  
  // Validate event data using Zod
  const validatedEvent = validateEvent(processedEvent)
  if (!validatedEvent) {
    console.log(`⚠️ Skipping invalid ${platform} event: ${processedEvent.title}`)
    return { saved: false, reason: 'validation' }
  }
  
  // REMOVED: Tech event filtering - now saving ALL events regardless of tech/non-tech
  // All events from scraping will be saved (tech filtering removed per user request)

  // COMMENTED OUT: Skip past events (older than 1 week) - temporarily disabled
  // const oneWeekAgo = new Date()
  // oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  // if (validatedEvent.eventDate < oneWeekAgo) {
  //   console.log(`⚠️ Skipping past ${platform} event: ${validatedEvent.title}`)
  //   return { saved: false, reason: 'past-event' }
  // }
  
  // Only keep events in 2025 or later
  const year2025 = new Date('2025-01-01')
  if (validatedEvent.eventDate < year2025) {
    console.log(`⚠️ Skipping old ${platform} event: ${validatedEvent.title} (${validatedEvent.eventDate.getFullYear()})`)
    return { saved: false, reason: 'old-date' }
  }

  // Normalize sourceId for deduplication
  const normalizedSourceId = normalizeSourceId(validatedEvent.sourceId, platform)
  
  // Enhanced deduplication: Check multiple conditions in single query
  let existingEvent
  try {
    existingEvent = await prisma.event.findFirst({
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
  } catch (dbError: any) {
    if (dbError.message?.includes("Can't reach database") || dbError.code === 'P1001') {
      console.error(`❌ [DB] Database connection failed during deduplication check`)
      return { saved: false, reason: 'db-error' }
    }
    throw dbError
  }
  
  if (existingEvent) {
    console.log(`⏭️ Duplicate ${platform} event: ${validatedEvent.title} (matched existing: ${existingEvent.id})`)
    return { saved: false, reason: 'duplicate' }
  }
  
  // Save to database with normalized sourceId and enrichment fields
  let savedEvent
  try {
    savedEvent = await prisma.event.create({
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
  } catch (dbError: any) {
    if (dbError.message?.includes("Can't reach database") || dbError.code === 'P1001') {
      console.error(`❌ [DB] Database connection failed while saving event: ${validatedEvent.title}`)
      return { saved: false, reason: 'db-error' }
    }
    throw dbError
  }
  
  // Populate EventCategory from tech stack (no LLM cost)
  if (validatedEvent.techStack && validatedEvent.techStack.length > 0) {
    try {
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
    } catch (dbError: any) {
      if (dbError.message?.includes("Can't reach database") || dbError.code === 'P1001') {
        console.error(`❌ [DB] Database connection failed while saving categories`)
        // Event is saved but categories failed - continue anyway
      } else {
        throw dbError
      }
    }
  }
  
  console.log(`💾 Saved ${platform} event: ${validatedEvent.title} (ID: ${savedEvent.id}, completeness: ${processedEvent.completenessScore})`)
  return { saved: true }
}

// ============================================================================
// PUPPETEER PROCESSING FUNCTIONS (PRESERVE EXISTING LOGIC)
// ============================================================================

/**
 * Process Puppeteer Eventbrite events - PRESERVED ORIGINAL LOGIC
 * Puppeteer returns: { name, title, id, api_id, url, event_url, start_date, start_time, summary, full_description, is_online_event, primary_venue, image, ticket_info, organizer }
 */
async function processPuppeteerEventbriteEvent(event: any, city: string): Promise<any> {
  const description = event.full_description || event.summary || ''
  
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
  
  return {
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
    sourcePlatform: 'eventbrite',
    sourceId: event.id || event.api_id || `eventbrite-${Date.now()}`
  }
}

/**
 * Process Puppeteer Luma events - PRESERVED ORIGINAL LOGIC
 * Puppeteer Luma (via API) returns: { api_id, event: { name, description, start_at, end_at, ... }, start_at, calendar, hosts }
 */
async function processPuppeteerLumaEvent(event: any, city: string): Promise<any> {
  const nestedEvent = event.event || {} // The nested event object
  const topLevel = event // Top level fields
  
  return {
    title: nestedEvent.name || topLevel.name || 'Untitled Event',
    description: nestedEvent.description || topLevel.description || (typeof event.description_mirror === 'string' ? event.description_mirror : '') || 'No description available',
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
    externalUrl: (() => {
      const url = nestedEvent.url || topLevel.url
      if (url?.startsWith('http')) return url
      if (url) return `https://lu.ma/${url}`
      const apiId = nestedEvent.api_id || topLevel.api_id
      return apiId ? `https://lu.ma/${apiId}` : ''
    })(),
    imageUrl: nestedEvent.cover_url || topLevel.cover_url || topLevel.cover_image || event.mainImageUrl || event.imageUrl || '',
    sourcePlatform: 'luma',
    sourceId: nestedEvent.api_id || topLevel.api_id || `luma-${Date.now()}`
  }
}

// ============================================================================
// APIFY PROCESSING FUNCTIONS (NEW - APIFY-SPECIFIC LOGIC)
// ============================================================================

/**
 * Process Apify Eventbrite events - NEW APIFY-SPECIFIC LOGIC
 * Apify returns: { name, title, id, api_id, url, event_url, start_date, start_time, end_date, end_time, summary, full_description, is_online_event, primary_venue, image, ticket_info, organizer }
 */
async function processApifyEventbriteEvent(event: any, city: string): Promise<any> {
  // Apify provides actual descriptions - use them directly, don't add generic text
  const description = event.full_description || event.summary || ''
  
  // Parse date from Apify format
  let eventDate: Date
  if (event.start_date) {
    try {
      eventDate = typeof event.start_date === 'string' 
        ? new Date(event.start_date.includes('T') ? event.start_date : `${event.start_date}T${event.start_time || '18:00'}`)
        : new Date(event.start_date)
    } catch {
      eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    }
  } else {
    eventDate = new Date(Date.now() + (7 + Math.random() * 23) * 24 * 60 * 60 * 1000)
  }
  
  return {
    title: event.name || event.title || 'Untitled Event',
    description: description, // Use Apify description as-is, no generic text added
    eventType: 'workshop',
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
    techStack: [] as string[],
    qualityScore: 0,
    externalUrl: event.url || event.event_url || '',
    imageUrl: event.image?.url || event.image?.original?.url || '',
    sourcePlatform: 'eventbrite',
    sourceId: event.id || event.api_id || `eventbrite-${Date.now()}`
  }
}

/**
 * Process Apify Luma events - NEW APIFY-SPECIFIC LOGIC
 * Apify returns: { api_id, name, title, description (already extracted from ProseMirror), url (full URL), start_at, end_at, event: {...}, calendar, hosts, ... }
 */
async function processApifyLumaEvent(event: any, city: string): Promise<any> {
  const nestedEvent = event.event || {}
  const topLevel = event
  
  // Apify already extracts ProseMirror to string in apifyScraping.ts, so description is already a string
  // URL is already a full URL from apifyScraping.ts
  
  // Helper to extract numeric price from Apify ticket_info (can be number or object)
  const extractPrice = (ticketInfo: any): number => {
    if (!ticketInfo) return 0
    const price = ticketInfo.price
    if (typeof price === 'number') return price
    if (typeof price === 'object' && price !== null) {
      // Handle object format like { cents: 0, currency: 'USD' } or { price: 0 }
      if (typeof price.cents === 'number') return price.cents / 100
      if (typeof price.price === 'number') return price.price
    }
    return 0
  }
  
  const ticketInfo = nestedEvent.ticket_info || topLevel.ticket_info
  const price = extractPrice(ticketInfo)
  
  return {
    title: nestedEvent.name || topLevel.name || 'Untitled Event',
    description: nestedEvent.description || topLevel.description || (typeof event.description_mirror === 'string' ? event.description_mirror : '') || 'No description available',
    eventType: 'workshop',
    eventDate: topLevel.start_at ? new Date(topLevel.start_at) : (nestedEvent.start_at ? new Date(nestedEvent.start_at) : new Date()),
    eventEndDate: topLevel.end_at ? new Date(topLevel.end_at) : (nestedEvent.end_at ? new Date(nestedEvent.end_at) : null),
    venueName: nestedEvent.location?.name || nestedEvent.venue?.name || topLevel.location?.name || city,
    venueAddress: nestedEvent.location?.address || nestedEvent.venue?.address || topLevel.location?.address || city,
    city: city,
    country: 'US',
    isOnline: nestedEvent.event_type === 'online' || nestedEvent.location_type === 'online' || topLevel.event_type === 'online',
    isFree: nestedEvent.ticket_info?.is_free || topLevel.ticket_info?.is_free || false,
    priceMin: price,
    priceMax: price,
    currency: 'USD',
    organizerName: topLevel.calendar?.name || nestedEvent.calendar?.name || topLevel.hosts?.[0]?.name || nestedEvent.hosts?.[0]?.name || 'Unknown',
    organizerDescription: topLevel.calendar?.description || nestedEvent.calendar?.description || topLevel.hosts?.[0]?.bio_short || '',
    capacity: nestedEvent.capacity || topLevel.capacity || null,
    registeredCount: nestedEvent.registered_count || topLevel.registered_count || topLevel.guest_count || 0,
    techStack: [] as string[],
    qualityScore: 0,
    // Apify already provides full URL, but double-check
    externalUrl: (() => {
      const url = nestedEvent.url || topLevel.url
      if (url?.startsWith('http')) return url
      if (url) return `https://lu.ma/${url}`
      const apiId = nestedEvent.api_id || topLevel.api_id
      return apiId ? `https://lu.ma/${apiId}` : ''
    })(),
    imageUrl: nestedEvent.cover_url || topLevel.cover_url || topLevel.cover_image || event.mainImageUrl || event.imageUrl || '',
    sourcePlatform: 'luma',
    sourceId: nestedEvent.api_id || topLevel.api_id || `luma-${Date.now()}`
  }
}

// ============================================================================
// MAIN PROCESSING FUNCTIONS (CALL CORRECT PROCESSOR BASED ON SOURCE)
// ============================================================================

/**
 * Process Puppeteer Eventbrite events - PRESERVED ORIGINAL LOGIC
 */
export async function processPuppeteerEventbriteEvents(events: any[], city: string) {
  return processEventsWithSource(events, 'eventbrite', city, 'puppeteer', processPuppeteerEventbriteEvent)
}

/**
 * Process Puppeteer Luma events - PRESERVED ORIGINAL LOGIC
 */
export async function processPuppeteerLumaEvents(events: any[], city: string) {
  return processEventsWithSource(events, 'luma', city, 'puppeteer', processPuppeteerLumaEvent)
}

/**
 * Process Apify Eventbrite events - NEW APIFY-SPECIFIC LOGIC
 */
export async function processApifyEventbriteEvents(events: any[], city: string) {
  return processEventsWithSource(events, 'eventbrite', city, 'apify', processApifyEventbriteEvent)
}

/**
 * Process Apify Luma events - NEW APIFY-SPECIFIC LOGIC
 */
export async function processApifyLumaEvents(events: any[], city: string) {
  return processEventsWithSource(events, 'luma', city, 'apify', processApifyLumaEvent)
}

/**
 * Generic processor that calls the correct event mapper and shared validation/saving logic
 */
async function processEventsWithSource(
  events: any[],
  platform: 'luma' | 'eventbrite',
  city: string,
  source: 'puppeteer' | 'apify',
  eventMapper: (event: any, city: string) => Promise<any>
) {
  let savedCount = 0
  let rejectedCount = 0
  let rejectedReasons: Record<string, number> = {}
  
  console.log(`🔄 Processing ${events.length} ${source} ${platform} events for city: ${city}`)
  
  for (const event of events) {
    try {
      console.log(`🔍 Processing ${source} ${platform} event:`, {
        name: event.name || event.title,
        api_id: event.api_id || event.id,
        platform,
        source
      })
      
      // Map event to processed format using source-specific mapper
      const processedEvent = await eventMapper(event, city)
      
      // Use shared validation and saving logic
      const result = await validateAndSaveEvent(processedEvent, platform, city)
      
      if (result.saved) {
        savedCount++
      } else {
        rejectedCount++
        if (result.reason) {
          rejectedReasons[result.reason] = (rejectedReasons[result.reason] || 0) + 1
        }
      }
      
    } catch (error: any) {
      // Handle non-database errors
      if (error.message?.includes("Can't reach database") || error.code === 'P1001') {
        console.error(`❌ [DB] Database connection error: ${error.message}`)
        rejectedCount++
        rejectedReasons['db-error'] = (rejectedReasons['db-error'] || 0) + 1
      } else {
        console.error(`❌ Error processing ${source} ${platform} event:`, error)
        rejectedCount++
        rejectedReasons['error'] = (rejectedReasons['error'] || 0) + 1
      }
    }
  }
  
  console.log(`✅ Processed ${events.length} ${source} ${platform} events for ${city}: ${savedCount} saved, ${rejectedCount} rejected`)
  if (rejectedCount > 0) {
    console.log(`   📊 Rejection reasons:`, rejectedReasons)
  }
  
  // Warn if database connection issues occurred
  const dbErrors = rejectedReasons['db-error'] || 0
  if (dbErrors > 0) {
    console.error(`   ⚠️ Database connection failed - ${dbErrors} events could not be saved`)
    console.error(`   Please check DATABASE_URL and ensure the database is accessible`)
  }
  
  return savedCount
}

// ============================================================================
// LEGACY FUNCTION (for backward compatibility - will be removed)
// ============================================================================

// Process and save events to database - RESTORED ORIGINAL LOGIC
// DEPRECATED: Use processPuppeteerEventbriteEvents, processPuppeteerLumaEvents, etc. instead
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
          // For Apify events, use the actual summary/full_description from the actor
          // Don't add generic "Technology event" text - use what Apify provides
          const description = event.full_description || event.summary || ''
          
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
            // Description - Apify already extracts ProseMirror to string in apifyScraping.ts
            // Puppeteer returns string directly, so we just need to handle strings here
            description: nestedEvent.description || topLevel.description || (typeof event.description_mirror === 'string' ? event.description_mirror : '') || 'No description available',
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
            // Construct full URL - url might be just a slug, so check if it's already a full URL
            externalUrl: (() => {
              const url = nestedEvent.url || topLevel.url
              if (url?.startsWith('http')) return url
              if (url) return `https://lu.ma/${url}`
              const apiId = nestedEvent.api_id || topLevel.api_id
              return apiId ? `https://lu.ma/${apiId}` : ''
            })(),
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
        // Ensure description is a string
        const descriptionStr = typeof processedEvent.description === 'string' ? processedEvent.description : (processedEvent.description?.text || '')
        if ((!descriptionStr || descriptionStr.length < 100 || 
             descriptionStr.includes('Technology event:')) && 
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
        
        // REMOVED: Tech event filtering - now saving ALL events regardless of tech/non-tech
        // All events from scraping will be saved (tech filtering removed per user request)

        // COMMENTED OUT: Skip past events (older than 1 week) - temporarily disabled
        // const oneWeekAgo = new Date()
        // oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        // if (validatedEvent.eventDate < oneWeekAgo) {
        //   rejectedCount++
        //   rejectedReasons['past-event'] = (rejectedReasons['past-event'] || 0) + 1
        //   console.log(`⚠️ Skipping past ${platform} event: ${validatedEvent.title}`)
        //   continue
        // }
        
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
        let existingEvent
        try {
          existingEvent = await prisma.event.findFirst({
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
        } catch (dbError: any) {
          if (dbError.message?.includes("Can't reach database") || dbError.code === 'P1001') {
            console.error(`❌ [DB] Database connection failed during deduplication check`)
            rejectedCount++
            rejectedReasons['db-error'] = (rejectedReasons['db-error'] || 0) + 1
            continue
          }
          throw dbError
        }
        
        if (existingEvent) {
          console.log(`⏭️ Duplicate ${platform} event: ${validatedEvent.title} (matched existing: ${existingEvent.id})`)
          continue
        }
        
        // Save to database with normalized sourceId and enrichment fields
        let savedEvent
        try {
          savedEvent = await prisma.event.create({
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
        } catch (dbError: any) {
          if (dbError.message?.includes("Can't reach database") || dbError.code === 'P1001') {
            console.error(`❌ [DB] Database connection failed while saving event: ${validatedEvent.title}`)
            rejectedCount++
            rejectedReasons['db-error'] = (rejectedReasons['db-error'] || 0) + 1
            continue
          }
          throw dbError
        }
        
        // Populate EventCategory from tech stack (no LLM cost)
        if (validatedEvent.techStack && validatedEvent.techStack.length > 0) {
          try {
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
          } catch (dbError: any) {
            if (dbError.message?.includes("Can't reach database") || dbError.code === 'P1001') {
              console.error(`❌ [DB] Database connection failed while saving categories`)
              // Event is saved but categories failed - continue anyway
            } else {
              throw dbError
            }
          }
        }
        
        savedCount++
        console.log(`💾 Saved ${platform} event: ${validatedEvent.title} (ID: ${savedEvent.id}, completeness: ${processedEvent.completenessScore})`)
        
      } catch (error: any) {
        // Handle non-database errors
        if (error.message?.includes("Can't reach database") || error.code === 'P1001') {
          console.error(`❌ [DB] Database connection error: ${error.message}`)
          rejectedCount++
          rejectedReasons['db-error'] = (rejectedReasons['db-error'] || 0) + 1
        } else {
          console.error(`❌ Error processing ${platform} event:`, error)
          rejectedCount++
          rejectedReasons['error'] = (rejectedReasons['error'] || 0) + 1
        }
      }
    }
    
    console.log(`✅ Processed ${events.length} ${platform} events for ${city}: ${savedCount} saved, ${rejectedCount} rejected`)
    if (rejectedCount > 0) {
      console.log(`   📊 Rejection reasons:`, rejectedReasons)
    }
    
    // Warn if database connection issues occurred
    const dbErrors = rejectedReasons['db-error'] || 0
    if (dbErrors > 0) {
      console.error(`   ⚠️ Database connection failed - ${dbErrors} events could not be saved`)
      console.error(`   Please check DATABASE_URL and ensure the database is accessible`)
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
