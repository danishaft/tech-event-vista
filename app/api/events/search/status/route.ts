/**
 * Search Job Status Endpoint
 * Returns the status and results of a scraping job
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/events/search/status?jobId=...
 * Returns job status and results if completed
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'jobId is required' },
        { status: 400 }
      )
    }

    // Query database for job
    const job = await prisma.scrapingJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    // If job is still running, return status only
    if (job.status === 'running') {
      return NextResponse.json({
        success: true,
        status: 'running',
        jobId: job.id,
        startedAt: job.startedAt,
      })
    }

    // If job failed, return error
    if (job.status === 'failed') {
      return NextResponse.json({
        success: false,
        status: 'failed',
        jobId: job.id,
        error: job.errorMessage || 'Job failed',
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      })
    }

    // If job is completed, return events
    if (job.status === 'completed') {
      // Query events that were scraped for this job
      // Events are filtered by the job's query, city, and platforms
      const whereClause: {
        scrapedAt: { gte: Date }
        city?: string
        sourcePlatform?: { in: string[] }
      } = {
        scrapedAt: {
          gte: job.startedAt || new Date(Date.now() - 60000), // Events scraped since job started
        },
      }

      // Filter by city if specified
      if (job.city && job.city !== 'all') {
        whereClause.city = job.city
      }

      // Filter by platforms if specified
      if (job.platforms && job.platforms.length > 0) {
        whereClause.sourcePlatform = { in: job.platforms }
      }

      // Get events
      const events = await prisma.event.findMany({
        where: whereClause,
        orderBy: {
          scrapedAt: 'desc',
        },
        take: 100, // Limit to 100 events
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
      })

      // Get event categories
      const eventIds = events.map((e: { id: string }) => e.id)
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

      // Map categories to events
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

      // Add categories to events
      const eventsWithCategories = events.map((event: typeof events[number]) => ({
        ...event,
        eventCategories: categoriesByEventId.get(event.id) || [],
      }))

      return NextResponse.json({
        success: true,
        status: 'completed',
        jobId: job.id,
        events: eventsWithCategories,
        total: eventsWithCategories.length,
        eventsScraped: job.eventsScraped,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      })
    }

    // Unknown status
    return NextResponse.json({
      success: false,
      status: job.status,
      jobId: job.id,
    })
  } catch (error) {
    console.error('❌ [SEARCH-STATUS] Error checking job status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}


