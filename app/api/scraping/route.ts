import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eventScrapingQueue } from '@/lib/queue'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { platform, city } = body

    if (!platform || !city) {
      return NextResponse.json(
        { error: 'Platform and city are required' },
        { status: 400 }
      )
    }

    // Create scraping job record
    const job = await prisma.scrapingJob.create({
      data: {
        platform,
        status: 'pending',
      },
    })

    // Add job to queue
    await eventScrapingQueue.add(
      'scrapeEvents',
      { platform, city, jobId: job.id },
      {
        jobId: job.id,
        delay: 1000, 
      }
    )

    return NextResponse.json({
      message: 'Scraping job started',
      jobId: job.id,
    })
  } catch (error) {
    console.error('Error starting scraping job:', error)
    return NextResponse.json(
      { error: 'Failed to start scraping job' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where: any = {}
    if (platform) where.platform = platform
    if (status) where.status = status

    const jobs = await prisma.scrapingJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error fetching scraping jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scraping jobs' },
      { status: 500 }
    )
  }
}


