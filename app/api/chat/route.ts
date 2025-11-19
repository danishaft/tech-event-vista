import { NextRequest, NextResponse } from 'next/server'
import { processChatMessage } from '@/lib/aiService'
import { apiRateLimiter, createRateLimitResponse } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/chat
 * Handle chatbot messages
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimit = await apiRateLimiter.check(request)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    const body = await request.json()
    const { message, conversationHistory = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Process the chat message
    const result = await processChatMessage(message, conversationHistory)

    return NextResponse.json({
      response: result.response,
      events: result.events,
      intent: result.intent
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        message: (error as Error).message
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/chat
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Chat API is running',
    requiresOpenAIKey: !process.env.OPENAI_API_KEY
  })
}







