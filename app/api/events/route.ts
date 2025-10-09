import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const city = searchParams.get('city') || undefined
    const eventType = searchParams.get('eventType') || undefined
    const price = searchParams.get('price') || undefined
    const date = searchParams.get('date') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      status: 'active',
    }

    if (city && city !== 'all') {
      where.city = { equals: city, mode: 'insensitive' }
    }

    if (eventType && eventType !== 'all') {
      where.eventType = eventType
    }

    if (price && price !== 'all') {
      if (price === 'free') {
        where.isFree = true
      } else if (price === 'paid') {
        where.isFree = false
      }
    }

    if (date && date !== 'all') {
      const now = new Date()
      if (date === 'today') {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        where.eventDate = {
          gte: now,
          lt: tomorrow,
        }
      } else if (date === 'thisWeek') {
        const nextWeek = new Date(now)
        nextWeek.setDate(nextWeek.getDate() + 7)
        where.eventDate = {
          gte: now,
          lt: nextWeek,
        }
      } else if (date === 'thisMonth') {
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        where.eventDate = {
          gte: now,
          lt: nextMonth,
        }
      }
    }

    // Fetch events
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: [
          { qualityScore: 'desc' },
          { eventDate: 'asc' },
        ],
        skip,
        take: limit,
        include: {
          eventCategories: true,
        },
      }),
      prisma.event.count({ where }),
    ])

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // TODO: Add validation
    const event = await prisma.event.create({
      data: {
        title: body.title,
        description: body.description,
        eventType: body.eventType,
        eventDate: new Date(body.eventDate),
        eventEndDate: body.eventEndDate ? new Date(body.eventEndDate) : null,
        venueName: body.venueName,
        venueAddress: body.venueAddress,
        city: body.city,
        country: body.country || 'US',
        isOnline: body.isOnline || false,
        isFree: body.isFree || false,
        priceMin: body.priceMin,
        priceMax: body.priceMax,
        currency: body.currency || 'USD',
        organizerName: body.organizerName,
        organizerDescription: body.organizerDescription,
        organizerRating: body.organizerRating,
        capacity: body.capacity,
        registeredCount: body.registeredCount || 0,
        techStack: body.techStack || [],
        qualityScore: body.qualityScore || 0,
        externalUrl: body.externalUrl,
        imageUrl: body.imageUrl,
        sourcePlatform: body.sourcePlatform,
        sourceId: body.sourceId,
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}


