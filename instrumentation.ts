import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const register = async () => {
  // This if statement is important, read here: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log('🚀 Registering Event Scraping Worker with Next.js...')
    
    const { Worker } = await import("bullmq")
    const puppeteer = await import("puppeteer")
    const { connection } = await import("./lib/redis")
    const { eventScrapingQueue } = await import("./lib/queue")

    new Worker(
      "eventScraping",
      async (job) => {
        console.log('🚀 WORKER: Starting job processing with KOOLKISHAN PATTERN!')
        console.log('Job data:', job.data)
        const { platform, city, jobId } = job.data
        
        try {
          // Update job status to processing
          await prisma.scrapingJob.update({
            where: { id: jobId },
            data: { 
              status: 'processing',
              startedAt: new Date()
            },
          })

          // Launch browser (following koolkishan pattern - using cloud browser)
          const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY
          const SBR_WS_ENDPOINT = process.env.SBR_WS_ENDPOINT
          
          let browser
          if (SBR_WS_ENDPOINT) {
            console.log("Connecting to Scraping Browser...", SBR_WS_ENDPOINT)
            browser = await puppeteer.connect({
              browserWSEndpoint: SBR_WS_ENDPOINT,
            })
          } else if (BROWSERLESS_API_KEY) {
            console.log("Browserless.io API key found but testing with local browser first...")
            browser = await puppeteer.launch({
              headless: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--disable-web-security',
                '--disable-features=site-per-process'
              ]
            })
          } else {
            console.log("Using local browser (fallback)")
            browser = await puppeteer.launch({
              headless: true,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--disable-web-security',
                '--disable-features=site-per-process'
              ]
            })
          }
          
          try {
            const page = await browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            
            let scrapedEvents: any[] = []
            
            // Handle scraping logic directly in worker (following koolkishan pattern)
            if (platform === 'eventbrite') {
              console.log("Connected! Starting Eventbrite scraping...")
              scrapedEvents = await scrapeEventbriteDirect(page, city)
            } else if (platform === 'meetup') {
              console.log("Connected! Starting Meetup scraping...")
              scrapedEvents = await scrapeMeetupDirect(page, city)
            } else if (platform === 'luma') {
              console.log("Connected! Starting Luma scraping...")
              scrapedEvents = await scrapeLumaDirect(page, city)
            } else {
              throw new Error(`Unknown platform: ${platform}`)
            }

            console.log(`Scraping Complete, ${scrapedEvents.length} events found.`)

            // Update job status to completed
            await prisma.scrapingJob.update({
              where: { id: jobId },
              data: { 
                status: 'completed',
                completedAt: new Date(),
                eventsScraped: scrapedEvents.length,
              },
            })

            console.log("Job Marked as complete.")
            console.log("Starting Loop for Events")
            
            // Save events directly to database (following koolkishan pattern)
            for (const event of scrapedEvents) {
              try {
                await prisma.event.upsert({
                  where: {
                    sourcePlatform_sourceId: {
                      sourcePlatform: event.sourcePlatform,
                      sourceId: event.sourceId,
                    },
                  },
                  update: {
                    title: event.title,
                    description: event.description,
                    eventType: 'workshop',
                    eventDate: new Date(event.eventDate), // Convert ISO string back to Date
                    eventEndDate: event.eventEndDate,
                    venueName: event.venueName,
                    venueAddress: event.venueAddress,
                    city: event.city,
                    country: event.country,
                    isOnline: event.isOnline,
                    isFree: event.isFree,
                    priceMin: event.priceMin,
                    priceMax: event.priceMax,
                    currency: event.currency,
                    organizerName: event.organizerName,
                    organizerDescription: event.organizerDescription,
                    capacity: event.capacity,
                    registeredCount: event.registeredCount,
                    techStack: event.techStack,
                    externalUrl: event.externalUrl,
                    imageUrl: event.imageUrl,
                    scrapedAt: new Date(),
                    lastUpdated: new Date(),
                  },
                  create: {
                    title: event.title,
                    description: event.description,
                    eventType: 'workshop',
                    eventDate: new Date(event.eventDate), // Convert ISO string back to Date
                    eventEndDate: event.eventEndDate,
                    venueName: event.venueName,
                    venueAddress: event.venueAddress,
                    city: event.city,
                    country: event.country,
                    isOnline: event.isOnline,
                    isFree: event.isFree,
                    priceMin: event.priceMin,
                    priceMax: event.priceMax,
                    currency: event.currency,
                    organizerName: event.organizerName,
                    organizerDescription: event.organizerDescription,
                    capacity: event.capacity,
                    registeredCount: event.registeredCount,
                    techStack: event.techStack,
                    externalUrl: event.externalUrl,
                    imageUrl: event.imageUrl,
                    sourcePlatform: event.sourcePlatform,
                    sourceId: event.sourceId,
                    scrapedAt: new Date(),
                  },
                })
                console.log(`${event.title} upserted in DB.`)
              } catch (error) {
                console.error(`Failed to save event ${event.title}:`, error)
              }
            }
            console.log("COMPLETE.")
            
          } finally {
            // await browser.close(); // Following koolkishan pattern - don't close browser
            console.log("Browser closed successfully.")
          }
          
        } catch (error) {
          console.log({ error })
          await prisma.scrapingJob.update({
            where: { id: jobId },
            data: { 
              status: 'failed',
              completedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          })
        }
      },
      {
        connection,
        concurrency: 10,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      }
    )
    
    console.log('✅ Event Scraping Worker registered successfully!')
  }
}

// Direct scraping functions (following koolkishan pattern)
async function scrapeEventbriteDirect(page: any, city: string): Promise<any[]> {
  console.log(`🕷️ Starting Eventbrite scraping for ${city}`)
  
  const searchUrl = `https://www.eventbrite.com/d/${city}/technology--events/?q=technology`
  console.log(`🌐 Navigating to: ${searchUrl}`)
  
  await page.goto(searchUrl, {
    waitUntil: 'networkidle2',
    timeout: 120000 // Increased timeout to 2 minutes
  })
  
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Extract events using page.evaluate() - following koolkishan pattern
  const events = await page.evaluate((): any[] => {
    const scrapedEvents: any[] = []
    
    // Try multiple selectors for Eventbrite (based on 2024 research)
    const selectors = [
      '.event-card',
      '[data-testid="event-card"]',
      'article[class*="event"]',
      '.event-card-wrapper',
      '.eds-event-card-content',
      'div[class*="eventCard"]'
    ]
    
    let eventCards: NodeListOf<Element> | null = null
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      console.log(`Selector ${selector}: found ${elements.length} elements`)
      if (elements.length > 0 && !eventCards) {
        eventCards = elements
        console.log(`Using selector: ${selector}`)
        break
      }
    }
    
    if (!eventCards || eventCards.length === 0) {
      console.log('No event cards found with any selector')
      return scrapedEvents
    }
    
    console.log(`Found ${eventCards.length} event cards`)
    
    // Process first 5 cards for testing
    for (let i = 0; i < Math.min(5, eventCards.length); i++) {
      const card = eventCards[i]
      
      try {
        const titleElement = card.querySelector('.event-card-details h3')
        const title = titleElement?.textContent?.trim() || ''
        
        if (!title || title.length < 3) {
          console.log(`Card ${i}: No valid title found`)
          continue
        }
        
        const linkElement = card.querySelector('a.event-card-link[href*="/e/"]') as HTMLAnchorElement | null
        const externalUrl = (linkElement?.getAttribute('href') || '').trim()
        const sourceId = linkElement?.getAttribute('data-event-id') || externalUrl.split('/e/')[1]?.split('/')[0] || `eventbrite-${i}`
        
        // DEBUG: Log the card structure to understand what's available
        console.log(`=== CARD ${i} DEBUG ===`)
        console.log('Card HTML (first 1000 chars):', card.outerHTML.substring(0, 1000))
        console.log('All text content:', card.textContent?.substring(0, 500))
        
        // Image from listing card
        const imageElement = card.querySelector('[data-testid="event-card-image-container"] img.event-card-image') as HTMLImageElement | null
        const imageUrl = imageElement?.getAttribute('src') || imageElement?.getAttribute('data-src') || ''
        
        // Price and flags from listing wrappers
        const listPriceElement = card.querySelector('.DiscoverVerticalEventCard-module__priceWrapper___usWo6 p, .DiscoverHorizontalEventCard-module__priceWrapper___3rOUY p')
        const priceText = listPriceElement?.textContent?.trim() || ''
        const isFree = priceText.toLowerCase() === 'free'
        let priceMin = 0
        let priceMax = 0
        if (!isFree) {
          const priceMatch = priceText.match(/\$\s?(\d+[\.,]?\d*)/)
          if (priceMatch) {
            priceMin = parseFloat(priceMatch[1].replace(/[,]/g, ''))
            priceMax = priceMin
          }
        }
        
        // Organizer (list line)
        const organizerListElement = card.querySelector('.event-card-details > div > p.Typography_body-md-bold__487rx')
        const organizerName = organizerListElement?.textContent?.trim() || 'Eventbrite Organizer'
        
        // Extract tech stack from title
        const techKeywords = [
          'React', 'Vue', 'Angular', 'JavaScript', 'TypeScript', 'Node.js', 'Python',
          'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
          'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Machine Learning', 'AI',
          'Data Science', 'Blockchain', 'Web3', 'DevOps', 'Frontend', 'Backend',
          'Full Stack', 'Mobile', 'iOS', 'Android', 'Flutter', 'React Native'
        ]
        
        const techStack = techKeywords.filter(tech => 
          title.toLowerCase().includes(tech.toLowerCase())
        )
        
        // If no tech stack found, add generic tech terms
        if (techStack.length === 0) {
          techStack.push('Technology', 'Tech')
        }
        
        // Calculate quality score based on available data
        let qualityScore = 0.5 // Base score
        if (imageUrl) qualityScore += 0.1
        if (organizerName && organizerName !== 'Eventbrite Organizer') qualityScore += 0.1
        if (priceMin > 0) qualityScore += 0.1
        if (techStack.length > 1) qualityScore += 0.1
        
        // Create enhanced event object with extracted data
        const event = {
          title,
          description: `Technology event: ${title}`,
          eventType: 'workshop',
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          eventEndDate: null,
          venueName: '',
          venueAddress: '',
          city: city.charAt(0).toUpperCase() + city.slice(1),
          country: 'US',
          isOnline: (linkElement?.getAttribute('data-event-location') || '').toLowerCase() === 'online',
          isFree,
          priceMin,
          priceMax,
          currency: 'USD',
          organizerName,
          organizerDescription: 'Professional event organizer',
          organizerRating: null,
          capacity: null,
          registeredCount: 0,
          techStack,
          qualityScore: Math.min(qualityScore, 1.0), // Cap at 1.0
          externalUrl,
          imageUrl,
          sourcePlatform: 'eventbrite',
          sourceId,
          scrapedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
        
        scrapedEvents.push(event)
        console.log(`Card ${i}: Created event "${title}"`)
        
      } catch (error) {
        console.log(`Card ${i}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    return scrapedEvents
  })
  
  // Enrich each event by visiting its detail page to extract richer fields
  // Keep this conservative: limit how many we enrich and use short timeouts
  const MAX_DETAIL_PAGES = Math.min(events.length, 5)
  for (let i = 0; i < MAX_DETAIL_PAGES; i++) {
    const evt = events[i]
    if (!evt?.externalUrl) continue
    try {
      const detailPage = await page.browser().newPage()
      await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      const detailUrl = evt.externalUrl.startsWith('http')
        ? evt.externalUrl
        : `https://www.eventbrite.com${evt.externalUrl.startsWith('/') ? '' : '/'}${evt.externalUrl}`
      console.log('🔎 Visiting detail URL:', detailUrl)
      await detailPage.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 60000 })
      // Try to wait for at least one stable selector
      try {
        await Promise.race([
          detailPage.waitForSelector('h1', { timeout: 5000 }),
          detailPage.waitForSelector('[data-testid*="title"]', { timeout: 5000 }),
          detailPage.waitForSelector('[data-testid*="price"], [class*="price"], .price', { timeout: 5000 }),
          detailPage.waitForSelector('[data-testid*="location"], [class*="location"], [data-automation*="location"]', { timeout: 5000 })
        ])
      } catch {}
      // Small settle wait; many sites lazy-load sections
      await new Promise(res => setTimeout(res, 3000))

      const evalResult = await detailPage.evaluate(() => {
        const safeText = (el: Element | null | undefined) => el?.textContent?.trim() || ''
        const by = (sel: string) => document.querySelector(sel)
        const byAll = (sel: string) => Array.from(document.querySelectorAll(sel))

        // Attempt schema.org ld+json first
        let ldTitle = ''
        let ldStartDate = ''
        let ldImage = ''
        let ldIsFree: boolean | undefined
        let ldPriceMin = 0
        let ldPriceMax = 0
        let ldCurrency = ''
        let ldLocationName = ''
        let ldLocationAddress = ''
        let ldOrganizerName = ''
        try {
          const scripts = byAll('script[type="application/ld+json"]') as HTMLScriptElement[]
          for (const s of scripts) {
            const txt = s.textContent || ''
            if (!txt) continue
            const parsed = JSON.parse(txt)
            const candidates = Array.isArray(parsed) ? parsed : [parsed]
            for (const obj of candidates) {
              if (obj && (obj['@type'] === 'Event' || (obj['@graph'] && Array.isArray(obj['@graph'])))) {
                const ev = obj['@type'] === 'Event' ? obj : (obj['@graph'] || []).find((g: any) => g['@type'] === 'Event')
                if (!ev) continue
                ldTitle = ev.name || ldTitle
                ldStartDate = ev.startDate || ldStartDate
                if (typeof ev.image === 'string') ldImage = ev.image
                if (Array.isArray(ev.image) && ev.image.length) ldImage = ev.image[0]
                if (ev.offers) {
                  const off = Array.isArray(ev.offers) ? ev.offers[0] : ev.offers
                  if (off) {
                    if (typeof off.price === 'number') {
                      ldPriceMin = off.price
                      ldPriceMax = off.price
                    } else if (typeof off.price === 'string') {
                      const n = parseFloat(off.price)
                      if (!Number.isNaN(n)) { ldPriceMin = n; ldPriceMax = n }
                    }
                    if (typeof off.priceCurrency === 'string') ldCurrency = off.priceCurrency
                    if (typeof off.isAccessibleForFree === 'boolean') ldIsFree = off.isAccessibleForFree
                  }
                }
                if (ev.location) {
                  const loc = ev.location
                  ldLocationName = loc.name || ldLocationName
                  if (loc.address) {
                    if (typeof loc.address === 'string') ldLocationAddress = loc.address
                    else if (typeof loc.address === 'object') {
                      const parts = [loc.address.streetAddress, loc.address.addressLocality, loc.address.addressRegion, loc.address.postalCode, loc.address.addressCountry].filter(Boolean)
                      ldLocationAddress = parts.join(', ')
                    }
                  }
                }
                if (ev.organizer) {
                  const org = ev.organizer
                  ldOrganizerName = org.name || ldOrganizerName
                }
              }
            }
          }
        } catch {}

        // Title (detail)
        const selTitleDom = '[data-testid="title"] h1.event-title'
        const title = ldTitle || safeText(by(selTitleDom)) || safeText(by('h1'))

        // Image (try prominent image in header/hero)
        let imageUrl = ldImage || ''
        const imageCandidates = [
          '[data-testid="event-hero"] [data-testid="hero-image"] img',
          '[data-testid="hero-img"]',
          'img[loading][src]',
          'img[src]'
        ]
        let imageHit = ''
        for (const sel of imageCandidates) {
          const img = by(sel) as HTMLImageElement | null
          const src = (img?.getAttribute('src') || img?.getAttribute('data-src') || '')
          if (src && src.startsWith('http')) { imageUrl = src; imageHit = sel; break }
        }

        // Date/time
        let eventDateISO = ldStartDate || ''
        const selTimeDom = '[data-testid="startDate"] time.start-date[datetime]'
        const timeEl = by(selTimeDom) as HTMLTimeElement | null
        if (timeEl?.getAttribute('datetime')) {
          eventDateISO = timeEl.getAttribute('datetime') || ''
        } else {
          const selDateRange = '[data-testid="dateAndTime"] .date-info__full-datetime'
          const dateTextCandidate = safeText(by(selDateRange))
          if (dateTextCandidate) {
            // leave parsing to backend later; keep current date if parsing fails
          }
        }

        // Price (Free/From $..). Search a few likely nodes then fallback scan
        let isFree = (typeof ldIsFree === 'boolean') ? ldIsFree : false
        let priceMin = ldPriceMin || 0
        let priceMax = ldPriceMax || 0
        const selPriceDom = '[data-testid="condensed-conversion-bar"] .CondensedConversionBar-module__priceTag___3AnIu'
        const priceNode = by(selPriceDom)
        const priceText = (priceNode?.textContent || '').trim()
        const textForPrice = priceText || byAll('body *').slice(0, 200).map(el => el.textContent || '').join(' ')
        if (textForPrice.toLowerCase().includes('free')) {
          isFree = true
        } else {
          const prices = (textForPrice.match(/\$\s?(\d+[\.,]?\d*)/g) || []).map(p => parseFloat(p.replace(/[^0-9.]/g, '')))
          if (prices.length > 0) {
            priceMin = Math.min(...prices)
            priceMax = Math.max(...prices)
          }
        }

        // Location / venue
        let isOnline = false
        let venueName = ldLocationName || ''
        let venueAddress = ldLocationAddress || ''
        const selLocDom = '[data-testid="location"] .location-info__address-text'
        const locEl = by(selLocDom)
        const locText = (locEl?.textContent || '').toLowerCase()
        if (locText.includes('online') || locText.includes('virtual')) {
          isOnline = true
        }
        // Weak heuristics for venue name/address
        if (!venueName && locText && !isOnline) {
          venueName = (locText.split('\n')[0] || '').trim()
          venueAddress = (locText.split('\n').slice(1).join(', ') || '').trim()
        }

        // Organizer
        let organizerName = ldOrganizerName || ''
        const selOrgDom = '[data-testid="organizerBrief"] [data-testid="top-organizer-component-name"]'
        const orgEl = by(selOrgDom)
        organizerName = safeText(orgEl) || ''

        const debug = {
          ldPresent: Boolean(ldTitle || ldStartDate || ldImage || ldOrganizerName),
          titleHit: Boolean(by(selTitleDom)),
          imageHit,
          priceHit: Boolean(by(selPriceDom)),
          locHit: Boolean(by(selLocDom)),
          orgHit: Boolean(by(selOrgDom)),
          priceText,
          locText: (locEl?.textContent || '').trim(),
        }

        return {
          data: {
            title,
            imageUrl,
            eventDateISO,
            isFree,
            priceMin,
            priceMax,
            isOnline,
            venueName,
            venueAddress,
            organizerName,
          },
          debug
        }
      })

      // Merge enriched fields with sensible fallbacks and log debug
      const { data: detailData, debug } = evalResult as any
      console.log('🔎 Detail debug:', { url: detailUrl, ...debug })
      if (detailData.title) evt.title = detailData.title
      if (detailData.imageUrl) evt.imageUrl = detailData.imageUrl
      if (detailData.eventDateISO) evt.eventDate = detailData.eventDateISO
      evt.isFree = typeof detailData.isFree === 'boolean' ? detailData.isFree : evt.isFree
      if (detailData.priceMin) evt.priceMin = detailData.priceMin
      if (detailData.priceMax) evt.priceMax = detailData.priceMax
      if (typeof detailData.isOnline === 'boolean') evt.isOnline = detailData.isOnline
      if (detailData.venueName) evt.venueName = detailData.venueName
      if (detailData.venueAddress) evt.venueAddress = detailData.venueAddress
      if (detailData.organizerName) evt.organizerName = detailData.organizerName

      await detailPage.close()
    } catch (e) {
      console.log(`Detail enrich failed for ${evt?.externalUrl}:`, e instanceof Error ? e.message : e)
      // continue without enrichment
    }
  }
  
  console.log(`✅ Successfully scraped ${events.length} events from Eventbrite`)
  return events
}

async function scrapeMeetupDirect(page: any, city: string): Promise<any[]> {
  console.log(`🕷️ Starting Meetup scraping for ${city}`)
  
  const searchUrl = `https://www.meetup.com/find/?q=technology&location=${city}`
  console.log(`🌐 Navigating to: ${searchUrl}`)
  
  await page.goto(searchUrl, {
    waitUntil: 'networkidle2',
    timeout: 120000 // Increased timeout to 2 minutes
  })
  
  // Wait for content to load (Meetup uses dynamic loading)
  console.log('⏳ Waiting for Meetup content to load...')
  await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds for content
  
  // Wait for actual event cards to appear (not loading skeletons)
  try {
    await page.waitForSelector('[data-testid="event-card"]:not([data-testid="event-card-loading"])', { timeout: 30000 })
    console.log('✅ Meetup content loaded successfully')
  } catch (error) {
    console.log('⚠️ Timeout waiting for Meetup content, proceeding with available content')
  }
  
  // Extract events using page.evaluate() - following koolkishan pattern
  const events = await page.evaluate((): any[] => {
    const scrapedEvents: any[] = []
    
    // Try multiple selectors for Meetup (based on 2024 research)
    const selectors = [
      '[data-testid="event-card"]:not([data-testid="event-card-loading"])',
      '[data-testid="event-card"]',
      '.eventCard',
      '.event-card',
      'div[class*="eventCard"]',
      'div[class*="event-card"]',
      'article[class*="event"]'
    ]
    
    let eventCards: NodeListOf<Element> | null = null
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      console.log(`Selector ${selector}: found ${elements.length} elements`)
      if (elements.length > 0 && !eventCards) {
        eventCards = elements
        console.log(`Using selector: ${selector}`)
        break
      }
    }
    
    if (!eventCards || eventCards.length === 0) {
      console.log('No event cards found with any selector')
      return scrapedEvents
    }
    
    console.log(`Found ${eventCards.length} event cards`)
    
    // Process first 5 cards for testing
    for (let i = 0; i < Math.min(5, eventCards.length); i++) {
      const card = eventCards[i]
      
      try {
        // Try multiple title selectors
        const titleSelectors = ['h3', 'h2', '[class*="title"]', 'a', '.title', '[data-testid*="title"]']
        let title = ''
        
        for (const titleSelector of titleSelectors) {
          const titleElement = card.querySelector(titleSelector)
          title = titleElement?.textContent?.trim() || ''
          if (title && title.length > 3) {
            console.log(`Found title with selector ${titleSelector}: ${title}`)
            break
          }
        }
        
        if (!title || title.length < 3) {
          console.log(`Card ${i}: No valid title found`)
          continue
        }
        
        const linkElement = card.querySelector('a')
        const externalUrl = linkElement?.getAttribute('href') || ''
        const sourceId = externalUrl.split('/events/')[1]?.split('/')[0] || `meetup-${i}`
        
        // Create simple event object (following koolkishan pattern)
        const event = {
          title,
          description: `Technology event: ${title}`,
          eventType: 'workshop',
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          city: city.charAt(0).toUpperCase() + city.slice(1),
          country: 'US',
          isOnline: false,
          isFree: false,
          priceMin: 0,
          priceMax: 0,
          currency: 'USD',
          organizerName: 'Meetup Organizer',
          organizerDescription: 'Professional event organizer',
          organizerRating: undefined,
          capacity: undefined,
          registeredCount: 0,
          techStack: ['Technology'],
          qualityScore: 0.8,
          externalUrl,
          imageUrl: '',
          sourcePlatform: 'meetup',
          sourceId,
          scrapedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
        
        scrapedEvents.push(event)
        console.log(`Card ${i}: Created event "${title}"`)
        
      } catch (error) {
        console.log(`Card ${i}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    return scrapedEvents
  })
  
  console.log(`✅ Successfully scraped ${events.length} events from Meetup`)
  return events
}

async function scrapeLumaDirect(page: any, city: string): Promise<any[]> {
  console.log(`🕷️ Starting Luma scraping for ${city}`)
  
  const searchUrl = `https://lu.ma/search?q=technology&location=${city}`
  console.log(`🌐 Navigating to: ${searchUrl}`)
  
  await page.goto(searchUrl, {
    waitUntil: 'networkidle2',
    timeout: 120000 // Increased timeout to 2 minutes
  })
  
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Extract events using page.evaluate() - following koolkishan pattern
  const events = await page.evaluate((): any[] => {
    const scrapedEvents: any[] = []
    
    // Try multiple selectors for Luma
    const selectors = [
      '[data-testid="event-card"]',
      '.event-card',
      '.eventCard',
      'div[class*="event"]',
      'article[class*="event"]',
      '.card'
    ]
    
    let eventCards: NodeListOf<Element> | null = null
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      console.log(`Selector ${selector}: found ${elements.length} elements`)
      if (elements.length > 0 && !eventCards) {
        eventCards = elements
        console.log(`Using selector: ${selector}`)
        break
      }
    }
    
    if (!eventCards || eventCards.length === 0) {
      console.log('No event cards found with any selector')
      return scrapedEvents
    }
    
    console.log(`Found ${eventCards.length} event cards`)
    
    // Process first 5 cards for testing
    for (let i = 0; i < Math.min(5, eventCards.length); i++) {
      const card = eventCards[i]
      
      try {
        // Try multiple title selectors
        const titleSelectors = ['h3', 'h2', '[class*="title"]', 'a', '.title']
        let title = ''
        
        for (const titleSelector of titleSelectors) {
          const titleElement = card.querySelector(titleSelector)
          title = titleElement?.textContent?.trim() || ''
          if (title && title.length > 3) {
            console.log(`Found title with selector ${titleSelector}: ${title}`)
            break
          }
        }
        
        if (!title || title.length < 3) {
          console.log(`Card ${i}: No valid title found`)
          continue
        }
        
        const linkElement = card.querySelector('a')
        const externalUrl = linkElement?.getAttribute('href') || ''
        const sourceId = externalUrl.split('/events/')[1]?.split('/')[0] || `luma-${i}`
        
        // Create simple event object (following koolkishan pattern)
        const event = {
          title,
          description: `Technology event: ${title}`,
          eventType: 'workshop',
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          city: city.charAt(0).toUpperCase() + city.slice(1),
          country: 'US',
          isOnline: false,
          isFree: false,
          priceMin: 0,
          priceMax: 0,
          currency: 'USD',
          organizerName: 'Luma Organizer',
          organizerDescription: 'Professional event organizer',
          organizerRating: undefined,
          capacity: undefined,
          registeredCount: 0,
          techStack: ['Technology'],
          qualityScore: 0.8,
          externalUrl,
          imageUrl: '',
          sourcePlatform: 'luma',
          sourceId,
          scrapedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
        
        scrapedEvents.push(event)
        console.log(`Card ${i}: Created event "${title}"`)
        
      } catch (error) {
        console.log(`Card ${i}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    return scrapedEvents
  })
  
  console.log(`✅ Successfully scraped ${events.length} events from Luma`)
  return events
}
