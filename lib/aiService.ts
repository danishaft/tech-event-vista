/**
 * AI Service
 * Consolidates chatbot queries, speaker extraction, and AI-powered features
 */

import OpenAI from 'openai'
import { prisma } from './prisma'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

// ============================================
// SECTION 1: Query Service
// ============================================

export interface EventQueryResult {
  events: any[]
  totalCount: number
  summary?: string
}

export interface EventStats {
  totalEvents: number
  eventsByCity: Record<string, number>
  eventsByType: Record<string, number>
  eventsByTech: Record<string, number>
  upcomingEvents: number
  freeEvents: number
}

/**
 * Query events based on natural language parameters
 */
export async function queryEvents(params: {
  city?: string
  techStack?: string[]
  eventType?: string
  dateRange?: 'today' | 'thisWeek' | 'thisMonth' | 'nextMonth'
  isFree?: boolean
  isOnline?: boolean
  limit?: number
  searchTerm?: string
}): Promise<EventQueryResult> {
  const {
    city,
    techStack,
    eventType,
    dateRange,
    isFree,
    isOnline,
    limit = 10,
    searchTerm
  } = params

  const where: any = {
    status: 'active',
    eventDate: { gte: new Date() } // Only future events
  }

  // City filter
  if (city && city !== 'all') {
    where.city = { equals: city, mode: 'insensitive' }
  }

  // Tech stack filter
  if (techStack && techStack.length > 0) {
    where.techStack = { hasSome: techStack }
  }

  // Event type filter
  if (eventType && eventType !== 'all') {
    where.eventType = eventType
  }

  // Date range filter
  if (dateRange) {
    const now = new Date()
    let startDate = now
    let endDate: Date | undefined

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        endDate = new Date(now.setHours(23, 59, 59, 999))
        where.eventDate = {
          gte: startDate,
          lte: endDate
        }
        break
      case 'thisWeek':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        where.eventDate = {
          gte: startDate,
          lte: endDate
        }
        break
      case 'thisMonth':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        where.eventDate = {
          gte: startDate,
          lte: endDate
        }
        break
      case 'nextMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0)
        endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59)
        where.eventDate = {
          gte: startDate,
          lte: endDate
        }
        break
    }
  }

  // Free events filter (only add if explicitly true or false, not null/undefined)
  if (isFree !== undefined && isFree !== null) {
    where.isFree = isFree
  }

  // Online events filter (only add if explicitly true or false, not null/undefined)
  if (isOnline !== undefined && isOnline !== null) {
    where.isOnline = isOnline
  }

  // Search term (title or description)
  if (searchTerm) {
    where.OR = [
      { title: { contains: searchTerm, mode: 'insensitive' } },
      { description: { contains: searchTerm, mode: 'insensitive' } }
    ]
  }

  const [events, totalCount] = await Promise.all([
    prisma.event.findMany({
      where,
      take: limit,
      orderBy: [
        { qualityScore: 'desc' },
        { eventDate: 'asc' }
      ],
      include: {
        eventCategories: true
      }
    }),
    prisma.event.count({ where })
  ])

  return {
    events: events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      eventDate: event.eventDate,
      eventEndDate: event.eventEndDate,
      city: event.city,
      country: event.country,
      isOnline: event.isOnline,
      isFree: event.isFree,
      priceMin: event.priceMin,
      priceMax: event.priceMax,
      currency: event.currency,
      organizerName: event.organizerName,
      techStack: event.techStack,
      qualityScore: event.qualityScore,
      externalUrl: event.externalUrl,
      imageUrl: event.imageUrl,
      sourcePlatform: event.sourcePlatform,
      venueName: event.venueName,
      venueAddress: event.venueAddress
    })),
    totalCount
  }
}

/**
 * Get event statistics for insights
 */
export async function getEventStats(): Promise<EventStats> {
  const now = new Date()
  
  const [totalEvents, allEvents, upcomingEvents, freeEvents] = await Promise.all([
    prisma.event.count({ where: { status: 'active' } }),
    prisma.event.findMany({
      where: { status: 'active' },
      select: {
        city: true,
        eventType: true,
        techStack: true,
        eventDate: true,
        isFree: true
      }
    }),
    prisma.event.count({
      where: {
        status: 'active',
        eventDate: { gte: now }
      }
    }),
    prisma.event.count({
      where: {
        status: 'active',
        isFree: true,
        eventDate: { gte: now }
      }
    })
  ])

  // Calculate statistics
  const eventsByCity: Record<string, number> = {}
  const eventsByType: Record<string, number> = {}
  const eventsByTech: Record<string, number> = {}

  allEvents.forEach(event => {
    // By city
    eventsByCity[event.city] = (eventsByCity[event.city] || 0) + 1

    // By type
    eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1

    // By tech stack
    event.techStack.forEach(tech => {
      eventsByTech[tech] = (eventsByTech[tech] || 0) + 1
    })
  })

  return {
    totalEvents,
    eventsByCity,
    eventsByType,
    eventsByTech,
    upcomingEvents,
    freeEvents
  }
}

/**
 * Find events by organizer name
 */
export async function findEventsByOrganizer(organizerName: string, limit: number = 10) {
  return prisma.event.findMany({
    where: {
      organizerName: {
        contains: organizerName,
        mode: 'insensitive'
      },
      status: 'active',
      eventDate: { gte: new Date() }
    },
    take: limit,
    orderBy: [
      { qualityScore: 'desc' },
      { eventDate: 'asc' }
    ]
  })
}

/**
 * Get popular tech stacks
 */
export async function getPopularTechStacks(limit: number = 10): Promise<string[]> {
  const events = await prisma.event.findMany({
    where: {
      status: 'active',
      eventDate: { gte: new Date() }
    },
    select: {
      techStack: true
    }
  })

  const techCounts: Record<string, number> = {}
  events.forEach(event => {
    event.techStack.forEach(tech => {
      techCounts[tech] = (techCounts[tech] || 0) + 1
    })
  })

  return Object.entries(techCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tech]) => tech)
}

/**
 * Get events similar to a given event
 */
export async function findSimilarEvents(eventId: string, limit: number = 5) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      techStack: true,
      eventType: true,
      city: true
    }
  })

  if (!event) return []

  return prisma.event.findMany({
    where: {
      id: { not: eventId },
      status: 'active',
      eventDate: { gte: new Date() },
      OR: [
        { techStack: { hasSome: event.techStack } },
        { eventType: event.eventType },
        { city: event.city }
      ]
    },
    take: limit,
    orderBy: [
      { qualityScore: 'desc' },
      { eventDate: 'asc' }
    ]
  })
}

// ============================================
// SECTION 2: Speaker Extraction
// ============================================

/**
 * Extract speaker information from event description
 */
export async function extractSpeakersFromDescription(description: string): Promise<{
  speakers: Array<{ name: string; role?: string; bio?: string }>
  hasSpeakers: boolean
}> {
  if (!description || description.length < 50) {
    return { speakers: [], hasSpeakers: false }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Extract speaker information from event descriptions. Return JSON with speakers array.
Each speaker should have: name (required), role (optional), bio (optional).
If no speakers are mentioned, return empty array.
Return ONLY valid JSON: { "speakers": [...] }`
        },
        {
          role: 'user',
          content: `Extract speakers from this event description:\n\n${description.substring(0, 2000)}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 300
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    const speakers = result.speakers || []
    
    return {
      speakers: Array.isArray(speakers) ? speakers : [],
      hasSpeakers: speakers.length > 0
    }
  } catch (error) {
    console.error('Error extracting speakers:', error)
    // Fallback: simple regex extraction
    return extractSpeakersSimple(description)
  }
}

/**
 * Simple regex-based speaker extraction (fallback)
 */
function extractSpeakersSimple(description: string): {
  speakers: Array<{ name: string; role?: string; bio?: string }>
  hasSpeakers: boolean
} {
  const speakers: Array<{ name: string }> = []
  
  // Common patterns for speakers
  const patterns = [
    /(?:speaker|presenter|host|instructor|facilitator)[s]?:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
    /(?:with|featuring|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:will|is|are)\s+(?:speaking|presenting|hosting)/gi
  ]

  for (const pattern of patterns) {
    const matches = description.matchAll(pattern)
    for (const match of matches) {
      const name = match[1]?.trim()
      if (name && name.length > 2 && name.length < 50) {
        // Avoid common false positives
        if (!['Event', 'Workshop', 'Conference', 'Meetup', 'Session'].includes(name)) {
          speakers.push({ name })
        }
      }
    }
  }

  // Remove duplicates
  const uniqueSpeakers = Array.from(
    new Map(speakers.map(s => [s.name, s])).values()
  )

  return {
    speakers: uniqueSpeakers,
    hasSpeakers: uniqueSpeakers.length > 0
  }
}

/**
 * Extract speakers from multiple events
 */
export async function extractSpeakersFromEvents(events: any[]): Promise<Map<string, Array<{ name: string; role?: string; bio?: string }>>> {
  const eventSpeakers = new Map<string, Array<{ name: string; role?: string; bio?: string }>>()

  // Process in batches to avoid rate limits
  for (const event of events.slice(0, 5)) { // Limit to 5 events
    if (event.description) {
      const result = await extractSpeakersFromDescription(event.description)
      if (result.hasSpeakers) {
        eventSpeakers.set(event.id, result.speakers)
      }
    }
  }

  return eventSpeakers
}

// ============================================
// SECTION 3: AI Service
// ============================================

/**
 * Classify user intent from their message
 */
export type IntentType = 
  | 'event_search'
  | 'event_details'
  | 'networking_advice'
  | 'general_question'
  | 'recommendations'
  | 'statistics'
  | 'speaker_inquiry'

export interface IntentClassification {
  intent: IntentType
  confidence: number
  extractedParams?: {
    city?: string
    techStack?: string[]
    eventType?: string
    dateRange?: 'today' | 'thisWeek' | 'thisMonth' | 'nextMonth'
    isFree?: boolean
    isOnline?: boolean
    searchTerm?: string
    eventId?: string
  }
}

/**
 * Classify user intent and extract parameters
 */
export async function classifyIntent(userMessage: string): Promise<IntentClassification> {
  const systemPrompt = `You are an intent classifier for a tech event discovery platform. 
Analyze the user's message and classify their intent. Extract relevant parameters.

Intent types:
- event_search: User wants to find events (e.g., "Find React events in Seattle", "Show me free workshops")
- event_details: User asks about a specific event (e.g., "Tell me about React Conf", "What's in that Python workshop?")
- speaker_inquiry: User asks about speakers (e.g., "Who are the speakers?", "Who's presenting?", "Tell me about the speakers")
- networking_advice: User asks for networking tips (e.g., "How do I network?", "Who should I connect with?")
- recommendations: User wants personalized recommendations (e.g., "What should I attend?", "Recommend events for me")
- statistics: User asks about stats/insights (e.g., "How many events are there?", "What's popular?")
- general_question: General questions about the platform or tech events

Extract parameters:
- city: City name if mentioned
- techStack: Array of technologies mentioned (react, python, ai, javascript, etc.)
- eventType: workshop, conference, meetup, hackathon
- dateRange: today, thisWeek, thisMonth, nextMonth
- isFree: true/false if free/paid is mentioned
- isOnline: true/false if online/in-person is mentioned
- searchTerm: Any specific search terms
- eventId: Event ID if querying a specific event

Return JSON only with: { intent, confidence, extractedParams }`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    return {
      intent: result.intent || 'general_question',
      confidence: result.confidence || 0.5,
      extractedParams: result.extractedParams || {}
    }
  } catch (error) {
    console.error('Error classifying intent:', error)
    // Fallback to general question
    return {
      intent: 'general_question',
      confidence: 0.5
    }
  }
}

/**
 * Generate AI response based on intent and context
 */
export async function generateResponse(
  userMessage: string,
  intent: IntentType,
  context: {
    events?: any[]
    stats?: any
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    speakers?: Map<string, any[]>
  }
): Promise<string> {
  const { events = [], stats, conversationHistory = [], speakers } = context

  let systemPrompt = `You are a helpful AI assistant for Tech Event Vista, a platform for discovering tech events.
You help users find events, get networking advice, and answer questions about the tech event ecosystem.

CRITICAL RULES:
- ONLY mention events that are provided in the events data below. NEVER make up or invent events.
- If no events are provided, say "I couldn't find any events matching your search in our database."
- Do NOT suggest checking external platforms like Meetup.com or Eventbrite - we already scrape those.
- Be friendly, concise, and actionable.

Networking advice should be practical and specific to tech events.`

  // Add context based on intent
  if (intent === 'event_search') {
    if (events.length > 0) {
      systemPrompt += `\n\nUser is searching for events. Here are the REAL events from our database:
${JSON.stringify(events.slice(0, 5), null, 2)}

IMPORTANT: Only mention these events. Do NOT make up additional events. Present these events naturally in your response, highlighting:
- Event name and date
- Location (city, online/in-person)
- Tech stack
- Event type
- Price (free/paid)
- Brief description if available

Format: "I found X events in [city]. Here they are: [list events with details]"`
    } else {
      systemPrompt += `\n\nUser is searching for events, but NO events were found in our database matching their query.

IMPORTANT: 
- Say "I couldn't find any events matching your search in our database."
- Suggest they try:
  * Different search terms (e.g., "Find events in Seattle" without specifying tech stack)
  * Different cities
  * Broader tech terms
- Do NOT make up events, invent event names, or suggest checking external platforms like Meetup.com or Eventbrite
- Be honest that we couldn't find matches, but offer helpful alternatives`
    }
  }

  if (intent === 'statistics' && stats) {
    systemPrompt += `\n\nUser asked for statistics. Here's the data:
${JSON.stringify(stats, null, 2)}

Present this information in an engaging, easy-to-understand way.`
  }

  // Handle speaker queries
  if ((intent === 'speaker_inquiry' || intent === 'event_details' || userMessage.toLowerCase().includes('speaker')) && events.length > 0) {
    if (speakers && speakers.size > 0) {
      // We have extracted speaker data
      const speakersInfo: any[] = []
      events.forEach(event => {
        const eventSpeakers = speakers.get(event.id)
        if (eventSpeakers && eventSpeakers.length > 0) {
          speakersInfo.push({
            eventTitle: event.title,
            speakers: eventSpeakers
          })
        }
      })
      
      if (speakersInfo.length > 0) {
        systemPrompt += `\n\nUser is asking about speakers. Here is the extracted speaker information:
${JSON.stringify(speakersInfo, null, 2)}

Present this information clearly, listing speakers for each event. If an event has no speakers listed, mention that speaker information is not available for that event.`
      } else {
        systemPrompt += `\n\nUser is asking about speakers, but no speaker information could be extracted from the event descriptions.
Say: "I couldn't find specific speaker information in the event descriptions. You can check the event links for speaker details, as they usually include information about presenters and their backgrounds."`
      }
    } else {
      // Try to extract from descriptions in the prompt
      systemPrompt += `\n\nUser is asking about speakers. Here are the event descriptions - extract speaker information if mentioned:
${events.map(e => `${e.title}: ${e.description?.substring(0, 500) || 'No description'}`).join('\n\n')}

If speakers are mentioned in descriptions, list them with their names and any roles/bios.
If no speakers are mentioned, say "Speaker information is not available in the event descriptions. Check the event links for more details."`
    }
  }

  if (intent === 'networking_advice') {
    systemPrompt += `\n\nProvide practical networking advice for tech events. Include:
- How to approach people at events
- What questions to ask
- How to follow up after events
- Who to connect with (organizers, speakers, attendees)
- Tips for introverts
- Building meaningful connections`
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6), // Last 6 messages for context
    { role: 'user', content: userMessage }
  ]

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500
    })

    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response. Please try again."
  } catch (error) {
    console.error('Error generating response:', error)
    return "I'm sorry, I encountered an error. Please try again or rephrase your question."
  }
}

/**
 * Main chatbot function that handles the full conversation flow
 */
export async function processChatMessage(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<{
  response: string
  events?: any[]
  intent: IntentType
}> {
  // Step 1: Classify intent
  const classification = await classifyIntent(userMessage)
  const { intent, extractedParams } = classification

  let events: any[] = []
  let stats: any = null

  // Step 2: Query database based on intent
  if (intent === 'event_search' && extractedParams) {
    console.log('🔍 [CHATBOT] Querying events with params:', extractedParams)
    const result = await queryEvents({
      city: extractedParams.city,
      techStack: extractedParams.techStack,
      eventType: extractedParams.eventType,
      dateRange: extractedParams.dateRange,
      isFree: extractedParams.isFree,
      isOnline: extractedParams.isOnline,
      searchTerm: extractedParams.searchTerm,
      limit: 10
    })
    events = result.events
    console.log(`📊 [CHATBOT] Found ${events.length} events for query`)
  } else if (intent === 'speaker_inquiry' || (intent === 'event_details' && userMessage.toLowerCase().includes('speaker'))) {
    // For speaker queries, we need to get events from conversation context or recent search
    // For now, get recent events from the city mentioned or from conversation
    const city = extractedParams?.city || 'San Francisco' // Default if not specified
    const result = await queryEvents({
      city: city,
      limit: 5
    })
    events = result.events
    console.log(`📊 [CHATBOT] Found ${events.length} events for speaker inquiry`)
  } else if (intent === 'event_details' && extractedParams?.searchTerm) {
    // Search for specific event
    const result = await queryEvents({
      searchTerm: extractedParams.searchTerm,
      limit: 5
    })
    events = result.events
  } else if (intent === 'recommendations') {
    // Get popular events as recommendations
    const popularTech = await getPopularTechStacks(3)
    const result = await queryEvents({
      techStack: popularTech,
      limit: 10
    })
    events = result.events
  } else if (intent === 'statistics') {
    stats = await getEventStats()
  }

  // Step 3: Extract speakers if this is a speaker inquiry
  let speakersData: Map<string, any[]> | null = null
  if ((intent === 'speaker_inquiry' || userMessage.toLowerCase().includes('speaker')) && events.length > 0) {
    console.log('🎤 [CHATBOT] Extracting speakers from events...')
    speakersData = await extractSpeakersFromEvents(events)
    console.log(`🎤 [CHATBOT] Found speakers for ${speakersData.size} events`)
  }

  // Step 4: Generate response
  const response = await generateResponse(userMessage, intent, {
    events,
    stats,
    conversationHistory,
    speakers: speakersData || undefined
  })

  return {
    response,
    events: events.length > 0 ? events : undefined,
    intent
  }
}

