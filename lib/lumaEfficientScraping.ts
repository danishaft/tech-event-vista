// Most efficient Luma scraping - intercepts API calls
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { createBrowser, configurePage, delay } from './puppeteerScraping'

puppeteer.use(StealthPlugin())

/**
 * MOST EFFICIENT: Intercept Luma API calls to get events directly
 * This is faster and more reliable than DOM scraping
 */
export async function scrapeLumaEventsViaAPI(query: string, maxItems: number = 20): Promise<any[]> {
  const browser = await createBrowser()
  const events: any[] = []
  
  try {
    const page = await browser.newPage()
    await configurePage(page)
    
    console.log(`🔍 [LUMA-API] Scraping Luma events via API interception for: ${query}`)
    
    // Intercept network requests to capture API responses
    const apiResponses: any[] = []
    
    // Set up response interception BEFORE navigation
    page.on('response', async (response) => {
      const url = response.url()
      
      // Luma uses various API endpoints - capture all JSON responses
      if (url.includes('lu.ma') || 
          url.includes('luma.com') ||
          url.includes('api') ||
          url.includes('graphql') ||
          (url.includes('/events') || url.includes('search') || url.includes('explore'))) {
        
        try {
          const contentType = response.headers()['content-type'] || ''
          if (contentType.includes('json') || url.includes('.json') || url.includes('api')) {
            const data = await response.json().catch(() => null)
            if (data) {
              apiResponses.push({ url, data })
              console.log(`📡 [LUMA-API] Captured API response from: ${url.substring(0, 150)}`)
            }
          }
        } catch (e) {
          // Not JSON or failed to parse, skip
        }
      }
    })
    
    // Direct API call to paginated events endpoint (PROVEN TO WORK!)
    console.log(`🌐 [LUMA-API] Making direct API call to paginated events endpoint...`)
    
    // Use default coordinates (San Francisco) - can be made configurable later
    const lat = 37.7749
    const lon = -122.4194
    const paginatedApiUrl = `https://api2.luma.com/discover/get-paginated-events?latitude=${lat}&longitude=${lon}&pagination_limit=${maxItems}&slug=${encodeURIComponent(query)}`
    
    try {
      const directResponse = await page.evaluate(async (url) => {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        })
        return response.ok ? await response.json() : null
      }, paginatedApiUrl)
      
      if (directResponse && directResponse.entries && Array.isArray(directResponse.entries)) {
        console.log(`✅ [LUMA-API] Direct API call successful! Found ${directResponse.entries.length} events`)
        apiResponses.push({ url: paginatedApiUrl, data: directResponse })
      } else {
        console.log('⚠️ [LUMA-API] Direct API call returned no events')
      }
    } catch (e) {
      console.error('❌ [LUMA-API] Direct API call failed:', e)
    }
    
    console.log(`📡 [LUMA-API] Captured ${apiResponses.length} API responses`)
    
    // Extract events from API responses
    console.log(`🔍 [LUMA-API] Parsing ${apiResponses.length} API responses...`)
    for (const response of apiResponses) {
      try {
        const data = response.data
        const url = response.url
        
        // Log what we're parsing for debugging
        if (url.includes('bootstrap') || url.includes('discover') || url.includes('search')) {
          console.log(`🔍 [LUMA-API] Parsing response from: ${url.substring(0, 100)}`)
          console.log(`🔍 [LUMA-API] Response keys:`, Object.keys(data || {}).slice(0, 20))
          
          // Log full structure for bootstrap (most important)
          if (url.includes('bootstrap-page')) {
            console.log(`🔍 [LUMA-API] Bootstrap response structure:`, JSON.stringify(data, null, 2).substring(0, 1000))
          }
        }
        
        // Handle get-paginated-events endpoint (THE ONE WE WANT!)
        if (url.includes('get-paginated-events')) {
          console.log(`🎯 [LUMA-API] Found paginated events endpoint!`)
          
          // Events are in 'entries' array!
          if (data?.entries && Array.isArray(data.entries)) {
            console.log(`✅ [LUMA-API] Found ${data.entries.length} events in entries!`)
            
            // Log first event structure to see what fields it has
            if (data.entries.length > 0) {
              console.log(`🔍 [LUMA-API] First event structure:`, Object.keys(data.entries[0] || {}))
              console.log(`🔍 [LUMA-API] First event sample:`, JSON.stringify(data.entries[0], null, 2).substring(0, 300))
            }
            
            events.push(...data.entries)
          } else if (data?.events && Array.isArray(data.events)) {
            console.log(`✅ [LUMA-API] Found ${data.events.length} events in paginated response!`)
            events.push(...data.events)
          } else if (data?.data?.events && Array.isArray(data.data.events)) {
            console.log(`✅ [LUMA-API] Found ${data.data.events.length} events in paginated response!`)
            events.push(...data.data.events)
          } else if (data?.results && Array.isArray(data.results)) {
            console.log(`✅ [LUMA-API] Found ${data.results.length} events in paginated results!`)
            events.push(...data.results)
          } else {
            // Log structure to debug
            console.log(`🔍 [LUMA-API] Paginated events response keys:`, Object.keys(data || {}))
            if (data?.entries) {
              console.log(`🔍 [LUMA-API] Entries type:`, typeof data.entries, Array.isArray(data.entries))
            }
          }
        }
        
        // Handle bootstrap-page response - check for events in various locations
        if (url.includes('bootstrap-page') || (url.includes('discover') && !url.includes('get-paginated-events')) || url.includes('search')) {
          // Check all possible event locations
          const possiblePaths = [
            data?.events,
            data?.data?.events,
            data?.results?.events,
            data?.discover?.events,
            data?.page?.events,
            data?.content?.events,
            data?.items,
            data?.data?.items,
            data?.results,
            data?.data?.results,
            data?.search?.results,
            data?.search?.events,
            data?.query?.results,
            data?.query?.events,
          ]
          
          for (const path of possiblePaths) {
            if (Array.isArray(path) && path.length > 0) {
              const firstItem = path[0]
              if (firstItem && (firstItem.name || firstItem.title || firstItem.id || firstItem.slug || firstItem.api_id)) {
                console.log(`✅ [LUMA-API] Found ${path.length} events in response!`)
                events.push(...path)
                break
              }
            }
          }
          
          // Also check places array - might contain events
          if (data?.places && Array.isArray(data.places)) {
            for (const place of data.places) {
              if (place?.events && Array.isArray(place.events)) {
                console.log(`✅ [LUMA-API] Found ${place.events.length} events in places!`)
                events.push(...place.events)
              }
              if (place?.place?.events && Array.isArray(place.place.events)) {
                console.log(`✅ [LUMA-API] Found ${place.place.events.length} events in place.place!`)
                events.push(...place.place.events)
              }
            }
          }
        }
        
        // Handle different API response formats
        if (data.data?.events) {
          events.push(...(Array.isArray(data.data.events) ? data.data.events : []))
        } else if (data.events) {
          events.push(...(Array.isArray(data.events) ? data.events : []))
        } else if (data.data?.searchEvents) {
          events.push(...(Array.isArray(data.data.searchEvents) ? data.data.searchEvents : []))
        } else if (data.data?.results) {
          events.push(...(Array.isArray(data.data.results) ? data.data.results : []))
        } else if (Array.isArray(data)) {
          events.push(...data)
        } else if (data.items) {
          events.push(...(Array.isArray(data.items) ? data.items : []))
        } else if (data.results) {
          events.push(...(Array.isArray(data.results) ? data.results : []))
        }
        
        // Also check nested structures recursively
        function extractEvents(obj: any, depth = 0): any[] {
          if (depth > 3) return [] // Prevent infinite recursion
          const found: any[] = []
          
          if (Array.isArray(obj)) {
            for (const item of obj) {
              if (item && typeof item === 'object') {
                if (item.name || item.title || item.id || item.slug || item.api_id) {
                  found.push(item)
                } else {
                  found.push(...extractEvents(item, depth + 1))
                }
              }
            }
          } else if (obj && typeof obj === 'object') {
            for (const key in obj) {
              if (key.toLowerCase().includes('event') || key.toLowerCase().includes('item')) {
                found.push(...extractEvents(obj[key], depth + 1))
              }
            }
          }
          
          return found
        }
        
        // Deep search for events
        const deepEvents = extractEvents(data)
        if (deepEvents.length > 0) {
          console.log(`✅ [LUMA-API] Found ${deepEvents.length} events via deep search!`)
          events.push(...deepEvents)
        }
        
      } catch (e) {
        console.log(`⚠️ [LUMA-API] Error parsing API response:`, e)
      }
    }
    
    console.log(`📊 [LUMA-API] Extracted ${events.length} total events from API responses`)
    
    // If no events found, return empty (API method is reliable)
    if (events.length === 0) {
      console.log('⚠️ [LUMA-API] No events found in API responses')
      return []
    }
    
    // Normalize events to consistent format (handle nested structure)
    const normalizedEvents = events.map(event => {
      // If event has nested structure, flatten it
      if (event.event) {
        return {
          ...event,
          name: event.event.name || event.name,
          title: event.event.name || event.name,
          description: event.event.description || event.description,
          start_at: event.start_at || event.event.start_at,
          end_at: event.end_at || event.event.end_at,
          api_id: event.api_id || event.event.api_id,
          url: event.url || event.event.url || `https://lu.ma/${event.api_id || event.event.api_id}`,
          imageUrl: event.cover_url || event.event.cover_url || event.cover_image,
          hosts: event.hosts || event.event.hosts,
          calendar: event.calendar || event.event.calendar,
          ticket_info: event.ticket_info || event.event.ticket_info,
          location: event.location || event.event.location,
        }
      }
      return event
    })
    
    // Deduplicate and limit
    const uniqueEvents = Array.from(
      new Map(normalizedEvents.map(e => [e.api_id || e.id || e.slug, e])).values()
    ).slice(0, maxItems)
    
    console.log(`✅ [LUMA-API] Found ${uniqueEvents.length} events via API interception`)
    return uniqueEvents
    
  } catch (error) {
    console.error('❌ [LUMA-API] Luma API scraping failed:', error)
    return []
  } finally {
    await browser.close()
  }
}

// DOM scraping removed - API method works reliably, no fallback needed

// GraphQL removed - not working (404 error)
// Using direct API call to get-paginated-events instead (PROVEN TO WORK)

