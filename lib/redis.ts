import Redis from 'ioredis'
import { Redis as UpstashRedis } from '@upstash/redis'

// Single Upstash Redis instance for both BullMQ and caching
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL || 'redis://localhost:6379'
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN || ''

// Parse Upstash Redis URL format: rediss://default:<token>@<endpoint>:<port>
// Or use host/port/password format
function parseRedisUrl(url: string) {
  try {
    // Handle both redis:// and rediss:// (TLS) protocols
    const urlObj = new URL(url)
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port || '6379'),
      password: urlObj.password || UPSTASH_REDIS_TOKEN,
      username: urlObj.username || 'default',
    }
  } catch {
    // Fallback: try to parse manually
    // Format: rediss://default:token@host:port or host:port
    const cleaned = url.replace(/^rediss?:\/\//, '') // Remove protocol
    const [authPart, hostPart] = cleaned.split('@')
    
    if (hostPart) {
      // Has auth: rediss://default:token@host:port
      const [username, password] = authPart.split(':')
      const [host, port] = hostPart.split(':')
      return {
        host: host || 'localhost',
        port: parseInt(port || '6379'),
        password: password || UPSTASH_REDIS_TOKEN,
        username: username || 'default',
      }
    } else {
      // No auth: host:port
      const [host, port] = cleaned.split(':')
      return {
        host: host || 'localhost',
        port: parseInt(port || '6379'),
        password: UPSTASH_REDIS_TOKEN,
        username: 'default',
      }
    }
  }
}

// BullMQ connection using Upstash Redis TCP endpoint
// Upstash Redis requires TLS and specific connection settings
const redisConfig = parseRedisUrl(UPSTASH_REDIS_URL)

export const connection = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  username: redisConfig.username,
  maxRetriesPerRequest: null, // Required for workers (official BullMQ requirement)
  enableReadyCheck: false,
  connectTimeout: 10000, // 10 second connection timeout
  lazyConnect: false, // Connect immediately
  retryStrategy: (times) => {
    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms, 1600ms, 3200ms, max 5000ms
    const delay = Math.min(times * 50, 5000)
    console.log(`🔄 Redis reconnecting (attempt ${times}) in ${delay}ms...`)
    return delay
  },
  tls: {
    // Required for Upstash Redis
    rejectUnauthorized: true,
  },
})

// Upstash Redis for caching (HTTP-based, serverless-friendly)
// Graceful fallback: Return null if Redis is unavailable
let _cacheConnection: UpstashRedis | null = null
let _redisAvailable: boolean = true

// Helper to wrap Redis calls with timeout and error handling
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 1000, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Redis timeout')), timeoutMs)
      )
    ])
  } catch (error) {
    return fallback
  }
}

export const cacheConnection = {
  get: async (key: string) => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null // Redis not configured
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.get(key), 1000, null)
  },
  set: async (key: string, value: string, options?: any) => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return 'OK' // Redis not configured, pretend success
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.set(key, value, options), 1000, 'OK')
  },
  del: async (key: string) => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return 0
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.del(key), 1000, 0)
  },
  exists: async (key: string) => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return 0
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.exists(key), 1000, 0)
  },
  incr: async (key: string) => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return 1 // Fallback: allow request
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.incr(key), 500, 1)
  },
  expire: async (key: string, seconds: number) => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return 0
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.expire(key, seconds), 500, 0)
  },
  ttl: async (key: string) => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return -1
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.ttl(key), 500, -1)
  },
  keys: async (pattern: string) => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return []
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.keys(pattern), 1000, [])
  },
  ping: async () => {
    if (!_cacheConnection) {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return 'PONG'
      }
      _cacheConnection = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
    return withTimeout(_cacheConnection.ping(), 1000, 'PONG')
  }
}

// Production error handling for BullMQ connection
connection.on('error', (err) => {
  // Log connection errors with helpful context
  if (err instanceof Error) {
    if (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNREFUSED')) {
      console.error('❌ Redis connection timeout/refused. Check:')
      console.error('   1. UPSTASH_REDIS_URL is correct (TCP endpoint)')
      console.error('   2. UPSTASH_REDIS_TOKEN is correct')
      console.error('   3. Network/firewall allows connection')
      console.error(`   4. Endpoint: ${redisConfig.host}:${redisConfig.port}`)
    } else {
      console.error('❌ Redis error:', err.message)
    }
  }
})

connection.on('connect', () => {
  console.log(`✅ Redis connected to ${redisConfig.host}:${redisConfig.port}`)
})

connection.on('ready', () => {
  console.log('✅ Redis ready for operations')
})

connection.on('close', () => {
  console.log('⚠️ Redis connection closed')
})

connection.on('reconnecting', (delay) => {
  console.log(`🔄 Redis reconnecting in ${delay}ms...`)
})

// Upstash Redis doesn't use event emitters like ioredis
// Connection is established on first API call

// Graceful shutdown handling
// Only set handlers if NOT in worker process (worker has its own handlers)
const isWorker = process.env.CREATE_WORKER === 'true'
if (!isWorker) {
  process.on('SIGINT', async () => {
    console.log('🔄 [REDIS] Gracefully closing Redis connections (SIGINT)...')
    await connection.quit()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('🔄 [REDIS] Gracefully closing Redis connections (SIGTERM)...')
    await connection.quit()
    process.exit(0)
  })
} else {
  // Debug: confirm we're NOT setting handlers in worker
  console.log('✅ [REDIS] Skipping signal handlers (worker mode)')
}
