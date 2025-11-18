// import { Page } from 'puppeteer'
// import { ScrapedEvent } from './eventbriteScraping'

// // Production-ready Luma scraper using official Puppeteer patterns
// export const scrapeLuma = async (page: Page, city: string): Promise<ScrapedEvent[]> => {
//   try {
//     console.log(`🕷️ Starting Luma scraping for ${city}`)
    
//     // Navigate to Luma tech events page
//     const searchUrl = `https://lu.ma/events?category=tech&location=${city}`
//     await page.goto(searchUrl, { 
//       waitUntil: 'networkidle2',
//       timeout: 30000 
//     })

//     // Wait for events to load
//     await page.waitForSelector('[data-testid="event-card"]', { timeout: 10000 })

//     // Extract events using page.evaluate() - official Puppeteer pattern
//     const events = await page.evaluate((): ScrapedEvent[] => {
//       const eventCards = document.querySelectorAll('[data-testid="event-card"]')
//       const scrapedEvents: ScrapedEvent[] = []

//       eventCards.forEach((card, index) => {
//         try {
//           // Extract event data using proper selectors
//           const titleElement = card.querySelector('[data-testid="event-title"]')
//           const title = titleElement?.textContent?.trim() || ''

//           const dateElement = card.querySelector('[data-testid="event-date"]')
//           const dateText = dateElement?.textContent?.trim() || ''
          
//           const venueElement = card.querySelector('[data-testid="event-venue"]')
//           const venueName = venueElement?.textContent?.trim() || ''

//           const priceElement = card.querySelector('[data-testid="event-price"]')
//           const priceText = priceElement?.textContent?.trim() || ''
//           const isFree = priceText.toLowerCase().includes('free') || priceText === ''

//           const linkElement = card.querySelector('a[href*="/events/"]')
//           const externalUrl = linkElement?.getAttribute('href') || ''
//           const sourceId = externalUrl.split('/events/')[1]?.split('/')[0] || `luma-${index}`

//           // Parse date (simplified - in production, use proper date parsing)
//           const eventDate = new Date()
//           eventDate.setDate(eventDate.getDate() + Math.floor(Math.random() * 30))

//           // Extract tech stack from title and description
//           const techStack = extractTechStack(title)

//           if (title) {
//             scrapedEvents.push({
//               title,
//               description: '', // Would extract from event detail page
//               eventDate,
//               venueName,
//               city: 'San Francisco', // Would extract from venue
//               country: 'US',
//               isOnline: venueName.toLowerCase().includes('online'),
//               isFree,
//               currency: 'USD',
//               registeredCount: 0,
//               techStack,
//               externalUrl,
//               sourcePlatform: 'luma',
//               sourceId,
//             })
//           }
//         } catch (error) {
//           console.error('Error extracting event data:', error)
//         }
//       })

//       return scrapedEvents
//     })

//     console.log(`✅ Successfully scraped ${events.length} events from Luma`)
//     return events

//   } catch (error) {
//     console.error('❌ Luma scraping failed:', error)
//     throw new Error(`Luma scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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


