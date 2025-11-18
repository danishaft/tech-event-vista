import { NextRequest } from 'next/server'
import { cacheService } from './cache'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  limit: number
}

export class RateLimiter {
  private limit: number
  private windowSeconds: number

  constructor(limit: number = 10, windowSeconds: number = 900) { // 10 requests per 15 minutes by default
    this.limit = limit
    this.windowSeconds = windowSeconds
  }

  async check(request: NextRequest): Promise<RateLimitResult> {
    // Get client identifier (IP address or user ID)
    const identifier = this.getClientIdentifier(request)
    
    const result = await cacheService.checkRateLimit(
      identifier,
      this.limit,
      this.windowSeconds
    )

    return {
      ...result,
      limit: this.limit
    }
  }

  private getClientIdentifier(request: NextRequest): string {
    // Try to get IP from various headers
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    
    let ip = forwarded?.split(',')[0] || realIp || cfConnectingIp
    
    // Fallback to connection remote address
    if (!ip) {
      ip = 'unknown'
    }

    return ip
  }
}

// Pre-configured rate limiters for different endpoints
export const searchRateLimiter = new RateLimiter(100, 900) // 100 searches per 15 minutes (increased for development)
export const apiRateLimiter = new RateLimiter(100, 900)   // 100 API calls per 15 minutes
export const scrapingRateLimiter = new RateLimiter(3, 3600) // 3 scraping requests per hour

// Helper function to add rate limit headers to response
export function addRateLimitHeaders(response: Response, rateLimit: RateLimitResult): Response {
  response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString())
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString())
  response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString())
  
  return response
}

// Helper function to create rate limit error response
export function createRateLimitResponse(rateLimit: RateLimitResult): Response {
  const response = new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`,
      retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
      }
    }
  )

  return addRateLimitHeaders(response, rateLimit)
}

