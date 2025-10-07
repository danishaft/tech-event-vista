import Redis from 'ioredis'

// Production-ready Redis connection following official BullMQ patterns
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Create connection instance for reuse across queues and workers
export const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required for workers (official BullMQ requirement)
  enableReadyCheck: false,
})

// Production error handling
connection.on('error', (err) => {
  console.error('Redis connection error:', err)
  // In production, you might want to send this to a monitoring service
})

connection.on('connect', () => {
  console.log('✅ Redis connected successfully')
})

connection.on('ready', () => {
  console.log('✅ Redis ready for operations')
})

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully closing Redis connection...')
  await connection.quit()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully closing Redis connection...')
  await connection.quit()
  process.exit(0)
})
