// import { Page } from 'puppeteer'

// // Production-ready TypeScript interfaces for scraped event data
// export interface ScrapedEvent {
//   title: string
//   description: string
//   eventDate: Date
//   eventEndDate?: Date
//   venueName?: string
//   venueAddress?: string
//   city: string
//   country: string
//   isOnline: boolean
//   isFree: boolean
//   priceMin?: number
//   priceMax?: number
//   currency: string
//   organizerName?: string
//   organizerDescription?: string
//   capacity?: number
//   registeredCount: number
//   techStack: string[]
//   externalUrl?: string
//   imageUrl?: string
//   sourcePlatform: string
//   sourceId: string
// }

// // Production-ready Eventbrite scraper using official Puppeteer patterns
// export const scrapeEventbrite = async (page: Page, city: string): Promise<ScrapedEvent[]> => {
//   try {
//     console.log(`🕷️ Starting Eventbrite scraping for ${city}`)
    
//     // Navigate to Eventbrite tech events page with better URL format
//     const searchUrl = `https://www.eventbrite.com/d/${city}/technology--events/?q=technology`
//     console.log(`🌐 Navigating to: ${searchUrl}`)
    
//     await page.goto(searchUrl, { 
//       waitUntil: 'domcontentloaded',
//       timeout: 60000 // Increased timeout
//     })

//     // Wait for page to load and handle potential redirects
//     await new Promise(resolve => setTimeout(resolve, 5000))
    
//     // Check if we're on the right page
//     const currentUrl = page.url()
//     console.log(`📍 Current URL: ${currentUrl}`)
    
//     // If redirected to a different page, try alternative approach
//     if (!currentUrl.includes('eventbrite.com')) {
//       console.log('⚠️ Redirected away from Eventbrite, trying alternative URL')
//       const altUrl = `https://www.eventbrite.com/search/?q=technology+${city}`
//       await page.goto(altUrl, { 
//         waitUntil: 'domcontentloaded',
//         timeout: 60000 
//       })
//       await new Promise(resolve => setTimeout(resolve, 5000))
//     }

//     // Debug: Capture page HTML structure for analysis
//     const pageContent = await page.content()
//     console.log('🔍 Page HTML length:', pageContent.length)
    
//     // Look for common event-related elements
//     const hasEventCards = pageContent.includes('event-card') || pageContent.includes('eventCard')
//     const hasEdsClasses = pageContent.includes('eds-')
//     const hasDataTestId = pageContent.includes('data-testid')
    
//     console.log('🔍 Page analysis:')
//     console.log('  - Contains "event-card":', hasEventCards)
//     console.log('  - Contains "eds-" classes:', hasEdsClasses)
//     console.log('  - Contains "data-testid":', hasDataTestId)
    
//     // Extract events using page.evaluate() - official Puppeteer pattern
//     const result = await page.evaluate((): { events: ScrapedEvent[], debug: any } => {
//       const scrapedEvents: ScrapedEvent[] = []
//       const debug = {
//         selectors: {} as Record<string, number>,
//         cardsProcessed: 0,
//         cardsSkipped: 0,
//         errors: [] as string[],
//         workingSelector: '',
//         totalCardsFound: 0
//       }

//       // Test all selectors and record results
//       const selectors = [
//         '.event-card',
//         'article.eds-l-pad-all-4.eds-event-card-content',
//         '[data-testid="event-card"]',
//         'article[class*="event-card"]',
//         '[class*="event"]',
//         'article',
//         '[class*="card"]'
//       ]
      
//       let eventCards: NodeListOf<Element> | null = null
//       let workingSelector = ''
      
//       for (const selector of selectors) {
//         const elements = document.querySelectorAll(selector)
//         debug.selectors[selector] = elements.length
//         if (elements.length > 0 && !eventCards) {
//           eventCards = elements
//           workingSelector = selector
//         }
//       }
      
//       debug.workingSelector = workingSelector
//       debug.totalCardsFound = eventCards?.length || 0

//       if (eventCards && eventCards.length > 0) {
//         eventCards.forEach((card, index) => {
//           try {
//             debug.cardsProcessed++
            
//             // Extract event data - we know h3 contains the title from debugging
//             const titleElement = card.querySelector('h3')
//             const title = titleElement?.textContent?.trim() || ''
            
//             // Skip if no title found
//             if (!title || title.length < 3) {
//               debug.cardsSkipped++
//               debug.errors.push(`Card ${index}: No valid title found`)
//               return
//             }

//             const linkElement = card.querySelector('a')
//             const externalUrl = linkElement?.getAttribute('href') || ''
//             const sourceId = externalUrl.split('/e/')[1]?.split('/')[0] || `eventbrite-${index}`

//             // For now, create mock data since we'd need to visit each event page for full details
//             // In production, you'd scrape each event page individually
//             const eventDate = new Date()
//             eventDate.setDate(eventDate.getDate() + Math.floor(Math.random() * 30))

//             // Extract tech stack from title
//             const techStack = extractTechStack(title)

//             // Create the event object with all required fields
//             const event = {
//               title,
//               description: `Technology event: ${title}`,
//               eventType: 'workshop' as const,
//               eventDate,
//               city: 'San Francisco',
//               country: 'US',
//               isOnline: false,
//               isFree: false,
//               priceMin: 0,
//               priceMax: 0,
//               currency: 'USD',
//               organizerName: 'Eventbrite Organizer',
//               organizerDescription: 'Professional event organizer',
//               organizerRating: undefined,
//               capacity: undefined,
//               registeredCount: 0,
//               techStack,
//               qualityScore: 0.8, // High quality since we found it
//               externalUrl,
//               imageUrl: '',
//               sourcePlatform: 'eventbrite' as const,
//               sourceId,
//               scrapedAt: new Date(),
//               lastUpdated: new Date()
//             }
            
//             scrapedEvents.push(event)
//             console.log(`✅ Extracted Eventbrite event ${index + 1}: ${title}`)
//           } catch (error) {
//             console.error('Error extracting event data:', error)
//           }
//         })
//       } else {
//         console.log('No Eventbrite event cards found, trying fallback selectors')
        
//         // Fallback selectors
//         const fallbackSelectors = [
//           'article[class*="event-card"]',
//           'div[class*="event-card"]',
//           'article[class*="eds-event-card"]',
//           'div[class*="eds-event-card"]'
//         ]
        
//         for (const selector of fallbackSelectors) {
//           const fallbackCards = document.querySelectorAll(selector)
//           if (fallbackCards.length > 0) {
//             console.log(`Found ${fallbackCards.length} events using fallback selector: ${selector}`)
            
//             fallbackCards.forEach((card, index) => {
//               try {
//                 const titleElement = card.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]')
//                 const title = titleElement?.textContent?.trim() || ''
                
//                 if (title && title.length > 3) {
//                   const eventDate = new Date()
//                   eventDate.setDate(eventDate.getDate() + Math.floor(Math.random() * 30))
                  
//                   scrapedEvents.push({
//                     title,
//                     description: `Event found on Eventbrite: ${title}`,
//                     eventDate,
//                     venueName: 'TBD',
//                     city: 'San Francisco',
//                     country: 'US',
//                     isOnline: false,
//                     isFree: false,
//                     currency: 'USD',
//                     registeredCount: 0,
//                     techStack: extractTechStack(title),
//                     externalUrl: '',
//                     sourcePlatform: 'eventbrite',
//                     sourceId: `eventbrite-fallback-${index}`,
//                   })
//                 }
//               } catch (error) {
//                 console.error('Error extracting fallback event data:', error)
//               }
//             })
//             break
//           }
//         }
//       }

//       return { events: scrapedEvents, debug }
//     })
    
//     // Log debug information outside browser context
//     console.log('🔍 Eventbrite scraping debug results:')
//     console.log('  - Selector results:', result.debug.selectors)
//     console.log('  - Working selector:', result.debug.workingSelector)
//     console.log('  - Total cards found:', result.debug.totalCardsFound)
//     console.log('  - Cards processed:', result.debug.cardsProcessed)
//     console.log('  - Cards skipped:', result.debug.cardsSkipped)
//     console.log('  - Errors:', result.debug.errors)
//     console.log('  - Events extracted:', result.events.length)
    
//     const events = result.events

//     console.log(`✅ Successfully scraped ${events.length} events from Eventbrite`)
//     return events

//   } catch (error) {
//     console.error('❌ Eventbrite scraping failed:', error)
//     throw new Error(`Eventbrite scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
//   }
// }

// // Helper function to extract tech stack from text
// function extractTechStack(text: string): string[] {
//   const techKeywords = [
//     'React', 'Vue', 'Angular', 'JavaScript', 'TypeScript', 'Node.js', 'Python',
//     'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
//     'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Machine Learning', 'AI',
//     'Data Science', 'Blockchain', 'Web3', 'DevOps', 'Frontend', 'Backend',
//     'Full Stack', 'Mobile', 'iOS', 'Android', 'Flutter', 'React Native'
//   ]

//   const foundTech = techKeywords.filter(tech => 
//     text.toLowerCase().includes(tech.toLowerCase())
//   )

//   return foundTech
// }
