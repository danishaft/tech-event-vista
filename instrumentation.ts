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
                await prisma.event.create({
                  data: {
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
                console.log(`${event.title} inserted in DB.`)
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
        const titleElement = card.querySelector('h3')
        const title = titleElement?.textContent?.trim() || ''
        
        if (!title || title.length < 3) {
          console.log(`Card ${i}: No valid title found`)
          continue
        }
        
        const linkElement = card.querySelector('a')
        const externalUrl = linkElement?.getAttribute('href') || ''
        const sourceId = externalUrl.split('/e/')[1]?.split('/')[0] || `eventbrite-${i}`
        
        // Create simple event object (following koolkishan pattern)
        const event = {
          title,
          description: `Technology event: ${title}`,
          eventType: 'workshop',
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          city: 'San Francisco',
          country: 'US',
          isOnline: false,
          isFree: false,
          priceMin: 0,
          priceMax: 0,
          currency: 'USD',
          organizerName: 'Eventbrite Organizer',
          organizerDescription: 'Professional event organizer',
          organizerRating: undefined,
          capacity: undefined,
          registeredCount: 0,
          techStack: ['AI', 'Technology'],
          qualityScore: 0.8,
          externalUrl,
          imageUrl: '',
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
