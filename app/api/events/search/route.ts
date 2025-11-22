/**
 * Search Job Initiation Endpoint
 * Creates a scraping job and queues it for background processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapingQueue } from '@/lib/queue'
import { searchDatabase, type SearchFilters } from '@/lib/searchService'
import crypto from 'crypto'

const DEFAULT_DB_SEARCH_LIMIT = 50
const DEFAULT_PLATFORMS = ['luma', 'eventbrite'] as const
const DEFAULT_CITY = 'San Francisco'

/**
 * POST /api/events/search
 * Creates a scraping job for search query
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { query, city, eventType, price, date, platforms } = body

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    const searchQuery = query.trim()

    // Build filters
    const filters: SearchFilters = {
      city: city && city !== 'all' ? city : undefined,
      eventType: eventType && eventType !== 'all' ? eventType : undefined,
      price: price && price !== 'all' ? price : undefined,
      date: date && date !== 'all' ? date : undefined,
      platforms: platforms && Array.isArray(platforms) ? platforms : undefined,
    }

    // Check database first
    try {
      const dbResults = await searchDatabase(searchQuery, filters, DEFAULT_DB_SEARCH_LIMIT)

      // If we have results in database, return them immediately
      if (dbResults.events.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'database',
          events: dbResults.events,
          total: dbResults.total,
        })
      }
    } catch (dbError) {
      console.error('[SEARCH] Database search failed:', dbError)
    }

    // No database results - create scraping job
    const jobId = `search-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    const searchCity = city && city !== 'all' ? city : DEFAULT_CITY
    const searchPlatforms = platforms && Array.isArray(platforms) && platforms.length > 0
      ? platforms
      : [...DEFAULT_PLATFORMS]

    // Create job record in database
    try {
      await prisma.scrapingJob.create({
        data: {
          id: jobId,
          platform: 'multi',
          status: 'running',
          query: searchQuery,
          city: searchCity,
          platforms: searchPlatforms,
          startedAt: new Date(),
          eventsScraped: 0,
        },
      })
    } catch (dbError: any) {
      console.error('[SEARCH] Failed to create job record:', dbError)
    }

    // Add job to BullMQ queue
    try {
      await scrapingQueue.add('scrape-events', {
        jobId,
        query: searchQuery,
        platforms: searchPlatforms,
        city: searchCity,
      })

    } catch (queueError) {
      console.error('[SEARCH] Failed to queue job:', queueError)

      // Update job status to failed if we created it
      try {
        await prisma.scrapingJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: 'Failed to queue job',
          },
        })
      } catch {
      }

      return NextResponse.json(
        { success: false, error: 'Failed to create scraping job' },
        { status: 500 }
      )
    }

    // Return job ID immediately
    return NextResponse.json({
      success: true,
      jobId,
      status: 'running',
      message: 'Scraping job created and queued',
    })
  } catch (error) {
    console.error('[SEARCH] Error creating search job:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

