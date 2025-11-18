import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cacheService } from '@/lib/cache'
import { apiRateLimiter, addRateLimitHeaders, createRateLimitResponse } from '@/lib/rateLimit'
import { performanceMonitor, createRequestTrace } from '@/lib/performance'

export async function GET(request: NextRequest) {
  const requestId = `events-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const trace = createRequestTrace(requestId)
  const endTotal = performanceMonitor.start('api.events.GET')
  
  try {
    // Check rate limit
    const endRateLimit = trace.trace('rateLimit.check')
    const rateLimit = await apiRateLimiter.check(request)
    endRateLimit()
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const city = searchParams.get('city') || undefined
    const eventType = searchParams.get('eventType') || undefined
    const price = searchParams.get('price') || undefined
    const date = searchParams.get('date') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Check cache first for performance
    const endCache = trace.trace('cache.get')
    const cacheKey = `events:${JSON.stringify({ city, eventType, price, date, page, limit })}`
    const cached = await cacheService.get(cacheKey)
    endCache()
    
    if (cached) {
      console.log(`✅ [PERF] Cache hit for ${requestId}`)
      const response = NextResponse.json(cached)
      endTotal()
      return addRateLimitHeaders(response, rateLimit)
    }
    console.log(`❌ [PERF] Cache miss for ${requestId}`)

    // Build where clause - always filter out past events and only active
    const now = new Date()
    const where: any = {
      status: 'active',
      eventDate: {
        gte: now, // Only future events
      },
    }

    if (city && city !== 'all') {
      where.city = { equals: city, mode: 'insensitive' }
    }

    if (eventType && eventType !== 'all') {
      where.eventType = eventType
    }

    if (price && price !== 'all') {
      if (price === 'free') {
        where.isFree = true
      } else if (price === 'paid') {
        where.isFree = false
      }
    }

    if (date && date !== 'all') {
      if (date === 'today') {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        where.eventDate = {
          gte: now,
          lt: tomorrow,
        }
      } else if (date === 'thisWeek') {
        const nextWeek = new Date(now)
        nextWeek.setDate(nextWeek.getDate() + 7)
        where.eventDate = {
          gte: now,
          lt: nextWeek,
        }
      } else if (date === 'thisMonth') {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        where.eventDate = {
          gte: now,
          lt: nextMonth,
        }
      }
    }

    // Fetch events from database - optimize by selecting only needed fields
    // Add retry logic for database connection failures
    const endDbQuery = trace.trace('db.query')
    let events: any[] = []
    let total = 0
    
    try {
      // Fetch events and count in parallel
      // Note: We fetch EventCategory separately in a batch to avoid N+1
      // This is more efficient than Prisma's nested select which causes separate queries
      const [eventsRaw, totalCount] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: [
            { qualityScore: 'desc' },
            { eventDate: 'asc' },
          ],
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            eventType: true,
            status: true,
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
            organizerDescription: true,
            organizerRating: true,
            capacity: true,
            registeredCount: true,
            techStack: true,
            qualityScore: true,
            externalUrl: true,
            imageUrl: true,
            sourcePlatform: true,
            sourceId: true,
            scrapedAt: true,
            lastUpdated: true,
            createdAt: true,
          },
        }),
        prisma.event.count({ where }),
      ])
      
      // Batch fetch all EventCategories for these events in a single query
      // This avoids N+1 by fetching all categories at once instead of per event
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
      events = eventsRaw.map(event => ({
        ...event,
        eventCategories: categoriesByEventId.get(event.id) || [],
      }))
      
      total = totalCount
    } catch (dbError: any) {
      // Handle database connection errors gracefully
      // Log the full error for debugging
      console.error('❌ [DB] Database error:', {
        code: dbError?.code,
        message: dbError?.message,
        name: dbError?.name,
      })
      
      if (dbError?.code === 'P1001' || dbError?.message?.includes("Can't reach database server")) {
        console.error('❌ [DB] Database connection failed - returning empty result')
        // Return 200 with empty array instead of 503 to avoid breaking the frontend
        // The frontend can handle empty arrays gracefully
        const emptyResult = {
          events: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        }
        const response = NextResponse.json(emptyResult)
        endDbQuery()
        endTotal()
        return addRateLimitHeaders(response, rateLimit)
      }
      // Re-throw other errors to be caught by outer catch
      throw dbError
    }
    endDbQuery()

    const result = {
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }

    // Cache for 30 seconds
    const endCacheSet = trace.trace('cache.set')
    await cacheService.set(cacheKey, result, 30)
    endCacheSet()

    const summary = trace.getSummary()
    console.log(`📊 [PERF] ${requestId} completed in ${summary.totalDuration.toFixed(2)}ms:`, 
      Object.entries(summary.summary).map(([k, v]) => `${k}:${v.toFixed(2)}ms`).join(', '))

    const response = NextResponse.json(result)
    endTotal()
    return addRateLimitHeaders(response, rateLimit)
  } catch (error) {
    endTotal()
    console.error(`❌ [PERF] ${requestId} failed:`, error)
    const summary = trace.getSummary()
    console.log(`📊 [PERF] ${requestId} failed after ${summary.totalDuration.toFixed(2)}ms`)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // TODO: Add validation
    const event = await prisma.event.create({
      data: {
        title: body.title,
        description: body.description,
        eventType: body.eventType,
        eventDate: new Date(body.eventDate),
        eventEndDate: body.eventEndDate ? new Date(body.eventEndDate) : null,
        venueName: body.venueName,
        venueAddress: body.venueAddress,
        city: body.city,
        country: body.country || 'US',
        isOnline: body.isOnline || false,
        isFree: body.isFree || false,
        priceMin: body.priceMin,
        priceMax: body.priceMax,
        currency: body.currency || 'USD',
        organizerName: body.organizerName,
        organizerDescription: body.organizerDescription,
        organizerRating: body.organizerRating,
        capacity: body.capacity,
        registeredCount: body.registeredCount || 0,
        techStack: body.techStack || [],
        qualityScore: body.qualityScore || 0,
        externalUrl: body.externalUrl,
        imageUrl: body.imageUrl,
        sourcePlatform: body.sourcePlatform,
        sourceId: body.sourceId,
      },
    })

    // Note: Cache invalidation will be handled by search API when implemented

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}


