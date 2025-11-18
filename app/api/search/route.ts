import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { searchRateLimiter, addRateLimitHeaders, createRateLimitResponse } from '@/lib/rateLimit'
import { sseService } from '@/lib/sseService'
import { searchService, SearchFilters } from '@/lib/searchService'

// Force dynamic execution to prevent caching
export const dynamic = 'force-dynamic'

// Input validation schema
const SearchRequestSchema = z.object({
  query: z.string().min(1).max(100).trim(),
  filters: z.object({
    city: z.string().optional(),
    eventType: z.string().optional(),
    price: z.string().optional(),
    date: z.string().optional(),
    platforms: z.array(z.string()).optional(),
  }).optional(),
  platforms: z.array(z.string()).optional(),
  maxResults: z.number().min(1).max(100).optional(),
})

export type SearchRequest = z.infer<typeof SearchRequestSchema>

/**
 * GET /api/search - Return method not allowed
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'Use POST method for search requests',
    },
    { status: 405 }
  )
}

/**
 * POST /api/search
 * Advanced search endpoint with database-first approach and live scraping fallback
 * Returns Server-Sent Events stream for real-time results
 */
export async function POST(request: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  try {
    console.log(`🌐 [API] Search request received: ${requestId}`, {
      requestId,
      method: request.method,
      url: request.url,
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length'),
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    })

    // 2. Parse and validate request body FIRST (before rate limiting)
    // This ensures we can read the body before any middleware consumes it
    let body
    try {
      // Check if body exists first
      const contentLength = request.headers.get('content-length')
      if (!contentLength || contentLength === '0') {
        throw new Error('Request body is empty')
      }
      body = await request.json()
      console.log(`🔍 [API] Parsed request body: ${requestId}`, {
        requestId,
        body,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.warn(`⚠️ [API] Invalid JSON body: ${requestId}`, {
        requestId,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      })
      // Return SSE error format so frontend can handle it
      const errorEvent = sseService.formatSSEEvent('error', {
        message: 'Invalid JSON body',
        error: 'Request body must be valid JSON',
      })
      return new Response(errorEvent, {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // 1. Rate limiting check (after body parsing to avoid consuming stream)
    const rateLimit = await searchRateLimiter.check(request)
    if (!rateLimit.allowed) {
      console.warn(`⚠️ [API] Rate limit exceeded: ${requestId}`, {
        requestId,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime
      })
      return createRateLimitResponse(rateLimit)
    }
    
    const validationResult = SearchRequestSchema.safeParse(body)
    
    if (!validationResult.success) {
      console.warn(`⚠️ [API] Invalid request: ${requestId}`, {
        requestId,
        errors: validationResult.error.errors,
        body
      })
      // Return SSE error format so frontend can handle it
      const errorEvent = sseService.formatSSEEvent('error', {
        message: 'Invalid request',
        error: validationResult.error.errors,
      })
      return new Response(errorEvent, {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    const { query, filters = {}, platforms = ['luma', 'eventbrite'], maxResults = 50 } = validationResult.data

    console.log(`🔍 [API] Processing search request: ${requestId}`, {
      requestId,
      query,
      filters,
      platforms,
      maxResults,
      timestamp: new Date().toISOString()
    })

    // 3. Check cache first for performance
    const cacheKey = searchService.generateCacheKey(query, filters)
    const cachedResults = await searchService.getCachedResults(cacheKey)
    
    if (cachedResults) {
      console.log(`💾 [API] Returning cached results: ${requestId}`, {
        requestId,
        query,
        cacheKey,
        cachedEventsCount: cachedResults.events.length,
        cachedAt: cachedResults.cachedAt,
        timestamp: new Date().toISOString()
      })
      
      // Return cached results as SSE stream
      const stream = new ReadableStream({
        start(controller) {
          // Stream cached events
          for (const event of cachedResults.events) {
            const sseEvent = `data: ${JSON.stringify({
              type: 'event',
              data: { event, source: 'cache', platform: event.sourcePlatform },
              timestamp: new Date().toISOString(),
            })}\n\n`
            controller.enqueue(new TextEncoder().encode(sseEvent))
          }
          
          // Stream completion
          const completionEvent = `data: ${JSON.stringify({
            type: 'search_complete',
            data: {
              totalEvents: cachedResults.events.length,
              source: 'cache',
              cached: true,
              cachedAt: cachedResults.cachedAt,
            },
            timestamp: new Date().toISOString(),
          })}\n\n`
          controller.enqueue(new TextEncoder().encode(completionEvent))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
        },
      })
    }

    // 4. No cached results - start live search
    console.log(`🚀 [API] Starting live search: ${requestId}`, {
      requestId,
      query,
      filters,
      platforms,
      maxResults,
      timestamp: new Date().toISOString()
    })
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream search results
          for await (const sseEvent of sseService.streamSearchResults(query, filters, platforms)) {
            controller.enqueue(new TextEncoder().encode(sseEvent))
          }
        } catch (error) {
          console.error(`❌ [API] Search stream error: ${requestId}`, {
            requestId,
            query,
            error: (error as Error).message,
            stack: (error as Error).stack,
            timestamp: new Date().toISOString()
          })
          const errorEvent = sseService.streamError(
            'Search failed',
            (error as Error).message
          )
          controller.enqueue(new TextEncoder().encode(errorEvent))
        } finally {
          console.log(`🏁 [API] Search stream completed: ${requestId}`, {
            requestId,
            query,
            timestamp: new Date().toISOString()
          })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Limit': rateLimit.limit.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
      },
    })

  } catch (error) {
    console.error(`❌ [API] Search API error: ${requestId}`, {
      requestId,
      error: (error as Error).message,
      stack: (error as Error).stack,
      timestamp: new Date().toISOString()
    })
    
    // Return error as SSE event
    const errorEvent = sseService.streamError(
      'Internal server error',
      (error as Error).message
    )
    
    return new Response(errorEvent, {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }
}

