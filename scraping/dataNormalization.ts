import { ScrapedEvent } from './eventbriteScraping'

// Production-ready data normalization and cleaning utilities
export class EventDataNormalizer {
  
  /**
   * Normalize and clean scraped event data
   */
  static normalizeEvent(event: ScrapedEvent): ScrapedEvent {
    return {
      ...event,
      title: this.cleanText(event.title),
      description: this.cleanText(event.description),
      venueName: this.cleanText(event.venueName),
      venueAddress: this.cleanText(event.venueAddress),
      city: this.normalizeCity(event.city),
      country: this.normalizeCountry(event.country),
      organizerName: this.cleanText(event.organizerName),
      organizerDescription: this.cleanText(event.organizerDescription),
      techStack: this.normalizeTechStack(event.techStack),
      externalUrl: this.normalizeUrl(event.externalUrl),
      imageUrl: this.normalizeUrl(event.imageUrl),
      sourceId: this.normalizeSourceId(event.sourceId, event.sourcePlatform),
    }
  }

  /**
   * Clean and normalize text content
   */
  private static cleanText(text?: string): string {
    if (!text) return ''
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s\-.,!?()]/g, '') // Remove special characters except basic punctuation
      .substring(0, 1000) // Limit length
  }

  /**
   * Normalize city names
   */
  private static normalizeCity(city: string): string {
    if (!city) return 'Unknown'
    
    const cityMap: Record<string, string> = {
      'san francisco': 'San Francisco',
      'sf': 'San Francisco',
      'new york': 'New York',
      'nyc': 'New York',
      'los angeles': 'Los Angeles',
      'la': 'Los Angeles',
      'seattle': 'Seattle',
      'austin': 'Austin',
      'boston': 'Boston',
      'chicago': 'Chicago',
    }

    const normalized = city.toLowerCase().trim()
    return cityMap[normalized] || city
  }

  /**
   * Normalize country names
   */
  private static normalizeCountry(country: string): string {
    if (!country) return 'US'
    
    const countryMap: Record<string, string> = {
      'usa': 'US',
      'united states': 'US',
      'america': 'US',
      'uk': 'GB',
      'united kingdom': 'GB',
      'canada': 'CA',
    }

    const normalized = country.toLowerCase().trim()
    return countryMap[normalized] || country.toUpperCase()
  }

  /**
   * Normalize and deduplicate tech stack
   */
  private static normalizeTechStack(techStack: string[]): string[] {
    if (!techStack || techStack.length === 0) return []

    const normalizedTech = techStack
      .map(tech => tech.trim())
      .filter(tech => tech.length > 0)
      .map(tech => this.normalizeTechName(tech))

    // Remove duplicates and return unique tech stack
    return [...new Set(normalizedTech)]
  }

  /**
   * Normalize tech names to standard format
   */
  private static normalizeTechName(tech: string): string {
    const techMap: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'reactjs': 'React',
      'react.js': 'React',
      'vuejs': 'Vue',
      'vue.js': 'Vue',
      'angularjs': 'Angular',
      'angular.js': 'Angular',
      'nodejs': 'Node.js',
      'node.js': 'Node.js',
      'python3': 'Python',
      'py': 'Python',
      'java8': 'Java',
      'java11': 'Java',
      'csharp': 'C#',
      'c++': 'C++',
      'golang': 'Go',
      'rustlang': 'Rust',
      'php7': 'PHP',
      'php8': 'PHP',
      'ruby2': 'Ruby',
      'ruby3': 'Ruby',
      'swift5': 'Swift',
      'kotlin': 'Kotlin',
      'docker': 'Docker',
      'kubernetes': 'Kubernetes',
      'k8s': 'Kubernetes',
      'aws': 'AWS',
      'azure': 'Azure',
      'gcp': 'GCP',
      'google cloud': 'GCP',
      'machine learning': 'Machine Learning',
      'ml': 'Machine Learning',
      'artificial intelligence': 'AI',
      'ai': 'AI',
      'data science': 'Data Science',
      'blockchain': 'Blockchain',
      'web3': 'Web3',
      'devops': 'DevOps',
      'frontend': 'Frontend',
      'backend': 'Backend',
      'fullstack': 'Full Stack',
      'full stack': 'Full Stack',
      'mobile': 'Mobile',
      'ios': 'iOS',
      'android': 'Android',
      'flutter': 'Flutter',
      'react native': 'React Native',
    }

    const normalized = tech.toLowerCase().trim()
    return techMap[normalized] || tech
  }

  /**
   * Normalize URLs
   */
  private static normalizeUrl(url?: string): string {
    if (!url) return ''
    
    try {
      // Ensure URL has protocol
      if (!url.startsWith('http')) {
        url = 'https://' + url
      }
      
      const urlObj = new URL(url)
      return urlObj.toString()
    } catch {
      return ''
    }
  }

  /**
   * Normalize source ID
   */
  private static normalizeSourceId(sourceId: string, platform: string): string {
    if (!sourceId) return `${platform}-${Date.now()}`
    
    // Remove any special characters and ensure it's alphanumeric
    return sourceId.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 100)
  }
}

/**
 * Deduplicate events based on title, date, and venue
 */
export function deduplicateEvents(events: ScrapedEvent[]): ScrapedEvent[] {
  const seen = new Set<string>()
  const deduplicated: ScrapedEvent[] = []

  for (const event of events) {
    // Create a unique key for deduplication
    const key = `${event.title.toLowerCase()}-${event.eventDate.toISOString()}-${event.venueName?.toLowerCase() || 'online'}`
    
    if (!seen.has(key)) {
      seen.add(key)
      deduplicated.push(event)
    }
  }

  return deduplicated
}

/**
 * Validate event data quality
 */
export function validateEventData(event: ScrapedEvent): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!event.title || event.title.trim().length === 0) {
    errors.push('Title is required')
  }

  if (!event.eventDate || isNaN(event.eventDate.getTime())) {
    errors.push('Valid event date is required')
  }

  if (!event.city || event.city.trim().length === 0) {
    errors.push('City is required')
  }

  if (!event.sourcePlatform || event.sourcePlatform.trim().length === 0) {
    errors.push('Source platform is required')
  }

  if (!event.sourceId || event.sourceId.trim().length === 0) {
    errors.push('Source ID is required')
  }

  // Check if event is in the past
  if (event.eventDate && event.eventDate < new Date()) {
    errors.push('Event date cannot be in the past')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}


