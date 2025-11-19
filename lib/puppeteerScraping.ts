// Puppeteer scraping service with stealth plugin - replaces Apify
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { extractTechStack, assignEventType, calculateQualityScore, validateEvent } from './eventProcessing'

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin())

// Realistic user agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

// Get random user agent
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Create browser with stealth configuration
export async function createBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-background-networking',
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
  })
}

// Configure page with stealth settings
export async function configurePage(page: any) {
  // Set realistic user agent
  await page.setUserAgent(getRandomUserAgent())
  
  // Set viewport
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  })
  
  // Override webdriver property
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    })
  })
  
  // Override plugins
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    })
  })
  
  // Override languages
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    })
  })
  
  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  })
}

// Add realistic delay
export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Scrape Eventbrite events using Puppeteer with stealth
 */
export async function scrapeEventbriteEventsPuppeteer(city: string, query: string, maxItems: number = 20): Promise<any[]> {
  const browser = await createBrowser()
  const events: any[] = []
  
  try {
    const page = await browser.newPage()
    await configurePage(page)
    
    console.log(`🔍 [PUPPETEER] Scraping Eventbrite for: ${city} - ${query}`)
    
    // Build search URL
    const citySlug = city.toLowerCase().replace(/\s+/g, '-')
    const searchUrl = `https://www.eventbrite.com/d/${citySlug}/?q=${encodeURIComponent(query)}&page=1`
    
    console.log(`🌐 [PUPPETEER] Navigating to: ${searchUrl}`)
    
    // Navigate with retry logic for network errors
    let retries = 3
    let lastError: Error | null = null
    
    while (retries > 0) {
      try {
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded', // Changed from networkidle2 to be more lenient
          timeout: 60000,
        })
        break // Success, exit retry loop
      } catch (error: any) {
        lastError = error
        retries--
        if (error.message?.includes('ERR_NETWORK_CHANGED') || 
            error.message?.includes('net::ERR') ||
            error.message?.includes('Navigation timeout')) {
          console.warn(`⚠️ [PUPPETEER] Navigation failed (${retries} retries left):`, error.message)
          if (retries > 0) {
            await delay(2000 * (4 - retries)) // Exponential backoff
            continue
          }
        }
        throw error // Re-throw if not a network error
      }
    }
    
    if (lastError && retries === 0) {
      throw lastError
    }
    
    // Wait for page to load
    await delay(3000 + Math.random() * 2000) // 3-5 seconds
    
    // Scroll to load more content
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0
        const distance = 100
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= scrollHeight) {
            clearInterval(timer)
            resolve()
          }
        }, 100)
      })
    })
    
    await delay(2000)
    
    // Extract events
    const scrapedEvents = await page.evaluate((maxItems) => {
      const events: any[] = []
      
      // Try multiple selectors for Eventbrite event cards
      const selectors = [
        'article[class*="event-card"]',
        'div[class*="event-card"]',
        '[data-testid="event-card"]',
        'article.eds-event-card-content',
        'div.eds-event-card-content',
      ]
      
      let cards: NodeListOf<Element> | null = null
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector)
        if (elements.length > 0) {
          cards = elements
          break
        }
      }
      
      if (!cards || cards.length === 0) {
        console.log('⚠️ [PUPPETEER] No event cards found on page')
        console.log('   Tried selectors:', selectors)
        console.log('   Page URL:', window.location.href)
        console.log('   Page title:', document.title)
        // Check if we're blocked
        const bodyText = document.body?.textContent || ''
        if (bodyText.includes('blocked') || bodyText.includes('captcha') || bodyText.includes('access denied') || bodyText.includes('rate limit')) {
          console.error('🚫 [PUPPETEER] Possible blocking detected - page contains blocking keywords')
        }
        return events
      }
      
      console.log(`✅ [PUPPETEER] Found ${cards.length} event cards on page`)
      
      const limit = Math.min(maxItems, cards.length)
      
      for (let i = 0; i < limit; i++) {
        const card = cards[i]
        
        try {
          // Extract title
          const titleEl = card.querySelector('h3, h2, [class*="title"], [class*="name"]')
          const title = titleEl?.textContent?.trim() || ''
          
          if (!title || title.length < 3) continue
          
          // Extract link
          const linkEl = card.querySelector('a[href*="/e/"]')
          const href = linkEl?.getAttribute('href') || ''
          const fullUrl = href.startsWith('http') ? href : `https://www.eventbrite.com${href}`
          
          // Extract source ID
          const sourceId = href.match(/\/e\/([^\/]+)/)?.[1] || `eventbrite-${Date.now()}-${i}`
          
          // Extract date (simplified - would need more parsing in production)
          const dateEl = card.querySelector('[class*="date"], [class*="time"]')
          const dateText = dateEl?.textContent?.trim() || ''
          
          // Extract image
          const imgEl = card.querySelector('img')
          const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || ''
          
          // Extract price
          const priceEl = card.querySelector('[class*="price"], [class*="cost"]')
          const priceText = priceEl?.textContent?.trim() || ''
          const isFree = priceText.toLowerCase().includes('free') || priceText === ''
          
          // Extract venue
          const venueEl = card.querySelector('[class*="venue"], [class*="location"]')
          const venueName = venueEl?.textContent?.trim() || ''
          
          // Extract description from card if available
          const descEl = card.querySelector('[class*="description"], [class*="summary"], [class*="details"]')
          const description = descEl?.textContent?.trim() || ''
          
          // Extract organizer from card if available
          const orgEl = card.querySelector('[class*="organizer"], [class*="host"], [class*="by"]')
          const organizerName = orgEl?.textContent?.trim() || ''
          
          // Extract date/time if available
          const dateTimeEl = card.querySelector('[class*="date"], [class*="time"], [data-testid*="date"]')
          const dateTimeText = dateTimeEl?.textContent?.trim() || ''
          
          events.push({
            name: title,
            title: title,
            id: sourceId,
            api_id: sourceId,
            url: fullUrl,
            event_url: fullUrl,
            start_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            start_time: '18:00',
            end_date: null,
            end_time: null,
            summary: description || `Technology event: ${title}`,
            full_description: description || `Technology event: ${title}`,
            is_online_event: venueName.toLowerCase().includes('online'),
            primary_venue: {
              name: venueName || 'TBD',
              address: {
                localized_address_display: venueName || 'TBD',
              },
            },
            image: {
              url: imageUrl,
            },
            ticket_info: {
              is_free: isFree,
              price: isFree ? 0 : parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0,
            },
            organizer: {
              name: organizerName || 'Unknown',
            },
          })
        } catch (error) {
          console.error(`Error extracting event ${i}:`, error)
        }
      }
      
      return events
    }, maxItems)
    
    console.log(`✅ [PUPPETEER] Scraped ${scrapedEvents.length} Eventbrite events`)
    
    if (scrapedEvents.length === 0) {
      console.warn(`⚠️ [PUPPETEER] No events found for ${city} - ${query}. Possible reasons:`)
      console.warn(`   - No events match the query`)
      console.warn(`   - Page structure changed (selectors not matching)`)
      console.warn(`   - Rate limited or blocked by Eventbrite`)
      console.warn(`   - Page didn't load properly`)
    }
    
    return scrapedEvents
    
  } catch (error) {
    console.error('❌ [PUPPETEER] Eventbrite scraping failed:', error)
    console.error('   Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      city,
      query
    })
    return []
  } finally {
    await browser.close()
  }
}

/**
 * Scrape Luma events using Puppeteer with stealth
 */
export async function scrapeLumaEventsPuppeteer(query: string, maxItems: number = 20): Promise<any[]> {
  const browser = await createBrowser()
  const events: any[] = []
  
  try {
    const page = await browser.newPage()
    await configurePage(page)
    
    console.log(`🔍 [PUPPETEER] Scraping Luma for: ${query}`)
    
    // Build search URL - Luma uses lu.ma domain
    const searchUrl = `https://lu.ma/explore?q=${encodeURIComponent(query)}`
    
    console.log(`🌐 [PUPPETEER] Navigating to: ${searchUrl}`)
    
    // Navigate with realistic timing - use domcontentloaded for faster loading
    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90000, // Increased timeout for Luma
    })
    
    // Wait for page to load and JavaScript to execute
    await delay(8000 + Math.random() * 3000) // 8-11 seconds (Luma needs more time)
    
    // Try to wait for content to appear
    try {
      await page.waitForSelector('body', { timeout: 10000 })
    } catch (e) {
      console.log('⚠️ [PUPPETEER] Body selector not found, continuing anyway...')
    }
    
    // Wait for events to load (Luma uses dynamic loading)
    console.log('⏳ [PUPPETEER] Waiting for Luma events to load...')
    try {
      // Wait for any event-related content
      await page.waitForFunction(
        () => {
          const bodyText = document.body.innerText || ''
          return bodyText.includes('Events') || bodyText.includes('event') || document.querySelectorAll('a[href*="/events/"]').length > 0
        },
        { timeout: 30000 }
      )
      console.log('✅ [PUPPETEER] Luma content detected')
    } catch (e) {
      console.log('⚠️ [PUPPETEER] Timeout waiting for content, continuing...')
    }
    
    // Scroll to load more content
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0
        const distance = 100
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= scrollHeight || totalHeight > 2000) {
            clearInterval(timer)
            resolve()
          }
        }, 100)
      })
    })
    
    await delay(3000)
    
    // Extract events with detailed logging
    const scrapedEvents = await page.evaluate((maxItems) => {
      const events: any[] = []
      const debug: any = {
        selectors: {} as Record<string, number>,
        foundElements: [] as string[],
        pageTitle: document.title,
        url: window.location.href,
      }
      
      // Try multiple selectors for Luma event cards
      // Luma uses dynamic rendering, so we need broader selectors
      const selectors = [
        'a[href*="/events/"]', // Most reliable - event links
        'a[href*="lu.ma/"]', // Alternative link format
        '[data-testid="event-card"]',
        'div[class*="event-card"]',
        'div[class*="EventCard"]',
        'article[class*="event"]',
        '[class*="Event"]',
        '[class*="Card"]',
        'article',
        'div[role="article"]',
        'div[class*="event"]', // Broader selector
        'a[href*="event"]', // Even broader
      ]
      
      let cards: NodeListOf<Element> | null = null
      
      // Test all selectors and log results
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector)
        debug.selectors[selector] = elements.length
        if (elements.length > 0 && !cards) {
          cards = elements
          debug.workingSelector = selector
        }
      }
      
      // Log page structure for debugging
      debug.bodyText = document.body.innerText.substring(0, 500)
      debug.hasEventText = document.body.innerText.toLowerCase().includes('event')
      
      if (!cards || cards.length === 0) {
        console.log('No event cards found. Debug info:', JSON.stringify(debug, null, 2))
        return { events, debug }
      }
      
      console.log(`Found ${cards.length} potential event elements`)
      const limit = Math.min(maxItems, cards.length)
      
      for (let i = 0; i < limit; i++) {
        const card = cards[i]
        
        try {
          // For Luma, try to find the actual event link within or near the card
          let linkEl = card.closest('a[href*="/events/"]') || 
                      card.querySelector('a[href*="/events/"]') ||
                      card.querySelector('a[href*="lu.ma"]') ||
                      (card.tagName === 'A' ? card : null)
          
          // If card itself is a link, use it
          if (!linkEl && card.tagName === 'A' && card.getAttribute('href')) {
            linkEl = card as HTMLAnchorElement
          }
          
          const href = linkEl?.getAttribute('href') || ''
          const fullUrl = href.startsWith('http') ? href : `https://lu.ma${href}`
          
          // Extract API ID from URL
          const apiIdMatch = href.match(/\/events\/([^\/\?]+)/) || href.match(/lu\.ma\/([^\/\?]+)/)
          const apiId = apiIdMatch?.[1] || `luma-${Date.now()}-${i}`
          
          // Extract title - try multiple approaches
          let title = ''
          const titleEl = card.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"], [data-testid="event-title"]') ||
                         (card as HTMLElement).querySelector('[class*="Title"]')
          
          if (titleEl) {
            title = titleEl.textContent?.trim() || ''
          } else {
            // Fallback: get text from card itself
            title = (card as HTMLElement).innerText?.trim() || 
                   (card as HTMLElement).textContent?.trim() || ''
            // Clean up title (remove extra whitespace, take first line)
            title = title.split('\n')[0].trim().substring(0, 200)
          }
          
          // Skip if no meaningful title
          if (!title || title.length < 3) {
            console.log(`Skipping card ${i}: no valid title found`)
            continue
          }
          
          // Extract date
          const dateEl = card.querySelector('[class*="date"], [class*="time"], [data-testid="event-date"]')
          const dateText = dateEl?.textContent?.trim() || ''
          
          // Extract image
          const imgEl = card.querySelector('img')
          const imageUrl = imgEl?.getAttribute('src') || 
                          imgEl?.getAttribute('data-src') || 
                          imgEl?.getAttribute('data-lazy-src') || ''
          
          // Extract price
          const priceEl = card.querySelector('[class*="price"], [class*="cost"], [data-testid="event-price"]')
          const priceText = priceEl?.textContent?.trim() || ''
          const isFree = priceText.toLowerCase().includes('free') || priceText === '' || priceText === '0'
          
          // Extract venue
          const venueEl = card.querySelector('[class*="venue"], [class*="location"], [data-testid="event-venue"]')
          const venueName = venueEl?.textContent?.trim() || ''
          
          // Extract host
          const hostEl = card.querySelector('[class*="host"], [class*="organizer"]')
          const hostName = hostEl?.textContent?.trim() || 'Unknown'
          
          console.log(`Extracted event ${i + 1}: ${title.substring(0, 50)}`)
          
          events.push({
            name: title,
            title: title,
            api_id: apiId,
            id: apiId,
            url: fullUrl || `https://lu.ma/${apiId}`,
            start_at: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            end_at: null,
            description_mirror: `Technology event: ${title}`,
            description: `Technology event: ${title}`,
            mainImageUrl: imageUrl,
            imageUrl: imageUrl,
            ticket_info: {
              is_free: isFree,
              price: isFree ? 0 : parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0,
            },
            hosts: [
              {
                name: hostName,
                bio_short: '',
              },
            ],
            event: {
              url: href || `/${apiId}`,
              geo_address_info: {
                city_state: venueName || 'TBD',
              },
              location_type: venueName.toLowerCase().includes('online') ? 'online' : 'in-person',
            },
          })
        } catch (error) {
          console.error(`Error extracting event ${i}:`, error)
        }
      }
      
      return { events, debug }
    }, maxItems)
    
    // Log debug info if no events found
    if (scrapedEvents.events && scrapedEvents.events.length === 0 && scrapedEvents.debug) {
      console.log('🔍 [PUPPETEER] Luma Debug Info:')
      console.log('   Selectors tested:', scrapedEvents.debug.selectors)
      console.log('   Working selector:', scrapedEvents.debug.workingSelector || 'None')
      console.log('   Page title:', scrapedEvents.debug.pageTitle)
      console.log('   Page URL:', scrapedEvents.debug.url)
      console.log('   Has "event" text:', scrapedEvents.debug.hasEventText)
      console.log('   Body text sample:', scrapedEvents.debug.bodyText?.substring(0, 200))
    }
    
    const events = scrapedEvents.events || scrapedEvents || []
    console.log(`✅ [PUPPETEER] Scraped ${events.length} Luma events`)
    
    return events
    
  } catch (error) {
    console.error('❌ [PUPPETEER] Luma scraping failed:', error)
    return []
  } finally {
    await browser.close()
  }
}

/**
 * Streaming version for Eventbrite (yields events as they're found)
 */
export async function* scrapeEventbriteEventsStreamingPuppeteer(city: string, query: string): AsyncGenerator<any, void, unknown> {
  const events = await scrapeEventbriteEventsPuppeteer(city, query, 50)
  for (const event of events) {
    yield event
  }
}

/**
 * Streaming version for Luma (yields events as they're found)
 */
export async function* scrapeLumaEventsStreamingPuppeteer(query: string, maxItems: number = 20): AsyncGenerator<any, void, unknown> {
  const events = await scrapeLumaEventsPuppeteer(query, maxItems)
  for (const event of events) {
    yield event
  }
}

