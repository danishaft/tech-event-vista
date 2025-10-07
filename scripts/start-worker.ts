#!/usr/bin/env node

/**
 * Production-ready worker startup script
 * This script starts the BullMQ worker process for event scraping
 * 
 * Usage: npm run worker
 */

import { eventScrapingWorker } from '../lib/worker'

console.log('🚀 Starting Event Scraping Worker...')
console.log('📋 Worker configuration:')
console.log(`   - Queue: eventScraping`)
console.log(`   - Concurrency: 2`)
console.log(`   - Auto-retry: 3 attempts`)
console.log(`   - Backoff: exponential`)

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Received SIGINT, shutting down gracefully...')
  await eventScrapingWorker.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🔄 Received SIGTERM, shutting down gracefully...')
  await eventScrapingWorker.close()
  process.exit(0)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

console.log('✅ Event Scraping Worker started successfully!')
console.log('🔄 Waiting for jobs...')
