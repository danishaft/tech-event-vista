import { cacheConnection } from './redis'

// Check if Redis is disabled via environment variable
const REDIS_DISABLED = process.env.DISABLE_REDIS === 'true' || !process.env.UPSTASH_REDIS_REST_URL

// In-memory cache for when Redis is disabled
interface CacheEntry {
  value: any
  expiresAt: number
}

class InMemoryCache {
  private cache: Map<string, CacheEntry> = new Map()
  public rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map()

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return entry.value as T
  }

  set(key: string, value: any, ttlSeconds?: number): boolean {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : Date.now() + (24 * 60 * 60 * 1000) // Default 24h
    this.cache.set(key, { value, expiresAt })
    return true
  }

  del(key: string): boolean {
    return this.cache.delete(key)
  }

  exists(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  // In-memory rate limiting
  checkRateLimit(key: string, limit: number, windowSeconds: number): { count: number; resetTime: number } {
    const now = Date.now()
    const entry = this.rateLimitCounters.get(key)
    
    if (!entry || now > entry.resetTime) {
      // New window
      const resetTime = now + (windowSeconds * 1000)
      this.rateLimitCounters.set(key, { count: 1, resetTime })
      return { count: 1, resetTime }
    }
    
    // Increment counter
    entry.count++
    this.rateLimitCounters.set(key, entry)
    return { count: entry.count, resetTime: entry.resetTime }
  }

  keys(pattern: string): string[] {
    const regex = new RegExp(pattern.replace('*', '.*'))
    const keys: string[] = []
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keys.push(key)
      }
    }
    return keys
  }

  // Cleanup expired entries periodically
  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
    // Cleanup rate limit counters
    for (const [key, entry] of this.rateLimitCounters.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitCounters.delete(key)
      }
    }
  }
}

// Global in-memory cache instance
const inMemoryCache = new InMemoryCache()

// Cleanup expired entries every 5 minutes
if (REDIS_DISABLED && typeof setInterval !== 'undefined') {
  setInterval(() => inMemoryCache.cleanup(), 5 * 60 * 1000)
}

// Cache utility functions
export class CacheService {
  private redis: typeof cacheConnection | null = null

  constructor(redis?: typeof cacheConnection) {
    this.redis = redis || null
  }

  private getRedis() {
    if (REDIS_DISABLED) return null
    if (!this.redis) {
      this.redis = cacheConnection
    }
    return this.redis
  }

  // Generic cache operations
  // Uses in-memory cache when Redis is disabled
  async get<T>(key: string): Promise<T | null> {
    // Use in-memory cache if Redis is disabled
    if (REDIS_DISABLED) {
      return inMemoryCache.get<T>(key)
    }

    try {
      const redis = this.getRedis()
      if (!redis) return inMemoryCache.get<T>(key) // Fallback to in-memory
      
      // Redis.get already has timeout in redis.ts wrapper
      const value = await redis.get(key) as string | null
      
      return value ? JSON.parse(value as string) : null
    } catch (error) {
      // Silently fail - don't log every cache miss as error
      // Only log if it's not a timeout/connection error
      if (!(error instanceof Error && (error.message.includes('timeout') || error.message.includes('ENOTFOUND')))) {
        console.error(`Cache get error for key ${key}:`, error)
      }
      // Fallback to in-memory cache
      return inMemoryCache.get<T>(key)
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    // Use in-memory cache if Redis is disabled
    if (REDIS_DISABLED) {
      return inMemoryCache.set(key, value, ttlSeconds)
    }

    try {
      const redis = this.getRedis()
      if (!redis) {
        // Fallback to in-memory
        return inMemoryCache.set(key, value, ttlSeconds)
      }
      
      const serialized = JSON.stringify(value)
      
      // Redis.set already has timeout in redis.ts wrapper
      if (ttlSeconds) {
        await redis.set(key, serialized, { ex: ttlSeconds })
      } else {
        await redis.set(key, serialized)
      }
      
      return true
    } catch (error) {
      // Silently fail - don't block requests if cache fails
      if (!(error instanceof Error && (error.message.includes('timeout') || error.message.includes('ENOTFOUND')))) {
        console.error(`Cache set error for key ${key}:`, error)
      }
      // Fallback to in-memory cache
      return inMemoryCache.set(key, value, ttlSeconds)
    }
  }

  async del(key: string): Promise<boolean> {
    if (REDIS_DISABLED) {
      return inMemoryCache.del(key)
    }

    try {
      const redis = this.getRedis()
      if (!redis) return inMemoryCache.del(key)
      await redis.del(key)
      return true
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
      return inMemoryCache.del(key)
    }
  }

  async exists(key: string): Promise<boolean> {
    if (REDIS_DISABLED) {
      return inMemoryCache.exists(key)
    }

    try {
      const redis = this.getRedis()
      if (!redis) return inMemoryCache.exists(key)
      const result = await redis.exists(key)
      return result === 1
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error)
      return inMemoryCache.exists(key)
    }
  }

  // Cache key generators
  static generateSearchKey(query: string, city?: string, category?: string): string {
    const normalizedQuery = query.toLowerCase().trim()
    const normalizedCity = city?.toLowerCase().trim() || 'all'
    const normalizedCategory = category?.toLowerCase().trim() || 'all'
    return `search:${normalizedQuery}:${normalizedCity}:${normalizedCategory}`
  }

  // Removed unnecessary key generators - only caching search results

  static generateRateLimitKey(identifier: string, window: string): string {
    return `rate_limit:${identifier}:${window}`
  }

  // Specialized cache operations
  async cacheSearchResults(query: string, city: string, category: string, results: any[]): Promise<boolean> {
    const key = CacheService.generateSearchKey(query, city, category)
    return this.set(key, results, 24 * 60 * 60) // 24 hours TTL
  }

  async getCachedSearchResults(query: string, city: string, category: string): Promise<any[] | null> {
    const key = CacheService.generateSearchKey(query, city, category)
    return this.get(key)
  }

  // Removed unnecessary caching methods - only caching search results

  // Rate limiting
  // Uses in-memory rate limiting when Redis is disabled
  async checkRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = CacheService.generateRateLimitKey(identifier, windowSeconds.toString())
    
    // Use in-memory rate limiting if Redis is disabled
    if (REDIS_DISABLED) {
      const { count, resetTime } = inMemoryCache.checkRateLimit(key, limit, windowSeconds)
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetTime
      }
    }
    
    try {
      const redis = this.getRedis()
      if (!redis) {
        // Fallback to in-memory rate limiting
        const { count, resetTime } = inMemoryCache.checkRateLimit(key, limit, windowSeconds)
        return {
          allowed: count <= limit,
          remaining: Math.max(0, limit - count),
          resetTime
        }
      }
      
      // Redis operations already have timeouts in redis.ts wrapper
      const current = await redis.incr(key) as number
      
      if (current === 1) {
        await redis.expire(key, windowSeconds).catch(() => {}) // Ignore expire errors
      }
      
      const ttl = await redis.ttl(key) as number
      
      const resetTime = Date.now() + (ttl * 1000)
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime
      }
    } catch (error) {
      // Graceful fallback - use in-memory rate limiting
      // Don't log every failure (too noisy)
      if (!(error instanceof Error && (error.message.includes('timeout') || error.message.includes('ENOTFOUND')))) {
        console.error(`Rate limit check error for ${identifier}:`, error)
      }
      const { count, resetTime } = inMemoryCache.checkRateLimit(key, limit, windowSeconds)
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetTime
      }
    }
  }

  // Reset rate limit for a specific identifier (development only)
  async resetRateLimit(identifier: string, windowSeconds: number): Promise<void> {
    const key = CacheService.generateRateLimitKey(identifier, windowSeconds.toString())
    
    if (REDIS_DISABLED) {
      inMemoryCache.rateLimitCounters.delete(key)
      console.log(`Rate limit reset for ${identifier}`)
      return
    }
    
    try {
      const redis = this.getRedis()
      if (redis) {
        await redis.del(key)
      } else {
        inMemoryCache.rateLimitCounters.delete(key)
      }
      console.log(`Rate limit reset for ${identifier}`)
    } catch (error) {
      console.error(`Rate limit reset error for ${identifier}:`, error)
      // Fallback to in-memory
      inMemoryCache.rateLimitCounters.delete(key)
    }
  }

  // Cache invalidation - only for search results
  async invalidateSearchResults(query?: string, city?: string, category?: string): Promise<void> {
    try {
      if (query && city && category) {
        // Invalidate specific search
        const key = CacheService.generateSearchKey(query, city, category)
        await this.del(key)
      } else {
        // Invalidate all search results
        const pattern = query ? `search:${query.toLowerCase()}*` : 'search:*'
        let keys: string[] = []
        
        if (REDIS_DISABLED) {
          keys = inMemoryCache.keys(pattern)
        } else {
          const redis = this.getRedis()
          if (redis) {
            keys = await redis.keys(pattern) as string[]
          } else {
            keys = inMemoryCache.keys(pattern)
          }
        }
        
        if (keys.length > 0) {
          // Delete keys one by one
          for (const key of keys) {
            await this.del(key)
          }
        }
      }
    } catch (error) {
      console.error('Search cache invalidation error:', error)
    }
  }

  // Cache statistics
  async getCacheStats(): Promise<{ hits: number; misses: number; keys: number }> {
    try {
      let keys: string[] = []
      
      if (REDIS_DISABLED) {
        keys = inMemoryCache.keys('*')
      } else {
        const redis = this.getRedis()
        if (redis) {
          keys = await redis.keys('*') as string[]
        } else {
          keys = inMemoryCache.keys('*')
        }
      }
      
      // In a production environment, you'd want to track hits/misses with counters
      return {
        hits: 0, // TODO: Implement hit/miss tracking
        misses: 0, // TODO: Implement hit/miss tracking
        keys: keys.length
      }
    } catch (error) {
      console.error('Cache stats error:', error)
      return { hits: 0, misses: 0, keys: 0 }
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    if (REDIS_DISABLED) {
      return true // In-memory cache is always available
    }
    
    try {
      const redis = this.getRedis()
      if (!redis) return true // Fallback to in-memory
      await redis.ping()
      return true
    } catch (error) {
      console.error('Cache health check failed:', error)
      return true // In-memory cache is still available
    }
  }
}

// Export singleton instance (lazy initialization)
export const cacheService = new CacheService()

// Graceful shutdown is handled in redis.ts