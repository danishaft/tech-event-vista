import { NextRequest, NextResponse } from 'next/server'
import { cacheService } from '@/lib/cache'

/**
 * POST /api/dev/reset-rate-limit
 * Development-only endpoint to reset rate limits
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { identifier, windowSeconds = 900 } = body

    if (!identifier) {
      return NextResponse.json(
        { error: 'Identifier is required' },
        { status: 400 }
      )
    }

    await cacheService.resetRateLimit(identifier, windowSeconds)

    return NextResponse.json({
      success: true,
      message: `Rate limit reset for ${identifier}`,
      identifier,
      windowSeconds
    })

  } catch (error) {
    console.error('Rate limit reset error:', error)
    return NextResponse.json(
      { error: 'Failed to reset rate limit' },
      { status: 500 }
    )
  }
}






























