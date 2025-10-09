// import { Worker, Job } from 'bullmq'
// import { connection } from './redis'
// import { prisma } from './prisma'
// import puppeteer from 'puppeteer'

// // Direct scraping functions (following koolkishan pattern)
// async function scrapeEventbriteDirect(page: any, city: string): Promise<any[]> {
//   console.log(`🕷️ Starting Eventbrite scraping for ${city}`)
  
//   const searchUrl = `https://www.eventbrite.com/d/${city}/technology--events/?q=technology`
//   console.log(`🌐 Navigating to: ${searchUrl}`)
  
//   await page.goto(searchUrl, {
//     waitUntil: 'networkidle2',
//     timeout: 60000 
//   })
  
//   await new Promise(resolve => setTimeout(resolve, 5000))
  
//   // Extract events using page.evaluate()
//   const result = await page.evaluate((): { events: any[], debug: any } => {
//     const scrapedEvents: any[] = []
//     const debug = {
//       selectors: {} as Record<string, number>,
//       cardsProcessed: 0,
//       cardsSkipped: 0,
//       errors: [] as string[],
//       workingSelector: '',
//       totalCardsFound: 0
//     }

//     // Test selectors
//     const selectors = ['.event-card']
//     let eventCards = null
    
//     for (const selector of selectors) {
//       const elements = document.querySelectorAll(selector)
//       debug.selectors[selector] = elements.length
//       if (elements.length > 0 && !eventCards) {
//         eventCards = elements
//         debug.workingSelector = selector
//       }
//     }
    
//     debug.totalCardsFound = eventCards?.length || 0

//     if (eventCards && eventCards.length > 0) {
//       // Process first 10 cards
//       for (let i = 0; i < Math.min(10, eventCards.length); i++) {
//         const card = eventCards[i]
//         debug.cardsProcessed++
        
//         try {
//           const titleElement = card.querySelector('h3')
//           const title = titleElement?.textContent?.trim() || ''
          
//           if (!title || title.length < 3) {
//             debug.cardsSkipped++
//             debug.errors.push(`Card ${i}: No valid title found`)
//             continue
//           }
          
//           const linkElement = card.querySelector('a')
//           const externalUrl = linkElement?.getAttribute('href') || ''
//           const sourceId = externalUrl.split('/e/')[1]?.split('/')[0] || `eventbrite-${i}`
          
//           // Create event object
//           const event = {
//             title,
//             description: `Technology event: ${title}`,
//             eventType: 'workshop',
//             eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//             city: 'San Francisco',
//             country: 'US',
//             isOnline: false,
//             isFree: false,
//             priceMin: 0,
//             priceMax: 0,
//             currency: 'USD',
//             organizerName: 'Eventbrite Organizer',
//             organizerDescription: 'Professional event organizer',
//             organizerRating: undefined,
//             capacity: undefined,
//             registeredCount: 0,
//             techStack: ['AI', 'Technology'],
//             qualityScore: 0.8,
//             externalUrl,
//             imageUrl: '',
//             sourcePlatform: 'eventbrite',
//             sourceId,
//             scrapedAt: new Date(),
//             lastUpdated: new Date()
//           }
          
//           scrapedEvents.push(event)
//           debug.errors.push(`Card ${i}: Created event "${title}"`)
          
//         } catch (error) {
//           debug.errors.push(`Card ${i}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`)
//         }
//       }
//     }
    
//     return { events: scrapedEvents, debug }
//   })
  
//   // Log debug information
//   console.log('🔍 Eventbrite scraping debug results:')
//   console.log('  - Selector results:', result.debug.selectors)
//   console.log('  - Working selector:', result.debug.workingSelector)
//   console.log('  - Total cards found:', result.debug.totalCardsFound)
//   console.log('  - Cards processed:', result.debug.cardsProcessed)
//   console.log('  - Cards skipped:', result.debug.cardsSkipped)
//   console.log('  - Errors:', result.debug.errors)
//   console.log('  - Events extracted:', result.events.length)
  
//   console.log(`✅ Successfully scraped ${result.events.length} events from Eventbrite`)
//   return result.events
// }

// async function scrapeMeetupDirect(page: any, city: string): Promise<any[]> {
//   console.log(`🕷️ Starting Meetup scraping for ${city}`)
//   // TODO: Implement Meetup scraping
//   return []
// }

// async function scrapeLumaDirect(page: any, city: string): Promise<any[]> {
//   console.log(`🕷️ Starting Luma scraping for ${city}`)
//   // TODO: Implement Luma scraping
//   return []
// }

// // Production-ready worker following official BullMQ patterns
// export const eventScrapingWorker = new Worker(
//   'eventScraping',
//   async (job: Job) => {
//     console.log('🚀 WORKER: Starting job processing with NEW CODE!')
//     const { platform, city, jobId } = job.data
    
//     try {
//       // Update job status to processing
//       await prisma.scrapingJob.update({
//         where: { id: jobId },
//         data: { 
//           status: 'processing',
//           startedAt: new Date(),
//         }
//       })

//       // Report progress
//       await job.updateProgress(10)
//       console.log(`🔄 Processing scraping job for ${platform} in ${city}`)

//       // Import scraping functions dynamically to avoid circular dependencies
//       let eventsScraped = 0
      
//       // Import Puppeteer for scraping
//       const puppeteer = await import('puppeteer')
//       const browser = await puppeteer.launch({
//         headless: true,
//         args: ['--no-sandbox', '--disable-setuid-sandbox']
//       })
      
//       try {
//         const page = await browser.newPage()
//         await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
//         let scrapedEvents: any[] = []
        
//         // Handle scraping logic directly in worker (following koolkishan pattern)
//         switch (platform) {
//           case 'eventbrite':
//             scrapedEvents = await scrapeEventbriteDirect(page, city)
//             break
//           case 'meetup':
//             scrapedEvents = await scrapeMeetupDirect(page, city)
//             break
//           case 'luma':
//             scrapedEvents = await scrapeLumaDirect(page, city)
//             break
//           default:
//             throw new Error(`Unknown platform: ${platform}`)
//         }

//         // Normalize and validate scraped data
//         const { EventDataNormalizer, deduplicateEvents, validateEventData } = await import('../scraping/dataNormalization')
        
//         const normalizedEvents = scrapedEvents.map(event => EventDataNormalizer.normalizeEvent(event))
//         const deduplicatedEvents = deduplicateEvents(normalizedEvents)
        
//         // Save valid events to database
//         let savedCount = 0
//         console.log(`🔍 Processing ${deduplicatedEvents.length} deduplicated events...`)
        
//         for (const event of deduplicatedEvents) {
//           console.log(`🔍 Processing event: ${event.title}`)
//           console.log(`🔍 Event date: ${event.eventDate}`)
//           console.log(`🔍 Event city: ${event.city}`)
//           console.log(`🔍 Event sourcePlatform: ${event.sourcePlatform}`)
//           console.log(`🔍 Event sourceId: ${event.sourceId}`)
          
//           const validation = validateEventData(event)
//           console.log(`🔍 Validation result:`, validation)
          
//           if (validation.isValid) {
//             try {
//               await prisma.event.create({
//                 data: {
//                   title: event.title,
//                   description: event.description,
//                   eventType: 'workshop', // Default type, would be determined by analysis
//                   eventDate: event.eventDate,
//                   eventEndDate: event.eventEndDate,
//                   venueName: event.venueName,
//                   venueAddress: event.venueAddress,
//                   city: event.city,
//                   country: event.country,
//                   isOnline: event.isOnline,
//                   isFree: event.isFree,
//                   priceMin: event.priceMin,
//                   priceMax: event.priceMax,
//                   currency: event.currency,
//                   organizerName: event.organizerName,
//                   organizerDescription: event.organizerDescription,
//                   capacity: event.capacity,
//                   registeredCount: event.registeredCount,
//                   techStack: event.techStack,
//                   externalUrl: event.externalUrl,
//                   imageUrl: event.imageUrl,
//                   sourcePlatform: event.sourcePlatform,
//                   sourceId: event.sourceId,
//                   scrapedAt: new Date(),
//                 },
//               })
//               savedCount++
//             } catch (error) {
//               console.error('Failed to save event:', error)
//               // Continue with other events even if one fails
//             }
//           } else {
//             console.warn('Invalid event data:', validation.errors)
//           }
//         }
        
//         eventsScraped = savedCount
//       } finally {
//         await browser.close()
//       }

//       // Report progress
//       await job.updateProgress(90)

//       // Update job status to completed
//       await prisma.scrapingJob.update({
//         where: { id: jobId },
//         data: { 
//           status: 'completed',
//           completedAt: new Date(),
//           eventsScraped,
//         },
//       })

//       // Report final progress
//       await job.updateProgress(100)
      
//       return { 
//         success: true, 
//         eventsScraped,
//         platform,
//         city 
//       }
      
//     } catch (error) {
//       // Update job status to failed
//       await prisma.scrapingJob.update({
//         where: { id: jobId },
//         data: { 
//           status: 'failed',
//           completedAt: new Date(),
//           errorMessage: error instanceof Error ? error.message : 'Unknown error',
//         },
//       })
      
//       throw error // Re-throw to trigger BullMQ retry mechanism
//     }
//   },
//   {
//     connection,
//     concurrency: 2, // Process up to 2 jobs concurrently
//   }
// )

// // Production error handling for worker
// eventScrapingWorker.on('error', (err) => {
//   console.error('Event scraping worker error:', err)
//   // In production, send to monitoring service
// })

// eventScrapingWorker.on('completed', (job, returnvalue) => {
//   console.log(`✅ Scraping job ${job.id} completed:`, returnvalue)
// })

// eventScrapingWorker.on('failed', (job, err) => {
//   console.error(`❌ Scraping job ${job?.id} failed:`, err.message)
//   // In production, send to error monitoring service
// })

// eventScrapingWorker.on('progress', (job, progress) => {
//   console.log(`📊 Job ${job.id} progress: ${progress}%`)
// })

// // Graceful shutdown handling
// process.on('SIGINT', async () => {
//   console.log('🔄 Gracefully closing event scraping worker...')
//   await eventScrapingWorker.close()
// })

// process.on('SIGTERM', async () => {
//   console.log('🔄 Gracefully closing event scraping worker...')
//   await eventScrapingWorker.close()
// })
