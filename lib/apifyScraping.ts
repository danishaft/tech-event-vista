/**
 * Apify Scraping Service
 * 
 * This service uses Apify actors to scrape events from Eventbrite and Luma.
 * It provides the same interface as Puppeteer scraping, allowing easy switching
 * between scraping methods.
 * 
 * Configuration:
 * - APIFY_API_TOKEN: Your Apify API token (required)
 * - APIFY_EVENTBRITE_ACTOR_ID: Apify actor ID for Eventbrite scraping (optional, can use default)
 * - APIFY_LUMA_ACTOR_ID: Apify actor ID for Luma scraping (optional, can use default)
 * 
 * Usage:
 * - Set APIFY_API_TOKEN in your environment variables
 * - Optionally set actor IDs if using custom actors
 * - Call scrapeEventbriteEvents() or scrapeLumaEvents() as needed
 */

import { ApifyClient } from 'apify-client'

// Initialize Apify client
let apifyClient: ApifyClient | null = null

/**
 * Extract plain text from ProseMirror document structure
 * ProseMirror uses a nested structure: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "..." }] }] }
 */
function extractTextFromProseMirror(doc: any): string {
  if (!doc) return ''
  
  // If it's already a string, return it
  if (typeof doc === 'string') return doc
  
  // If it has a text property, return it
  if (doc.text && typeof doc.text === 'string') return doc.text
  
  // If it's a ProseMirror document, extract text from content array
  if (doc.content && Array.isArray(doc.content)) {
    return doc.content
      .map((node: any) => {
        // If node has text directly, use it
        if (node.text && typeof node.text === 'string') {
          return node.text
        }
        // If node has content array, recurse
        if (node.content && Array.isArray(node.content)) {
          return extractTextFromProseMirror({ content: node.content })
        }
        return ''
      })
      .filter((text: string) => text.length > 0)
      .join('\n')
  }
  
  return ''
}

function getApifyClient(): ApifyClient {
  if (!apifyClient) {
    const token = process.env.APIFY_API_TOKEN
    if (!token) {
      throw new Error('APIFY_API_TOKEN environment variable is required for Apify scraping')
    }
    apifyClient = new ApifyClient({ token })
    console.log('✅ Apify client initialized')
  }
  return apifyClient
}

/**
 * Default Apify actors (you can replace these with your own actor IDs)
 * These are common actors available on Apify platform
 */
const DEFAULT_ACTORS = {
  // Eventbrite actor ID from your Apify account
  // Actor: https://console.apify.com/actors/PmxIAXfwo0gUUNdG4
  eventbrite: process.env.APIFY_EVENTBRITE_ACTOR_ID || 'PmxIAXfwo0gUUNdG4',
  // Luma actor ID (please provide your actor ID or set APIFY_LUMA_ACTOR_ID)
  // Luma actor ID from your Apify account
  // Actor: https://console.apify.com/actors/r5gMxLV2rOF3J1fxu
  luma: process.env.APIFY_LUMA_ACTOR_ID || 'r5gMxLV2rOF3J1fxu',
}

/**
 * Wait for Apify actor run to complete and return results
 */
async function waitForRunAndGetResults(
  runId: string,
  actorId: string,
  timeoutMs: number = 300000 // 5 minutes default
): Promise<any[]> {
  const client = getApifyClient()
  const startTime = Date.now()
  
  console.log(`⏳ [APIFY] Waiting for actor run ${runId} to complete...`)
  
  while (Date.now() - startTime < timeoutMs) {
    const run = await client.run(runId).get()
    
    if (run.status === 'SUCCEEDED') {
      console.log(`✅ [APIFY] Actor run ${runId} completed successfully`)
      
      // Get results from dataset
      const dataset = await client.dataset(run.defaultDatasetId).listItems()
      console.log(`📊 [APIFY] Retrieved ${dataset.items.length} items from dataset`)
      return dataset.items
    } else if (run.status === 'FAILED' || run.status === 'ABORTED') {
      throw new Error(`Apify actor run ${runId} ${run.status.toLowerCase()}: ${run.statusMessage || 'Unknown error'}`)
    } else if (run.status === 'RUNNING' || run.status === 'READY') {
      // Still running, wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
    } else {
      throw new Error(`Unexpected actor run status: ${run.status}`)
    }
  }
  
  throw new Error(`Apify actor run ${runId} timed out after ${timeoutMs}ms`)
}

/**
 * Scrape Eventbrite events using Apify actor
 * 
 * @param city - City to search in (e.g., "Seattle", "San Francisco")
 * @param query - Search query (e.g., "ai", "python", "reactjs")
 * @param maxItems - Maximum number of events to return
 * @returns Array of Eventbrite events
 */
export async function scrapeEventbriteEventsApify(
  city: string,
  query: string,
  maxItems: number = 50
): Promise<any[]> {
  try {
    const client = getApifyClient()
    const actorId = DEFAULT_ACTORS.eventbrite
    
    console.log(`🔍 [APIFY] Starting Eventbrite scrape for: ${city} - ${query}`)
    console.log(`   Using actor: ${actorId}`)
    
    // Build Eventbrite search URL based on city and query
    // Format: https://www.eventbrite.com/d/{location}/all-events/?page=1
    // For search with query: https://www.eventbrite.com/d/{location}/{query}/?page=1
    const locationSlug = city.toLowerCase().replace(/\s+/g, '-')
    const querySlug = query.toLowerCase().replace(/\s+/g, '-')
    
    // Construct the search URL
    const searchUrl = query 
      ? `https://www.eventbrite.com/d/${locationSlug}/${querySlug}/?page=1`
      : `https://www.eventbrite.com/d/${locationSlug}/all-events/?page=1`
    
    // Eventbrite actor input schema (from actual actor documentation)
    const input = {
      start_urls: [
        {
          url: searchUrl
        }
      ],
      max_depth: 1
    }
    
    console.log(`📝 [APIFY] Calling actor with input:`, {
      searchUrl,
      city,
      query,
      actorId
    })
    
    const run = await client.actor(actorId).call(input)
    
    console.log(`🚀 [APIFY] Actor run started: ${run.id}`)
    
    // Wait for run to complete and get results
    const items = await waitForRunAndGetResults(run.id, actorId)
    
    // Transform items to match expected format
    // Eventbrite actor output format (from actual actor output):
    // { name, eventbrite_event_id, id, url, start_date, start_time, end_date, end_time,
    //   summary, full_description, primary_venue, image, is_online_event, ... }
    const events = items.map((item: any) => {
      // Normalize to expected format (matching Puppeteer output)
      return {
        name: item.name,
        title: item.name, // Alias for compatibility
        id: item.eventbrite_event_id || item.id || item.eid,
        api_id: item.eventbrite_event_id || item.id || item.eid,
        url: item.url,
        event_url: item.url, // Alias for compatibility
        start_date: item.start_date,
        start_time: item.start_time,
        end_date: item.end_date,
        end_time: item.end_time,
        summary: item.summary || '',
        full_description: item.full_description || item.summary || '',
        is_online_event: item.is_online_event || false,
        primary_venue: item.primary_venue || {
          name: city,
          address: {
            localized_address_display: city
          }
        },
        image: item.image || {
          url: item.image?.url || item.image?.original?.url || ''
        },
        ticket_info: {
          is_free: false, // Eventbrite actor doesn't provide this directly
          price: 0 // Would need to parse from tickets_url or other fields
        },
        organizer: {
          name: 'Organizer not available' // Eventbrite actor doesn't provide organizer name directly
        }
      }
    })
    
    console.log(`✅ [APIFY] Eventbrite scrape completed: ${events.length} events found`)
    return events.slice(0, maxItems) // Ensure we don't exceed maxItems
    
  } catch (error: any) {
    console.error(`❌ [APIFY] Eventbrite scraping failed:`, {
      error: error.message,
      stack: error.stack,
      city,
      query
    })
    
    // If actor doesn't exist or is invalid, provide helpful error
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      throw new Error(
        `Apify actor "${DEFAULT_ACTORS.eventbrite}" not found. ` +
        `Please set APIFY_EVENTBRITE_ACTOR_ID to a valid actor ID, ` +
        `or create your own Eventbrite scraper actor on Apify.`
      )
    }
    
    throw error
  }
}

/**
 * Scrape Luma events using Apify actor
 * 
 * @param query - Search query (e.g., "tech", "ai", "python")
 * @param maxItems - Maximum number of events to return
 * @returns Array of Luma events
 */
export async function scrapeLumaEventsApify(
  query: string,
  maxItems: number = 50
): Promise<any[]> {
  try {
    const client = getApifyClient()
    const actorId = DEFAULT_ACTORS.luma
    
    console.log(`🔍 [APIFY] Starting Luma scrape for: ${query}`)
    console.log(`   Using actor: ${actorId}`)
    
    // Start actor run with input parameters
    // Try multiple parameter combinations to support different actor input schemas
    // Common Luma actor input patterns:
    // - { query, maxResults }
    // - { searchQuery, maxItems }
    // - { searchTerm, limit }
    const input = {
      // Primary parameters (most common)
      query: query,
      searchQuery: query,
      searchTerm: query,
      // Result limits
      maxResults: maxItems,
      maxItems: maxItems,
      limit: maxItems,
      // Optional parameters
      includeOnline: true,
      sortBy: 'date',
      // Add any other parameters your specific actor expects
      // You can customize this based on your actor's README
    }
    
    console.log(`📝 [APIFY] Calling actor with input:`, {
      query,
      maxItems,
      actorId
    })
    
    const run = await client.actor(actorId).call(input)
    
    console.log(`🚀 [APIFY] Actor run started: ${run.id}`)
    
    // Wait for run to complete and get results
    const items = await waitForRunAndGetResults(run.id, actorId)
    
    // Transform items to match expected format
    // Luma actor output format (from actual actor output):
    // Top-level: { api_id, name, url, start_at, end_at, mainImageUrl, event: {...}, calendar, hosts, ticket_info, ... }
    // Nested event: { api_id, name, start_at, end_at, location_type, event_type, geo_address_info, ... }
    const events = items.map((item: any) => {
      const eventData = item.event || item // Use nested event if available, otherwise top-level
      
      // Extract location/venue info from nested geo_address_info or event data
      const locationInfo = eventData?.geo_address_info || {}
      const venueName = locationInfo.address || locationInfo.full_address || locationInfo.city || ''
      const venueAddress = locationInfo.full_address || locationInfo.address || ''
      
      // Normalize to expected format (matching Luma API output)
      return {
        api_id: item.api_id || eventData?.api_id,
        name: item.name || eventData?.name,
        title: item.name || eventData?.name, // Alias for compatibility
        // Extract text from ProseMirror document structure
        description: extractTextFromProseMirror(item.description_mirror) || eventData?.description || '',
        description_mirror: item.description_mirror || eventData?.description || '',
        start_at: item.start_at || eventData?.start_at,
        end_at: item.end_at || eventData?.end_at,
        // Construct full URL - item.url might be just a slug, so check if it's already a full URL
        url: (item.url?.startsWith('http') ? item.url : (item.url ? `https://lu.ma/${item.url}` : (item.api_id ? `https://lu.ma/${item.api_id}` : ''))),
        cover_url: item.mainImageUrl || eventData?.cover_url || '',
        cover_image: item.mainImageUrl || eventData?.cover_url || '',
        event_type: eventData?.event_type || 'independent',
        location_type: eventData?.location_type || 'offline',
        location: {
          name: venueName,
          address: venueAddress
        },
        venue: {
          name: venueName,
          address: venueAddress
        },
        calendar: item.calendar || {
          name: 'Unknown',
          description: ''
        },
        hosts: item.hosts || [],
        capacity: null, // Luma actor doesn't provide capacity directly
        registered_count: item.guest_count || 0,
        guest_count: item.guest_count || 0,
        ticket_info: item.ticket_info || {
          is_free: false, // Would need to check ticket_types
          price: 0
        },
        // Nested event structure (preserve for compatibility)
        event: eventData || {
          api_id: item.api_id,
          name: item.name,
          start_at: item.start_at,
          end_at: item.end_at,
          location_type: eventData?.location_type,
          event_type: eventData?.event_type
        }
      }
    })
    
    console.log(`✅ [APIFY] Luma scrape completed: ${events.length} events found`)
    return events.slice(0, maxItems) // Ensure we don't exceed maxItems
    
  } catch (error: any) {
    console.error(`❌ [APIFY] Luma scraping failed:`, {
      error: error.message,
      stack: error.stack,
      query
    })
    
    // If actor doesn't exist or is invalid, provide helpful error
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      throw new Error(
        `Apify actor "${DEFAULT_ACTORS.luma}" not found. ` +
        `Please set APIFY_LUMA_ACTOR_ID to a valid actor ID, ` +
        `or create your own Luma scraper actor on Apify. ` +
        `Alternatively, you can use the direct Luma API via lumaEfficientScraping.ts`
      )
    }
    
    throw error
  }
}

/**
 * Streaming version for Eventbrite (yields events as they're processed)
 * Note: Apify actors run to completion, so this is a wrapper that yields all results
 */
export async function* scrapeEventbriteEventsStreamingApify(
  city: string,
  query: string
): AsyncGenerator<any, void, unknown> {
  try {
    const events = await scrapeEventbriteEventsApify(city, query, 50)
    for (const event of events) {
      yield event
    }
  } catch (error) {
    console.error(`❌ [APIFY] Eventbrite streaming failed:`, error)
  }
}

/**
 * Streaming version for Luma (yields events as they're processed)
 * Note: Apify actors run to completion, so this is a wrapper that yields all results
 */
export async function* scrapeLumaEventsStreamingApify(
  query: string
): AsyncGenerator<any, void, unknown> {
  try {
    const events = await scrapeLumaEventsApify(query, 20)
    for (const event of events) {
      yield event
    }
  } catch (error) {
    console.error(`❌ [APIFY] Luma streaming failed:`, error)
  }
}

/**
 * Check if Apify is configured and available
 */
export function isApifyConfigured(): boolean {
  return !!process.env.APIFY_API_TOKEN
}

/**
 * Get Apify configuration status
 */
export function getApifyConfig(): {
  configured: boolean
  eventbriteActor: string
  lumaActor: string
} {
  return {
    configured: isApifyConfigured(),
    eventbriteActor: DEFAULT_ACTORS.eventbrite,
    lumaActor: DEFAULT_ACTORS.luma
  }
}

/**
 * Scrape Eventbrite events using Apify actor
 * 
 * @param city - City to search in (e.g., "Seattle", "San Francisco")
 * @param query - Search query (e.g., "ai", "python", "reactjs")
 * @param maxItems - Maximum number of events to return
 * @returns Array of Eventbrite events
 */

/**
 * Scrape Luma events using Apify actor
 * 
 * @param query - Search query (e.g., "tech", "ai", "python")
 * @param maxItems - Maximum number of events to return
 * @returns Array of Luma events
 */

/**
 * Streaming version for Eventbrite (yields events as they're processed)
 * Note: Apify actors run to completion, so this is a wrapper that yields all results
 */

/**
 * Streaming version for Luma (yields events as they're processed)
 * Note: Apify actors run to completion, so this is a wrapper that yields all results
 */

/**
 * Check if Apify is configured and available
 */

/**
 * Get Apify configuration status
 */






// Initialize Apify client

/**
 * Default Apify actors (you can replace these with your own actor IDs)
 * These are common actors available on Apify platform
 */
  
/**
 * Scrape Eventbrite events using Apify actor
 * 
 * @param city - City to search in (e.g., "Seattle", "San Francisco")
 * @param query - Search query (e.g., "ai", "python", "reactjs")
 * @param maxItems - Maximum number of events to return
 * @returns Array of Eventbrite events
 */

/**
 * Scrape Luma events using Apify actor
 * 
 * @param query - Search query (e.g., "tech", "ai", "python")
 * @param maxItems - Maximum number of events to return
 * @returns Array of Luma events
 */

/**
 * Streaming version for Eventbrite (yields events as they're processed)
 * Note: Apify actors run to completion, so this is a wrapper that yields all results
 */

/**
 * Streaming version for Luma (yields events as they're processed)
 * Note: Apify actors run to completion, so this is a wrapper that yields all results
 */

/**
 * Check if Apify is configured and available
 */

/**
 * Get Apify configuration status
 */




// Initialize Apify client

/**
 * Default Apify actors (you can replace these with your own actor IDs)
 * These are common actors available on Apify platform
 */
  
/**
 * Scrape Eventbrite events using Apify actor
 * 
 * @param city - City to search in (e.g., "Seattle", "San Francisco")
 * @param query - Search query (e.g., "ai", "python", "reactjs")
 * @param maxItems - Maximum number of events to return
 * @returns Array of Eventbrite events
 */

/**
 * Scrape Luma events using Apify actor
 * 
 * @param query - Search query (e.g., "tech", "ai", "python")
 * @param maxItems - Maximum number of events to return
 * @returns Array of Luma events
 */

/**
 * Streaming version for Eventbrite (yields events as they're processed)
 * Note: Apify actors run to completion, so this is a wrapper that yields all results
 */

/**
 * Streaming version for Luma (yields events as they're processed)
 * Note: Apify actors run to completion, so this is a wrapper that yields all results
 */

/**
 * Check if Apify is configured and available
 */

/**
 * Get Apify configuration status
 */



