// import { Page } from 'puppeteer'
// import { ScrapedEvent } from './eventbriteScraping'

// // Mock scraper for testing the full pipeline
// export const scrapeMockEvents = async (page: Page, city: string): Promise<ScrapedEvent[]> => {
//   try {
//     console.log(`🕷️ Starting mock event scraping for ${city}`)
    
//     // Simulate scraping delay
//     await new Promise(resolve => setTimeout(resolve, 2000))
    
//     // Generate mock events
//     const mockEvents: ScrapedEvent[] = [
//       {
//         title: 'React Workshop: Building Modern UIs',
//         description: 'Learn React fundamentals and build a modern web application',
//         eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
//         venueName: 'Tech Hub SF',
//         city: city.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
//         country: 'US',
//         isOnline: false,
//         isFree: false,
//         priceMin: 50,
//         priceMax: 50,
//         currency: 'USD',
//         organizerName: 'SF React Meetup',
//         registeredCount: 23,
//         techStack: ['React', 'TypeScript', 'Next.js'],
//         externalUrl: 'https://example.com/react-workshop',
//         sourcePlatform: 'mock',
//         sourceId: 'mock-react-001',
//       },
//       {
//         title: 'Python Data Science Workshop',
//         description: 'Learn data analysis with Python, Pandas, and Jupyter',
//         eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
//         venueName: 'Data Science Academy',
//         city: city.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
//         country: 'US',
//         isOnline: false,
//         isFree: false,
//         priceMin: 75,
//         priceMax: 75,
//         currency: 'USD',
//         organizerName: 'SF Data Science',
//         registeredCount: 18,
//         techStack: ['Python', 'Pandas', 'Jupyter', 'Data Science'],
//         externalUrl: 'https://example.com/python-workshop',
//         sourcePlatform: 'mock',
//         sourceId: 'mock-python-001',
//       },
//       {
//         title: 'AI & Machine Learning Conference 2024',
//         description: 'Explore the latest in AI, ML, and data science',
//         eventDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
//         venueName: 'Moscone Center',
//         city: city.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
//         country: 'US',
//         isOnline: false,
//         isFree: false,
//         priceMin: 299,
//         priceMax: 599,
//         currency: 'USD',
//         organizerName: 'AI Conference Inc',
//         registeredCount: 456,
//         techStack: ['Python', 'TensorFlow', 'PyTorch', 'AI', 'ML'],
//         externalUrl: 'https://example.com/ai-conference',
//         sourcePlatform: 'mock',
//         sourceId: 'mock-ai-001',
//       }
//     ]
    
//     console.log(`✅ Successfully generated ${mockEvents.length} mock events`)
//     return mockEvents
    
//   } catch (error) {
//     console.error('❌ Mock scraping failed:', error)
//     throw new Error(`Mock scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
//   }
// }


