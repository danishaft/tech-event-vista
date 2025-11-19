import { prisma } from './prisma'
import { cacheService } from './cache'

export interface SearchFilters {
  city?: string
  eventType?: string
  price?: string
  date?: string
  platforms?: string[]
}

export interface SearchResult {
  events: any[]
  total: number
  source: 'database' | 'cache'
  cachedAt?: Date
}

/**
 * Database-first search service with full-text search capabilities
 * Implements PostgreSQL full-text search with proper indexing strategy
 */
export class SearchService {
  /**
   * Search events in database with full-text search and filtering
   * @param query - Search query string
   * @param filters - Additional filters to apply
   * @param limit - Maximum number of results to return
   * @returns Search results with events and metadata
   */
  async searchDatabase(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50
  ): Promise<SearchResult> {
    try {
      // Build where clause with full-text search - always filter future events
      const now = new Date()
      const where = this.buildSearchWhereClause(query, filters)
      where.eventDate = { gte: now } // Only future events

      // Execute search query with proper ordering - select only needed fields
      // Use batch fetch for EventCategory to avoid N+1 (same fix as events API)
      const [eventsRaw, total] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: [
            { qualityScore: 'desc' },
            { eventDate: 'asc' },
          ],
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            eventType: true,
            eventDate: true,
            eventEndDate: true,
            venueName: true,
            venueAddress: true,
            city: true,
            country: true,
            isOnline: true,
            isFree: true,
            priceMin: true,
            priceMax: true,
            currency: true,
            organizerName: true,
            techStack: true,
            qualityScore: true,
            externalUrl: true,
            imageUrl: true,
            sourcePlatform: true,
          },
        }),
        prisma.event.count({ where }),
      ])

      // Batch fetch EventCategory to avoid N+1 queries
      const eventIds = eventsRaw.map(e => e.id)
      const categories = eventIds.length > 0
        ? await prisma.eventCategory.findMany({
            where: { eventId: { in: eventIds } },
            select: {
              eventId: true,
              category: true,
              value: true,
            },
          })
        : []

      // Group categories by eventId
      const categoriesByEventId = new Map<string, Array<{ category: string; value: string }>>()
      for (const cat of categories) {
        if (!categoriesByEventId.has(cat.eventId)) {
          categoriesByEventId.set(cat.eventId, [])
        }
        categoriesByEventId.get(cat.eventId)!.push({
          category: cat.category,
          value: cat.value,
        })
      }

      // Map events with their categories
      const events = eventsRaw.map(event => ({
        ...event,
        eventCategories: categoriesByEventId.get(event.id) || [],
      }))

      return {
        events,
        total,
        source: 'database',
      }
    } catch (error: any) {
      console.error('❌ [SEARCH] Database search error:', {
        error: error.message,
        stack: error.stack,
        query,
        filters
      })
      
      // If it's a database connection error, return empty results instead of throwing
      // This allows the search to fall back to live scraping
      if (error.message?.includes('Can\'t reach database') || 
          error.message?.includes('connection') ||
          error.message?.includes('timeout')) {
        console.warn('⚠️ [SEARCH] Database unavailable, will fall back to live scraping')
        return {
          events: [],
          total: 0,
          source: 'database',
        }
      }
      
      throw new Error(`Failed to search database: ${error.message}`)
    }
  }

  /**
   * Build Prisma where clause for search with full-text search
   * Implements PostgreSQL full-text search best practices
   */
  private buildSearchWhereClause(query: string, filters: SearchFilters) {
    const where: any = {
      status: 'active',
    }

    // Full-text search implementation
    if (query && query.trim()) {
      const searchTerm = query.trim()
      
      // PostgreSQL full-text search with multiple strategies
      where.OR = [
        // Title contains search term (case-insensitive)
        { title: { contains: searchTerm, mode: 'insensitive' } },
        
        // Description contains search term (case-insensitive)
        { description: { contains: searchTerm, mode: 'insensitive' } },
        
        // Tech stack array contains search term
        { techStack: { hasSome: [searchTerm] } },
        
        // Organizer name contains search term
        { organizerName: { contains: searchTerm, mode: 'insensitive' } },
        
        // Venue name contains search term
        { venueName: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    // Apply additional filters
    this.applyFilters(where, filters)

    return where
  }

  /**
   * Apply additional filters to the where clause
   * Maintains existing filtering logic from events API
   */
  private applyFilters(where: any, filters: SearchFilters) {
    // City filter (case-insensitive)
    if (filters.city && filters.city !== 'all') {
      where.city = { equals: filters.city, mode: 'insensitive' }
    }

    // Event type filter
    if (filters.eventType && filters.eventType !== 'all') {
      where.eventType = filters.eventType
    }

    // Price filter
    if (filters.price && filters.price !== 'all') {
      if (filters.price === 'free') {
        where.isFree = true
      } else if (filters.price === 'paid') {
        where.isFree = false
      }
    }

    // Date filter
    if (filters.date && filters.date !== 'all') {
      this.applyDateFilter(where, filters.date)
    }

    // Platform filter
    if (filters.platforms && filters.platforms.length > 0) {
      where.sourcePlatform = { in: filters.platforms }
    }
  }

  /**
   * Apply date range filter to where clause
   * Reuses existing date filtering logic
   */
  private applyDateFilter(where: any, dateFilter: string) {
    const now = new Date()

    switch (dateFilter) {
      case 'today': {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        where.eventDate = {
          gte: now,
          lt: tomorrow,
        }
        break
      }
      case 'thisWeek': {
        const nextWeek = new Date(now)
        nextWeek.setDate(nextWeek.getDate() + 7)
        where.eventDate = {
          gte: now,
          lt: nextWeek,
        }
        break
      }
      case 'thisMonth': {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        where.eventDate = {
          gte: now,
          lt: nextMonth,
        }
        break
      }
      case 'nextMonth': {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        const monthAfterNext = new Date(nextMonth)
        monthAfterNext.setMonth(monthAfterNext.getMonth() + 1)
        where.eventDate = {
          gte: nextMonth,
          lt: monthAfterNext,
        }
        break
      }
    }
  }

  /**
   * Check if search results are cached
   * Implements cache-first strategy for performance
   */
  async getCachedResults(cacheKey: string): Promise<SearchResult | null> {
    try {
      const cached = await cacheService.get<SearchResult>(cacheKey)
      if (cached) {
        return {
          ...cached,
          source: 'cache',
          cachedAt: new Date(),
        }
      }
      return null
    } catch (error) {
      console.error('Cache retrieval error:', error)
      return null
    }
  }

  /**
   * Cache search results with appropriate TTL
   * Implements smart caching strategy
   */
  async cacheResults(cacheKey: string, results: SearchResult, ttlSeconds: number = 3600): Promise<void> {
    try {
      await cacheService.set(cacheKey, results, ttlSeconds)
    } catch (error) {
      console.error('Cache storage error:', error)
      // Don't throw - caching failure shouldn't break search
    }
  }

  /**
   * Generate cache key for search query
   * Ensures consistent cache key generation with sanitization
   */
  generateCacheKey(query: string, filters: SearchFilters): string {
    // Sanitize query to prevent cache pollution
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
    const filterString = JSON.stringify(filters)
    return `search:${sanitizedQuery}:${filterString}`
  }
}

// Export singleton instance
export const searchService = new SearchService()


export interface SearchFilters {
  city?: string
  eventType?: string
  price?: string
  date?: string
  platforms?: string[]
}

export interface SearchResult {
  events: any[]
  total: number
  source: 'database' | 'cache'
  cachedAt?: Date
}

/**
 * Database-first search service with full-text search capabilities
 * Implements PostgreSQL full-text search with proper indexing strategy
 */
export class SearchService {
  /**
   * Search events in database with full-text search and filtering
   * @param query - Search query string
   * @param filters - Additional filters to apply
   * @param limit - Maximum number of results to return
   * @returns Search results with events and metadata
   */
  async searchDatabase(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50
  ): Promise<SearchResult> {
    try {
      // Build where clause with full-text search - always filter future events
      const now = new Date()
      const where = this.buildSearchWhereClause(query, filters)
      where.eventDate = { gte: now } // Only future events

      // Execute search query with proper ordering - select only needed fields
      // Use batch fetch for EventCategory to avoid N+1 (same fix as events API)
      const [eventsRaw, total] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: [
            { qualityScore: 'desc' },
            { eventDate: 'asc' },
          ],
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            eventType: true,
            eventDate: true,
            eventEndDate: true,
            venueName: true,
            venueAddress: true,
            city: true,
            country: true,
            isOnline: true,
            isFree: true,
            priceMin: true,
            priceMax: true,
            currency: true,
            organizerName: true,
            techStack: true,
            qualityScore: true,
            externalUrl: true,
            imageUrl: true,
            sourcePlatform: true,
          },
        }),
        prisma.event.count({ where }),
      ])

      // Batch fetch EventCategory to avoid N+1 queries
      const eventIds = eventsRaw.map(e => e.id)
      const categories = eventIds.length > 0
        ? await prisma.eventCategory.findMany({
            where: { eventId: { in: eventIds } },
            select: {
              eventId: true,
              category: true,
              value: true,
            },
          })
        : []

      // Group categories by eventId
      const categoriesByEventId = new Map<string, Array<{ category: string; value: string }>>()
      for (const cat of categories) {
        if (!categoriesByEventId.has(cat.eventId)) {
          categoriesByEventId.set(cat.eventId, [])
        }
        categoriesByEventId.get(cat.eventId)!.push({
          category: cat.category,
          value: cat.value,
        })
      }

      // Map events with their categories
      const events = eventsRaw.map(event => ({
        ...event,
        eventCategories: categoriesByEventId.get(event.id) || [],
      }))

      return {
        events,
        total,
        source: 'database',
      }
    } catch (error: any) {
      console.error('❌ [SEARCH] Database search error:', {
        error: error.message,
        stack: error.stack,
        query,
        filters
      })
      
      // If it's a database connection error, return empty results instead of throwing
      // This allows the search to fall back to live scraping
      if (error.message?.includes('Can\'t reach database') || 
          error.message?.includes('connection') ||
          error.message?.includes('timeout')) {
        console.warn('⚠️ [SEARCH] Database unavailable, will fall back to live scraping')
        return {
          events: [],
          total: 0,
          source: 'database',
        }
      }
      
      throw new Error(`Failed to search database: ${error.message}`)
    }
  }

  /**
   * Build Prisma where clause for search with full-text search
   * Implements PostgreSQL full-text search best practices
   */
  private buildSearchWhereClause(query: string, filters: SearchFilters) {
    const where: any = {
      status: 'active',
    }

    // Full-text search implementation
    if (query && query.trim()) {
      const searchTerm = query.trim()
      
      // PostgreSQL full-text search with multiple strategies
      where.OR = [
        // Title contains search term (case-insensitive)
        { title: { contains: searchTerm, mode: 'insensitive' } },
        
        // Description contains search term (case-insensitive)
        { description: { contains: searchTerm, mode: 'insensitive' } },
        
        // Tech stack array contains search term
        { techStack: { hasSome: [searchTerm] } },
        
        // Organizer name contains search term
        { organizerName: { contains: searchTerm, mode: 'insensitive' } },
        
        // Venue name contains search term
        { venueName: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    // Apply additional filters
    this.applyFilters(where, filters)

    return where
  }

  /**
   * Apply additional filters to the where clause
   * Maintains existing filtering logic from events API
   */
  private applyFilters(where: any, filters: SearchFilters) {
    // City filter (case-insensitive)
    if (filters.city && filters.city !== 'all') {
      where.city = { equals: filters.city, mode: 'insensitive' }
    }

    // Event type filter
    if (filters.eventType && filters.eventType !== 'all') {
      where.eventType = filters.eventType
    }

    // Price filter
    if (filters.price && filters.price !== 'all') {
      if (filters.price === 'free') {
        where.isFree = true
      } else if (filters.price === 'paid') {
        where.isFree = false
      }
    }

    // Date filter
    if (filters.date && filters.date !== 'all') {
      this.applyDateFilter(where, filters.date)
    }

    // Platform filter
    if (filters.platforms && filters.platforms.length > 0) {
      where.sourcePlatform = { in: filters.platforms }
    }
  }

  /**
   * Apply date range filter to where clause
   * Reuses existing date filtering logic
   */
  private applyDateFilter(where: any, dateFilter: string) {
    const now = new Date()

    switch (dateFilter) {
      case 'today': {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        where.eventDate = {
          gte: now,
          lt: tomorrow,
        }
        break
      }
      case 'thisWeek': {
        const nextWeek = new Date(now)
        nextWeek.setDate(nextWeek.getDate() + 7)
        where.eventDate = {
          gte: now,
          lt: nextWeek,
        }
        break
      }
      case 'thisMonth': {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        where.eventDate = {
          gte: now,
          lt: nextMonth,
        }
        break
      }
      case 'nextMonth': {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        const monthAfterNext = new Date(nextMonth)
        monthAfterNext.setMonth(monthAfterNext.getMonth() + 1)
        where.eventDate = {
          gte: nextMonth,
          lt: monthAfterNext,
        }
        break
      }
    }
  }

  /**
   * Check if search results are cached
   * Implements cache-first strategy for performance
   */
  async getCachedResults(cacheKey: string): Promise<SearchResult | null> {
    try {
      const cached = await cacheService.get<SearchResult>(cacheKey)
      if (cached) {
        return {
          ...cached,
          source: 'cache',
          cachedAt: new Date(),
        }
      }
      return null
    } catch (error) {
      console.error('Cache retrieval error:', error)
      return null
    }
  }

  /**
   * Cache search results with appropriate TTL
   * Implements smart caching strategy
   */
  async cacheResults(cacheKey: string, results: SearchResult, ttlSeconds: number = 3600): Promise<void> {
    try {
      await cacheService.set(cacheKey, results, ttlSeconds)
    } catch (error) {
      console.error('Cache storage error:', error)
      // Don't throw - caching failure shouldn't break search
    }
  }

  /**
   * Generate cache key for search query
   * Ensures consistent cache key generation with sanitization
   */
  generateCacheKey(query: string, filters: SearchFilters): string {
    // Sanitize query to prevent cache pollution
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
    const filterString = JSON.stringify(filters)
    return `search:${sanitizedQuery}:${filterString}`
  }
}

// Export singleton instance
export const searchService = new SearchService()




export interface SearchFilters {
  city?: string
  eventType?: string
  price?: string
  date?: string
  platforms?: string[]
}

export interface SearchResult {
  events: any[]
  total: number
  source: 'database' | 'cache'
  cachedAt?: Date
}

/**
 * Database-first search service with full-text search capabilities
 * Implements PostgreSQL full-text search with proper indexing strategy
 */
export class SearchService {
  /**
   * Search events in database with full-text search and filtering
   * @param query - Search query string
   * @param filters - Additional filters to apply
   * @param limit - Maximum number of results to return
   * @returns Search results with events and metadata
   */
  async searchDatabase(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50
  ): Promise<SearchResult> {
    try {
      // Build where clause with full-text search - always filter future events
      const now = new Date()
      const where = this.buildSearchWhereClause(query, filters)
      where.eventDate = { gte: now } // Only future events

      // Execute search query with proper ordering - select only needed fields
      // Use batch fetch for EventCategory to avoid N+1 (same fix as events API)
      const [eventsRaw, total] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: [
            { qualityScore: 'desc' },
            { eventDate: 'asc' },
          ],
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            eventType: true,
            eventDate: true,
            eventEndDate: true,
            venueName: true,
            venueAddress: true,
            city: true,
            country: true,
            isOnline: true,
            isFree: true,
            priceMin: true,
            priceMax: true,
            currency: true,
            organizerName: true,
            techStack: true,
            qualityScore: true,
            externalUrl: true,
            imageUrl: true,
            sourcePlatform: true,
          },
        }),
        prisma.event.count({ where }),
      ])

      // Batch fetch EventCategory to avoid N+1 queries
      const eventIds = eventsRaw.map(e => e.id)
      const categories = eventIds.length > 0
        ? await prisma.eventCategory.findMany({
            where: { eventId: { in: eventIds } },
            select: {
              eventId: true,
              category: true,
              value: true,
            },
          })
        : []

      // Group categories by eventId
      const categoriesByEventId = new Map<string, Array<{ category: string; value: string }>>()
      for (const cat of categories) {
        if (!categoriesByEventId.has(cat.eventId)) {
          categoriesByEventId.set(cat.eventId, [])
        }
        categoriesByEventId.get(cat.eventId)!.push({
          category: cat.category,
          value: cat.value,
        })
      }

      // Map events with their categories
      const events = eventsRaw.map(event => ({
        ...event,
        eventCategories: categoriesByEventId.get(event.id) || [],
      }))

      return {
        events,
        total,
        source: 'database',
      }
    } catch (error: any) {
      console.error('❌ [SEARCH] Database search error:', {
        error: error.message,
        stack: error.stack,
        query,
        filters
      })
      
      // If it's a database connection error, return empty results instead of throwing
      // This allows the search to fall back to live scraping
      if (error.message?.includes('Can\'t reach database') || 
          error.message?.includes('connection') ||
          error.message?.includes('timeout')) {
        console.warn('⚠️ [SEARCH] Database unavailable, will fall back to live scraping')
        return {
          events: [],
          total: 0,
          source: 'database',
        }
      }
      
      throw new Error(`Failed to search database: ${error.message}`)
    }
  }

  /**
   * Build Prisma where clause for search with full-text search
   * Implements PostgreSQL full-text search best practices
   */
  private buildSearchWhereClause(query: string, filters: SearchFilters) {
    const where: any = {
      status: 'active',
    }

    // Full-text search implementation
    if (query && query.trim()) {
      const searchTerm = query.trim()
      
      // PostgreSQL full-text search with multiple strategies
      where.OR = [
        // Title contains search term (case-insensitive)
        { title: { contains: searchTerm, mode: 'insensitive' } },
        
        // Description contains search term (case-insensitive)
        { description: { contains: searchTerm, mode: 'insensitive' } },
        
        // Tech stack array contains search term
        { techStack: { hasSome: [searchTerm] } },
        
        // Organizer name contains search term
        { organizerName: { contains: searchTerm, mode: 'insensitive' } },
        
        // Venue name contains search term
        { venueName: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    // Apply additional filters
    this.applyFilters(where, filters)

    return where
  }

  /**
   * Apply additional filters to the where clause
   * Maintains existing filtering logic from events API
   */
  private applyFilters(where: any, filters: SearchFilters) {
    // City filter (case-insensitive)
    if (filters.city && filters.city !== 'all') {
      where.city = { equals: filters.city, mode: 'insensitive' }
    }

    // Event type filter
    if (filters.eventType && filters.eventType !== 'all') {
      where.eventType = filters.eventType
    }

    // Price filter
    if (filters.price && filters.price !== 'all') {
      if (filters.price === 'free') {
        where.isFree = true
      } else if (filters.price === 'paid') {
        where.isFree = false
      }
    }

    // Date filter
    if (filters.date && filters.date !== 'all') {
      this.applyDateFilter(where, filters.date)
    }

    // Platform filter
    if (filters.platforms && filters.platforms.length > 0) {
      where.sourcePlatform = { in: filters.platforms }
    }
  }

  /**
   * Apply date range filter to where clause
   * Reuses existing date filtering logic
   */
  private applyDateFilter(where: any, dateFilter: string) {
    const now = new Date()

    switch (dateFilter) {
      case 'today': {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        where.eventDate = {
          gte: now,
          lt: tomorrow,
        }
        break
      }
      case 'thisWeek': {
        const nextWeek = new Date(now)
        nextWeek.setDate(nextWeek.getDate() + 7)
        where.eventDate = {
          gte: now,
          lt: nextWeek,
        }
        break
      }
      case 'thisMonth': {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        where.eventDate = {
          gte: now,
          lt: nextMonth,
        }
        break
      }
      case 'nextMonth': {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        const monthAfterNext = new Date(nextMonth)
        monthAfterNext.setMonth(monthAfterNext.getMonth() + 1)
        where.eventDate = {
          gte: nextMonth,
          lt: monthAfterNext,
        }
        break
      }
    }
  }

  /**
   * Check if search results are cached
   * Implements cache-first strategy for performance
   */
  async getCachedResults(cacheKey: string): Promise<SearchResult | null> {
    try {
      const cached = await cacheService.get<SearchResult>(cacheKey)
      if (cached) {
        return {
          ...cached,
          source: 'cache',
          cachedAt: new Date(),
        }
      }
      return null
    } catch (error) {
      console.error('Cache retrieval error:', error)
      return null
    }
  }

  /**
   * Cache search results with appropriate TTL
   * Implements smart caching strategy
   */
  async cacheResults(cacheKey: string, results: SearchResult, ttlSeconds: number = 3600): Promise<void> {
    try {
      await cacheService.set(cacheKey, results, ttlSeconds)
    } catch (error) {
      console.error('Cache storage error:', error)
      // Don't throw - caching failure shouldn't break search
    }
  }

  /**
   * Generate cache key for search query
   * Ensures consistent cache key generation with sanitization
   */
  generateCacheKey(query: string, filters: SearchFilters): string {
    // Sanitize query to prevent cache pollution
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
    const filterString = JSON.stringify(filters)
    return `search:${sanitizedQuery}:${filterString}`
  }
}

// Export singleton instance
export const searchService = new SearchService()


export interface SearchFilters {
  city?: string
  eventType?: string
  price?: string
  date?: string
  platforms?: string[]
}

export interface SearchResult {
  events: any[]
  total: number
  source: 'database' | 'cache'
  cachedAt?: Date
}

/**
 * Database-first search service with full-text search capabilities
 * Implements PostgreSQL full-text search with proper indexing strategy
 */
export class SearchService {
  /**
   * Search events in database with full-text search and filtering
   * @param query - Search query string
   * @param filters - Additional filters to apply
   * @param limit - Maximum number of results to return
   * @returns Search results with events and metadata
   */
  async searchDatabase(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50
  ): Promise<SearchResult> {
    try {
      // Build where clause with full-text search - always filter future events
      const now = new Date()
      const where = this.buildSearchWhereClause(query, filters)
      where.eventDate = { gte: now } // Only future events

      // Execute search query with proper ordering - select only needed fields
      // Use batch fetch for EventCategory to avoid N+1 (same fix as events API)
      const [eventsRaw, total] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: [
            { qualityScore: 'desc' },
            { eventDate: 'asc' },
          ],
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            eventType: true,
            eventDate: true,
            eventEndDate: true,
            venueName: true,
            venueAddress: true,
            city: true,
            country: true,
            isOnline: true,
            isFree: true,
            priceMin: true,
            priceMax: true,
            currency: true,
            organizerName: true,
            techStack: true,
            qualityScore: true,
            externalUrl: true,
            imageUrl: true,
            sourcePlatform: true,
          },
        }),
        prisma.event.count({ where }),
      ])

      // Batch fetch EventCategory to avoid N+1 queries
      const eventIds = eventsRaw.map(e => e.id)
      const categories = eventIds.length > 0
        ? await prisma.eventCategory.findMany({
            where: { eventId: { in: eventIds } },
            select: {
              eventId: true,
              category: true,
              value: true,
            },
          })
        : []

      // Group categories by eventId
      const categoriesByEventId = new Map<string, Array<{ category: string; value: string }>>()
      for (const cat of categories) {
        if (!categoriesByEventId.has(cat.eventId)) {
          categoriesByEventId.set(cat.eventId, [])
        }
        categoriesByEventId.get(cat.eventId)!.push({
          category: cat.category,
          value: cat.value,
        })
      }

      // Map events with their categories
      const events = eventsRaw.map(event => ({
        ...event,
        eventCategories: categoriesByEventId.get(event.id) || [],
      }))

      return {
        events,
        total,
        source: 'database',
      }
    } catch (error: any) {
      console.error('❌ [SEARCH] Database search error:', {
        error: error.message,
        stack: error.stack,
        query,
        filters
      })
      
      // If it's a database connection error, return empty results instead of throwing
      // This allows the search to fall back to live scraping
      if (error.message?.includes('Can\'t reach database') || 
          error.message?.includes('connection') ||
          error.message?.includes('timeout')) {
        console.warn('⚠️ [SEARCH] Database unavailable, will fall back to live scraping')
        return {
          events: [],
          total: 0,
          source: 'database',
        }
      }
      
      throw new Error(`Failed to search database: ${error.message}`)
    }
  }

  /**
   * Build Prisma where clause for search with full-text search
   * Implements PostgreSQL full-text search best practices
   */
  private buildSearchWhereClause(query: string, filters: SearchFilters) {
    const where: any = {
      status: 'active',
    }

    // Full-text search implementation
    if (query && query.trim()) {
      const searchTerm = query.trim()
      
      // PostgreSQL full-text search with multiple strategies
      where.OR = [
        // Title contains search term (case-insensitive)
        { title: { contains: searchTerm, mode: 'insensitive' } },
        
        // Description contains search term (case-insensitive)
        { description: { contains: searchTerm, mode: 'insensitive' } },
        
        // Tech stack array contains search term
        { techStack: { hasSome: [searchTerm] } },
        
        // Organizer name contains search term
        { organizerName: { contains: searchTerm, mode: 'insensitive' } },
        
        // Venue name contains search term
        { venueName: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    // Apply additional filters
    this.applyFilters(where, filters)

    return where
  }

  /**
   * Apply additional filters to the where clause
   * Maintains existing filtering logic from events API
   */
  private applyFilters(where: any, filters: SearchFilters) {
    // City filter (case-insensitive)
    if (filters.city && filters.city !== 'all') {
      where.city = { equals: filters.city, mode: 'insensitive' }
    }

    // Event type filter
    if (filters.eventType && filters.eventType !== 'all') {
      where.eventType = filters.eventType
    }

    // Price filter
    if (filters.price && filters.price !== 'all') {
      if (filters.price === 'free') {
        where.isFree = true
      } else if (filters.price === 'paid') {
        where.isFree = false
      }
    }

    // Date filter
    if (filters.date && filters.date !== 'all') {
      this.applyDateFilter(where, filters.date)
    }

    // Platform filter
    if (filters.platforms && filters.platforms.length > 0) {
      where.sourcePlatform = { in: filters.platforms }
    }
  }

  /**
   * Apply date range filter to where clause
   * Reuses existing date filtering logic
   */
  private applyDateFilter(where: any, dateFilter: string) {
    const now = new Date()

    switch (dateFilter) {
      case 'today': {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        where.eventDate = {
          gte: now,
          lt: tomorrow,
        }
        break
      }
      case 'thisWeek': {
        const nextWeek = new Date(now)
        nextWeek.setDate(nextWeek.getDate() + 7)
        where.eventDate = {
          gte: now,
          lt: nextWeek,
        }
        break
      }
      case 'thisMonth': {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        where.eventDate = {
          gte: now,
          lt: nextMonth,
        }
        break
      }
      case 'nextMonth': {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        const monthAfterNext = new Date(nextMonth)
        monthAfterNext.setMonth(monthAfterNext.getMonth() + 1)
        where.eventDate = {
          gte: nextMonth,
          lt: monthAfterNext,
        }
        break
      }
    }
  }

  /**
   * Check if search results are cached
   * Implements cache-first strategy for performance
   */
  async getCachedResults(cacheKey: string): Promise<SearchResult | null> {
    try {
      const cached = await cacheService.get<SearchResult>(cacheKey)
      if (cached) {
        return {
          ...cached,
          source: 'cache',
          cachedAt: new Date(),
        }
      }
      return null
    } catch (error) {
      console.error('Cache retrieval error:', error)
      return null
    }
  }

  /**
   * Cache search results with appropriate TTL
   * Implements smart caching strategy
   */
  async cacheResults(cacheKey: string, results: SearchResult, ttlSeconds: number = 3600): Promise<void> {
    try {
      await cacheService.set(cacheKey, results, ttlSeconds)
    } catch (error) {
      console.error('Cache storage error:', error)
      // Don't throw - caching failure shouldn't break search
    }
  }

  /**
   * Generate cache key for search query
   * Ensures consistent cache key generation with sanitization
   */
  generateCacheKey(query: string, filters: SearchFilters): string {
    // Sanitize query to prevent cache pollution
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
    const filterString = JSON.stringify(filters)
    return `search:${sanitizedQuery}:${filterString}`
  }
}

// Export singleton instance
export const searchService = new SearchService()

