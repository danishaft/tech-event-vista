import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const register = async () => {
  // This if statement is important, read here: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
  // Don't run in worker process - worker has its own Prisma instance
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.CREATE_WORKER !== 'true') {
    console.log('🚀 Registering Event Scraping System with Next.js...')
    
    // Vercel Cron Jobs will handle daily scraping at 6 AM
    // No need for in-memory scheduler - Vercel handles it externally
    console.log('✅ Daily scraping configured via Vercel Cron Jobs!')
    console.log('📅 Scheduled for 6 AM daily via /api/scraping/trigger')
    
    // Graceful shutdown - use shared Prisma instance from lib/prisma.ts
    const { prisma } = await import('./lib/prisma')
    
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, disconnecting database...')
      prisma.$disconnect()
    })
    
    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, disconnecting database...')
      prisma.$disconnect()
    })
  }
}
