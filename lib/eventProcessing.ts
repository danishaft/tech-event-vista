/**
 * Event Processing Utilities
 * Consolidates data mapping, validation, deduplication, and enrichment
 */

import { z } from 'zod'
import OpenAI from 'openai'
import { prisma } from './prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

// ============================================
// SECTION 1: Data Mapping
// ============================================

export function mapLumaEvent(lumaEvent: any, city: string) {
  return {
    title: lumaEvent.name || 'Untitled Event',
    description: lumaEvent.description_mirror || 'No description available',
    eventType: 'workshop',
    eventDate: new Date(lumaEvent.start_at),
    eventEndDate: new Date(lumaEvent.end_at),
    venueName: lumaEvent.geo_address_info?.city_state || city,
    venueAddress: lumaEvent.geo_address_info?.city_state || city,
    city: city,
    country: 'US',
    isOnline: lumaEvent.event?.location_type === 'online',
    isFree: lumaEvent.ticket_info?.is_free || false,
    priceMin: lumaEvent.ticket_info?.price || 0,
    priceMax: lumaEvent.ticket_info?.price || 0,
    currency: 'USD',
    organizerName: lumaEvent.hosts?.[0]?.name || 'Unknown',
    organizerDescription: lumaEvent.hosts?.[0]?.bio_short || '',
    capacity: null,
    registeredCount: 0,
    techStack: [] as string[],
    qualityScore: 0,
    externalUrl: `https://lu.ma/${lumaEvent.url}`,
    imageUrl: lumaEvent.mainImageUrl || '',
    sourcePlatform: 'luma',
    sourceId: lumaEvent.api_id || `luma-${Date.now()}`
  }
}

export function mapEventbriteEvent(eventbriteEvent: any, city: string) {
  return {
    title: eventbriteEvent.title || 'Untitled Event',
    description: eventbriteEvent.description || 'No description available',
    eventType: 'workshop',
    eventDate: new Date(eventbriteEvent.start_date),
    eventEndDate: new Date(eventbriteEvent.end_date),
    venueName: eventbriteEvent.venue?.name || city,
    venueAddress: eventbriteEvent.venue?.address || city,
    city: city,
    country: 'US',
    isOnline: eventbriteEvent.is_online || false,
    isFree: eventbriteEvent.is_free || false,
    priceMin: eventbriteEvent.price?.min || 0,
    priceMax: eventbriteEvent.price?.max || 0,
    currency: 'USD',
    organizerName: eventbriteEvent.organizer?.name || 'Unknown',
    organizerDescription: eventbriteEvent.organizer?.description || '',
    capacity: eventbriteEvent.capacity || null,
    registeredCount: eventbriteEvent.registered_count || 0,
    techStack: [] as string[],
    qualityScore: 0,
    externalUrl: eventbriteEvent.url || '',
    imageUrl: eventbriteEvent.image_url || '',
    sourcePlatform: 'eventbrite',
    sourceId: eventbriteEvent.id || `eventbrite-${Date.now()}`
  }
}

export function extractTechStack(title: string, description: string): string[] {
  // Focus on software engineering, development, AI/ML technologies
  const techKeywords = [
    // Frontend frameworks
    'react', 'vue', 'angular', 'next.js', 'svelte', 'remix',
    // Languages (note: 'go' must be whole word to avoid matching "go to", "let's go", etc.)
    'javascript', 'typescript', 'node.js', 'python', 'java', 'c++', 'c#', 
    'php', 'ruby', 'golang', 'go language', 'rust', 'swift', 'kotlin', 'scala', 'clojure',
    // Backend/Infrastructure
    'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'ansible',
    // AI/ML (with word boundaries)
    'machine learning', 'deep learning', 'neural network', 'tensorflow', 
    'pytorch', 'scikit-learn', 'nlp', 'computer vision',
    // Data
    'data science', 'data engineering', 'big data', 'spark', 'hadoop',
    // Blockchain/Web3
    'blockchain', 'web3', 'solidity', 'ethereum', 'smart contract',
    // Mobile
    'react native', 'flutter', 'ios development', 'android development',
    // Development practices
    'software engineering', 'software development', 'web development',
    'frontend development', 'backend development', 'fullstack development',
    'devops', 'ci/cd', 'agile', 'scrum'
  ]
  
  // AI keyword needs word boundaries to avoid matching acronyms like "AICAD"
  const aiKeywords = [
    /\bai\b/i,                    // "ai" as whole word
    /\bartificial intelligence\b/i,
    /\bmachine learning\b/i,
    /\bml\b/i,
    /\bdeep learning\b/i,
    /\bneural network\b/i
  ]
  
  const text = `${title} ${description}`.toLowerCase()
  const matchedKeywords: string[] = []
  
  // Check each keyword
  for (const keyword of techKeywords) {
    // Special handling for "ai" - must be whole word
    if (keyword === 'ai' || keyword.includes('ai ')) {
      if (aiKeywords.some(pattern => pattern.test(text))) {
        matchedKeywords.push('ai')
      }
    } else if (keyword === 'go' || keyword === 'golang') {
      // Special handling for "go" - must be in programming context
      // Match "golang", "go language", "go programming", "go developer", etc.
      const goPatterns = [
        /\bgolang\b/i,
        /\bgo\s+(language|programming|developer|development|code|coding)\b/i,
        /\bgo\s+(workshop|meetup|conference|training)\b/i,
        /\bgo\s+(backend|server|api)\b/i
      ]
      if (goPatterns.some(pattern => pattern.test(text))) {
        matchedKeywords.push('go')
      }
    } else {
      // Use word boundaries for single words, phrase matching for multi-word
      if (keyword.includes(' ')) {
        // Multi-word: check if phrase exists
        if (text.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword)
        }
      } else {
        // Single word: use word boundary (escape special regex chars)
        const escapedKeyword = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = new RegExp(`\\b${escapedKeyword}\\b`, 'i')
        if (pattern.test(text)) {
          matchedKeywords.push(keyword)
        }
      }
    }
  }
  
  // Remove duplicates
  return [...new Set(matchedKeywords)]
}

export function assignEventType(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()
  
  if (text.includes('conference') || text.includes('summit')) return 'conference'
  if (text.includes('workshop') || text.includes('training')) return 'workshop'
  if (text.includes('meetup') || text.includes('networking')) return 'meetup'
  if (text.includes('hackathon') || text.includes('hack')) return 'hackathon'
  
  return 'workshop' // default
}

export function calculateQualityScore(event: any): number {
  let score = 0
  
  // Title quality
  if (event.title && event.title.length > 10) score += 20
  
  // Description quality
  if (event.description && event.description.length > 50) score += 20
  
  // Date validity
  if (event.eventDate && event.eventDate > new Date()) score += 20
  
  // Location info
  if (event.city && event.venueName) score += 15
  
  // Organizer info
  if (event.organizerName && event.organizerName !== 'Unknown') score += 15
  
  // Tech stack
  if (event.techStack && event.techStack.length > 0) score += 10
  
  return Math.min(score, 100)
}

// ============================================
// SECTION 2: Validation
// ============================================

// Zod schema for event validation
export const EventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  eventType: z.enum(['workshop', 'conference', 'meetup', 'hackathon', 'networking']),
  eventDate: z.date(),
  eventEndDate: z.date().nullable().optional(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  isOnline: z.boolean(),
  isFree: z.boolean(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  currency: z.string().min(3).max(3),
  organizerName: z.string().optional(),
  organizerDescription: z.string().optional(),
  organizerRating: z.number().min(0).max(5).optional(),
  capacity: z.number().min(1).nullable().optional(),
  registeredCount: z.number().min(0),
  techStack: z.array(z.string()),
  qualityScore: z.number().min(0).max(100),
  externalUrl: z.string().url('Invalid URL'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  sourcePlatform: z.enum(['eventbrite', 'meetup', 'luma']),
  sourceId: z.string().min(1, 'Source ID is required')
})

// Validation function
export function validateEvent(data: any) {
  try {
    return EventSchema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log('❌ Event validation failed:', error.errors)
      return null
    }
    throw error
  }
}

// Check if event data is complete enough for processing
export function isEventDataComplete(event: any): boolean {
  const requiredFields = [
    'title',
    'description', 
    'eventDate',
    'city',
    'organizerName',
    'sourcePlatform',
    'sourceId'
  ]
  
  return requiredFields.every(field => {
    const value = event[field]
    return value !== null && value !== undefined && value !== ''
  })
}

// Sanitize event data
export function sanitizeEventData(event: any) {
  return {
    ...event,
    title: event.title?.trim() || '',
    description: event.description?.trim() || '',
    city: event.city?.trim() || '',
    organizerName: event.organizerName?.trim() || '',
    venueName: event.venueName?.trim() || '',
    venueAddress: event.venueAddress?.trim() || '',
    techStack: Array.isArray(event.techStack) ? event.techStack : [],
    qualityScore: Math.max(0, Math.min(100, event.qualityScore || 0)),
    registeredCount: Math.max(0, event.registeredCount || 0)
  }
}

// ============================================
// SECTION 3: Deduplication
// ============================================

/**
 * Normalize sourceId by removing query parameters and aff codes
 * This ensures same event from different queries gets same normalized ID
 */
export function normalizeSourceId(sourceId: string, platform: string): string {
  if (!sourceId) return sourceId
  
  if (platform === 'eventbrite') {
    // Remove query parameters: "event-tickets-123?aff=ebdssbdestsearch" → "event-tickets-123"
    return sourceId.split('?')[0].split('&')[0].trim()
  }
  
  // Luma IDs are already clean: "evt-abc123"
  if (platform === 'luma') {
    return sourceId.trim()
  }
  
  return sourceId.trim()
}

/**
 * Normalize URL by removing query parameters
 * Used for cross-platform duplicate detection
 */
export function normalizeUrl(url: string): string {
  if (!url) return ''
  
  try {
    const parsed = new URL(url)
    // Return just origin + pathname (no query params)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    // If URL parsing fails, try simple string manipulation
    return url.split('?')[0].split('#')[0].trim()
  }
}

/**
 * Check if event is tech-related - STRICT filtering for software engineers, devs, AI/ML
 * Focus: Software engineering, development, AI/ML, data science
 */
export function isTechEvent(event: any, extractTechStack: (title: string, desc: string) => string[], calculateQualityScore: (event: any) => number): boolean {
  const title = (event.title || '').toLowerCase()
  const description = (event.description || '').toLowerCase()
  const text = `${title} ${description}`
  
  // Check if title/description explicitly mentions "tech" (allow these through)
  const hasExplicitTech = /\btech\b/i.test(event.title || '') || /\btech\b/i.test(event.description || '')
  
  // If explicitly has "tech" in title, allow it (tech networking events, tech meetups, etc.)
  if (hasExplicitTech) {
    // Only block obviously non-tech things
    const obviousNonTech = [
      /(wine|beer|cocktail|drinks|dinner|lunch|brunch)\s+(event|party|reception|tasting)/i,
      /(yoga|fitness|workout|gym|kettlebell|meditation)/i,
      /(music|concert|theater|art|gallery|exhibition|poetry|writing|book)/i,
    ]
    
    if (!obviousNonTech.some(pattern => pattern.test(text))) {
      return true // Allow tech events through
    }
  }
  
  // STRICT: Must have tech stack keywords OR explicit "tech" mention
  const techStack = extractTechStack(event.title || '', event.description || '')
  if (techStack.length === 0 && !hasExplicitTech) {
    return false
  }
  
  // STRICT: Must be clearly software/tech related
  // Require at least one of these indicators:
  const techIndicators = [
    // Development/Engineering keywords
    /\b(software|code|coding|programming|development|engineering|developer|engineer|dev)\b/i,
    // Tech stack keywords (already checked, but verify context)
    /\b(react|vue|angular|javascript|typescript|python|java|node|ai|ml|machine learning|data science)\b/i,
    // Event types that are tech-focused
    /\b(hackathon|code|workshop|conference|summit|meetup)\s+(about|on|for|with)\s+(tech|software|code|ai|ml|development)\b/i,
    // Specific tech domains
    /\b(frontend|backend|fullstack|devops|cloud|aws|azure|gcp|docker|kubernetes)\b/i,
    // Explicit "tech" mention
    /\btech\b/i
  ]
  
  const hasTechIndicator = techIndicators.some(pattern => pattern.test(text))
  if (!hasTechIndicator) {
    return false
  }
  
  // BLOCK: Non-tech events (comprehensive list)
  // BUT: Allow if title explicitly has "tech" (tech networking events are OK)
  // Only block if it's clearly non-tech AND doesn't have "tech" in title
  if (!hasExplicitTech) {
    const nonTechPatterns = [
      // Social/Networking (non-tech)
      /(language exchange|networking mixer|happy hour|trivia|food drive|bar crawl)/i,
      /(wine|beer|cocktail|drinks|dinner|lunch|brunch)\s+(event|party|reception|tasting)/i,
      // Fitness/Wellness
      /(yoga|fitness|workout|gym|kettlebell|meditation|wellness|health)/i,
      // Arts/Entertainment
      /(music|concert|theater|art|gallery|exhibition|poetry|writing|book)/i,
      // Business (non-tech)
      /(marketing|sales|business development|real estate|finance|accounting)\s+(meetup|workshop|event)/i,
      /(b2b marketing|morning brew)\s+(meetup|event)/i,
      // Other
      /(awards?\s+luncheon|celtic|robotics?\s+(non-software|hardware only)|combat robot)/i,
      /(podcast|youtube|content creation|social media)\s+(workshop|event)/i,
      // Exclude if title suggests non-tech
      /^(?!.*(tech|software|code|ai|ml|development|engineering)).*(meetup|workshop|event)$/i
    ]
    
    if (nonTechPatterns.some(pattern => pattern.test(text))) {
      return false
    }
  } else {
    // If has "tech" in title, only block obviously non-tech things
    const obviousNonTech = [
      /(wine|beer|cocktail|drinks|dinner|lunch|brunch)\s+(event|party|reception|tasting)/i,
      /(yoga|fitness|workout|gym|kettlebell|meditation)/i,
      /(music|concert|theater|art|gallery|exhibition|poetry|writing|book)/i,
    ]
    
    if (obviousNonTech.some(pattern => pattern.test(text))) {
      return false
    }
  }
  
  // Quality check
  const qualityScore = calculateQualityScore(event)
  if (qualityScore < 30) {
    return false
  }
  
  // Additional check: If tech stack has generic terms, verify context
  const genericTechTerms = ['mobile', 'web', 'frontend', 'backend']
  const hasGenericOnly = techStack.every(tech => genericTechTerms.includes(tech.toLowerCase()))
  if (hasGenericOnly && !text.match(/\b(development|engineering|developer|programming|coding)\b/i)) {
    // If only generic terms and no development context, reject
    return false
  }
  
  return true
}

// ============================================
// SECTION 4: Enrichment
// ============================================

export interface EnrichmentResult {
  success: boolean
  enriched: {
    description?: string // Only if fetched from URL or already exists
    techStack?: string[] // Only extracted from existing text
    organizerName?: string // Only extracted from existing text
    organizerDescription?: string // Only extracted from existing text
    topics?: string[] // Only extracted from existing text
    audienceLevel?: string // Only inferred from existing text
    format?: string // Only inferred from existing text
    summary?: string // Only generated from existing description
    keyPoints?: string[] // Only extracted from existing description
  }
  categories?: Array<{ category: string; value: string; confidence: number }>
  fetchedFromUrl?: boolean // True if description was fetched from external URL
}

/**
 * Fetch description from external URL (if possible)
 */
async function fetchDescriptionFromUrl(url: string): Promise<string | null> {
  try {
    // TODO: Implement web scraping to fetch event description from URL
    // For now, return null - we'll add this later if needed
    // This would use puppeteer or similar to scrape the event page
    return null
  } catch (error) {
    console.error('Error fetching from URL:', error)
    return null
  }
}

/**
 * Extract data from existing event information (NEVER generate fake data)
 */
export async function enrichEventData(event: {
  title: string
  description?: string
  externalUrl?: string
  organizerName?: string
  city?: string
  eventType?: string
}): Promise<EnrichmentResult> {
  try {
    // CRITICAL: If description is missing, try to fetch from URL first
    let description = event.description
    let fetchedFromUrl = false
    
    if ((!description || description.length < 100) && event.externalUrl) {
      console.log(`   🔍 Attempting to fetch description from URL: ${event.externalUrl}`)
      const fetched = await fetchDescriptionFromUrl(event.externalUrl)
      if (fetched && fetched.length >= 100) {
        description = fetched
        fetchedFromUrl = true
        console.log(`   ✅ Fetched description from URL (${fetched.length} chars)`)
      }
    }
    
    // If still no description, we CANNOT enrich - return failure
    if (!description || description.length < 50) {
      console.log(`   ❌ Cannot enrich: description missing or too short`)
      return {
        success: false,
        enriched: {},
        fetchedFromUrl: false
      }
    }

    const prompt = `Analyze this tech event and EXTRACT information that exists in the provided data.
CRITICAL: Only extract information that is explicitly mentioned or can be reasonably inferred from the existing text.
DO NOT generate, invent, or create new information.

Event Title: ${event.title}
Description: ${description}
City: ${event.city || 'Unknown'}
Event Type: ${event.eventType || 'Unknown'}
Current Organizer: ${event.organizerName || 'Not provided'}

EXTRACT ONLY (do not generate):
1. **Tech Stack**: Extract technologies mentioned in title/description (react, python, ai, javascript, etc.). Only include if explicitly mentioned.

2. **Organizer**: Extract organizer name ONLY if mentioned in description. If current organizer is "Organizer not available" or "Unknown", try to extract from description. If not found, return null.

3. **Topics**: Extract topics/themes explicitly mentioned (e.g., "web-development", "data-science"). Only if mentioned.

4. **Audience Level**: Infer from description text (e.g., "beginner-friendly", "advanced", "intermediate"). Return null if unclear.

5. **Format**: Infer from description (e.g., "hands-on workshop", "lecture", "panel discussion"). Return null if unclear.

6. **Summary**: Create a 100-200 character summary based ONLY on the existing description. Do not add new information.

7. **Key Points**: Extract 3-5 key points that are explicitly mentioned in the description. Do not invent points.

8. **Categories**: Extract categories for EventCategory table (only from existing text):
   - technology: specific tech mentioned (react, python, etc.)
   - topic: broader topic mentioned (web-development, etc.)
   - audience_level: only if mentioned or clearly inferable
   - format: only if mentioned or clearly inferable

Return JSON only with this structure:
{
  "techStack": ["react", "javascript"] or [] if none found,
  "organizerName": "extracted name" or null if not found,
  "organizerDescription": "extracted description" or null,
  "topics": ["web-development"] or [] if none found,
  "audienceLevel": "beginner" | "intermediate" | "advanced" | null,
  "format": "hands-on" | "lecture" | "panel" | "networking" | "workshop" | null,
  "summary": "summary based on existing description only",
  "keyPoints": ["point 1", "point 2"] or [] if none found,
  "categories": [
    {"category": "technology", "value": "react", "confidence": 0.9}
  ] or [] if none found
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a data extraction expert. Your ONLY job is to EXTRACT information that exists in the provided text. NEVER generate, invent, or create new information. If information is not found, return null or empty array. This is critical - generating fake data is strictly forbidden.' 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Lower temperature for more conservative extraction
      max_tokens: 1000
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    return {
      success: true,
      enriched: {
        // Only use fetched description if we got it from URL
        description: fetchedFromUrl ? description : undefined,
        // Only use extracted tech stack if found
        techStack: result.techStack && result.techStack.length > 0 ? result.techStack : undefined,
        // Only use extracted organizer if found (don't replace with null)
        organizerName: result.organizerName && result.organizerName !== 'null' ? result.organizerName : undefined,
        organizerDescription: result.organizerDescription && result.organizerDescription !== 'null' ? result.organizerDescription : undefined,
        topics: result.topics && result.topics.length > 0 ? result.topics : undefined,
        audienceLevel: result.audienceLevel && result.audienceLevel !== 'null' ? result.audienceLevel : undefined,
        format: result.format && result.format !== 'null' ? result.format : undefined,
        summary: result.summary || undefined,
        keyPoints: result.keyPoints && result.keyPoints.length > 0 ? result.keyPoints : undefined
      },
      categories: result.categories && result.categories.length > 0 ? result.categories : undefined,
      fetchedFromUrl
    }
  } catch (error) {
    console.error('Error enriching event data:', error)
    return {
      success: false,
      enriched: {}
    }
  }
}

/**
 * Enrich and save event categories
 */
export async function saveEventCategories(
  eventId: string,
  categories: Array<{ category: string; value: string; confidence: number }>
): Promise<void> {
  try {
    // Delete existing categories for this event
    await prisma.eventCategory.deleteMany({
      where: { eventId }
    })

    // Create new categories
    if (categories.length > 0) {
      await prisma.eventCategory.createMany({
        data: categories.map(cat => ({
          eventId,
          category: cat.category,
          value: cat.value,
          confidence: cat.confidence
        }))
      })
    }
  } catch (error) {
    console.error('Error saving event categories:', error)
  }
}

/**
 * Check if event can be enriched (has enough data to extract from)
 * Returns false if event is missing critical data that can't be fetched
 */
export function canEnrich(event: any): boolean {
  // Can enrich if:
  // - Has description (even if short) OR has external URL to fetch from
  // - Has title (required for extraction)
  
  const hasDescription = event.description && event.description.length >= 50
  const hasUrl = event.externalUrl && event.externalUrl.length > 0
  
  return (hasDescription || hasUrl) && event.title && event.title.length > 0
}

/**
 * Check if event needs enrichment
 */
export function needsEnrichment(event: any): boolean {
  // Needs enrichment if we can enrich AND:
  // - Description missing or too short (can try to fetch from URL)
  // - Tech stack empty (can extract from description)
  // - Organizer is placeholder (can extract from description)

  if (!canEnrich(event)) {
    return false // Can't enrich, so don't try
  }

  const hasGoodDescription = event.description && event.description.length >= 100
  const hasTechStack = event.techStack && event.techStack.length > 0
  const hasOrganizer = event.organizerName && 
    event.organizerName !== 'Organizer not available' && 
    event.organizerName !== 'Unknown'

  return !hasGoodDescription || !hasTechStack || !hasOrganizer
}

/**
 * Calculate completeness score (0-100)
 */
export function calculateCompleteness(event: any): number {
  let score = 0

  // Title (required)
  if (event.title && event.title.length >= 3) score += 10

  // Description (critical)
  if (event.description) {
    if (event.description.length >= 100) score += 20
    else if (event.description.length >= 50) score += 10
  }

  // Event Date (required)
  if (event.eventDate) score += 10

  // City (required)
  if (event.city && event.city.length > 0) score += 10

  // Tech Stack (critical)
  if (event.techStack && event.techStack.length > 0) score += 15

  // Organizer (important)
  if (event.organizerName && 
      event.organizerName !== 'Organizer not available' && 
      event.organizerName !== 'Unknown') {
    score += 10
  }

  // External URL (required)
  if (event.externalUrl && event.externalUrl.length > 0) {
    try {
      new URL(event.externalUrl)
      score += 10
    } catch {}
  }

  // Venue (nice to have)
  if (event.venueName && event.venueName !== event.city) score += 5

  return Math.min(100, score)
}


