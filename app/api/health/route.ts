import { NextResponse } from 'next/server'

/**
 * Health check endpoint for Docker healthchecks
 * Returns 200 if service is healthy
 */
export async function GET() {
  try {
    // Basic health check - service is running
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'tech-event-vista-api',
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

