import { useState, useEffect, useCallback, useRef } from 'react'
import { Event } from './useEvents'

export interface SearchFilters {
  city?: string
  eventType?: string
  price?: string
  date?: string
  platforms?: string[]
}

export interface SearchResult {
  events: Event[]
  isLoading: boolean
  error: string | null
  totalEvents: number
  source: 'database' | 'live_scraping' | 'cache'
  platformStatus: PlatformStatus[]
  isComplete: boolean
}

export interface PlatformStatus {
  platform: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  eventsFound: number
  error?: string
}

export interface SSEEvent {
  type: 'event' | 'platform_status' | 'search_complete' | 'error' | 'heartbeat'
  data: any
  timestamp: string
}

/**
 * Custom hook for advanced search with SSE streaming
 * Implements database-first search with live scraping fallback
 */
export const useSearch = (
  query: string,
  filters: SearchFilters = {},
  options: {
    platforms?: string[]
    maxResults?: number
    enabled?: boolean
  } = {}
) => {
  const {
    platforms = ['luma', 'eventbrite'],
    maxResults = 50,
    enabled = true,
  } = options

  // State management
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalEvents, setTotalEvents] = useState(0)
  const [source, setSource] = useState<'database' | 'live_scraping' | 'cache'>('database')
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([])
  const [isComplete, setIsComplete] = useState(false)

  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isSearchingRef = useRef<boolean>(false)

  /**
   * Handle individual SSE events
   */
  const handleSSEEvent = useCallback(async (event: SSEEvent) => {
    console.log(`📨 [CLIENT] SSE event received:`, {
      type: event.type,
      timestamp: event.timestamp,
      data: event.data
    })
    
    switch (event.type) {
      case 'event':
        const { event: eventData, source: eventSource, platform } = event.data
        
        console.log(`📤 [CLIENT] Processing event: ${eventData.title}`, {
          eventId: eventData.id,
          platform,
          source: eventSource,
          timestamp: new Date().toISOString()
        })
        
        // Add event to results
        setEvents(prev => {
          // Check for duplicates
          const exists = prev.some(e => e.id === eventData.id)
          if (exists) {
            console.log(`⚠️ [CLIENT] Duplicate event skipped: ${eventData.title}`)
            return prev
          }
          
          // Limit array size to prevent memory leaks
          const newEvents = [...prev, eventData]
          const limitedEvents = newEvents.slice(-100) // Keep only last 100 events
          
          console.log(`✅ [CLIENT] Event added to results: ${eventData.title}`, {
            totalEvents: limitedEvents.length,
            eventId: eventData.id
          })
          
          return limitedEvents
        })

        // Update source
        setSource(eventSource)
        break

      case 'platform_status':
        console.log(`📊 [CLIENT] Platform status update:`, {
          platforms: event.data.platforms,
          timestamp: new Date().toISOString()
        })
        setPlatformStatus(event.data.platforms || [])
        break

      case 'search_complete':
        console.log(`🎉 [CLIENT] Search completed:`, {
          totalEvents: event.data.totalEvents,
          source: event.data.source,
          timestamp: new Date().toISOString()
        })
        setTotalEvents(event.data.totalEvents || 0)
        setSource(event.data.source || 'database')
        setIsComplete(true)
        setIsLoading(false)
        isSearchingRef.current = false
        break

      case 'error':
        console.error(`❌ [CLIENT] Search error:`, {
          message: event.data?.message || event.data?.error,
          error: event.data,
          timestamp: new Date().toISOString()
        })
        const errorMessage = event.data?.message || event.data?.error || 'Search error'
        setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage))
        setIsLoading(false)
        setIsComplete(false)
        isSearchingRef.current = false
        break

      case 'heartbeat':
        console.log(`💓 [CLIENT] Heartbeat received:`, {
          timestamp: new Date().toISOString()
        })
        // Keep connection alive
        break

      default:
        console.warn(`⚠️ [CLIENT] Unknown SSE event type:`, {
          type: event.type,
          data: event.data,
          timestamp: new Date().toISOString()
        })
    }
  }, [])

  /**
   * Process SSE stream from search API
   */
  const processSSEStream = useCallback(async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep incomplete event in buffer

        for (const eventString of events) {
          if (!eventString.trim()) continue // Skip empty lines
          
          if (eventString.startsWith('data: ')) {
            try {
              const jsonString = eventString.slice(6).trim()
              if (!jsonString) continue // Skip empty data
              
              const eventData = JSON.parse(jsonString) as SSEEvent
              await handleSSEEvent(eventData)
            } catch (parseError) {
              console.error('❌ [CLIENT] Failed to parse SSE event:', {
                error: parseError instanceof Error ? parseError.message : 'Unknown error',
                eventString: eventString.substring(0, 200), // Log first 200 chars
                timestamp: new Date().toISOString()
              })
              // Don't break the stream on parse errors - continue processing
            }
          } else if (eventString.trim() && !eventString.startsWith(':')) {
            // Log unexpected SSE format (not data: or comment)
            console.warn('⚠️ [CLIENT] Unexpected SSE format:', {
              eventString: eventString.substring(0, 100),
              timestamp: new Date().toISOString()
            })
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }, [])

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    // Close SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Abort fetch request
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch (error) {
        // Ignore abort errors - they're expected when cleaning up
        console.log('🔧 [CLIENT] Cleanup aborted request (expected)')
      }
      abortControllerRef.current = null
    }
  }, [])

  /**
   * Start search with SSE streaming
   */
  const startSearch = useCallback(async () => {
    console.log(`🔍 [CLIENT] startSearch called`, {
      query,
      queryTrimmed: query.trim(),
      enabled,
      shouldSearch: query.trim() && enabled,
      timestamp: new Date().toISOString()
    })
    
    if (!query.trim() || !enabled) {
      console.log(`🚫 [CLIENT] Search skipped`, {
        reason: !query.trim() ? 'empty query' : 'disabled',
        query,
        enabled,
        timestamp: new Date().toISOString()
      })
      return
    }

    // Prevent multiple simultaneous searches
    if (isSearchingRef.current) {
      console.log('🔧 [CLIENT] Search already in progress, skipping')
      return
    }

    const searchId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log(`🔍 [CLIENT] Starting search: ${searchId}`, {
      searchId,
      query,
      filters,
      platforms,
      maxResults,
      enabled,
      timestamp: new Date().toISOString()
    })

    isSearchingRef.current = true

    // Cleanup previous search FIRST (before creating new abort controller)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Reset state
    setEvents([])
    setIsLoading(true)
    setError(null)
    setTotalEvents(0)
    setIsComplete(false)
    setPlatformStatus([])

    try {
      // Create NEW abort controller AFTER cleanup
      abortControllerRef.current = new AbortController()

      // Prepare request body - validate it's not empty
      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        throw new Error('Query cannot be empty')
      }

      const requestBody = {
        query: trimmedQuery,
        filters,
        platforms,
        maxResults,
      }

      // Create SSE connection using fetch with streaming
      const requestBodyString = JSON.stringify(requestBody)
      
      // Validate request body is not empty
      if (!requestBodyString || requestBodyString === '{}') {
        throw new Error('Request body is empty')
      }

      console.log(`📡 [CLIENT] Making API request: ${searchId}`, {
        searchId,
        url: '/api/search',
        method: 'POST',
        requestBody,
        bodyLength: requestBodyString.length,
        bodyPreview: requestBodyString.substring(0, 100),
        timestamp: new Date().toISOString()
      })
      
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: requestBodyString,
        signal: abortControllerRef.current.signal,
      })

      // Check if response is SSE stream
      const contentType = response.headers.get('content-type')
      const isSSE = contentType?.includes('text/event-stream')
      
      if (!response.ok) {
        console.error(`❌ [CLIENT] API request failed: ${searchId}`, {
          searchId,
          status: response.status,
          statusText: response.statusText,
          contentType,
          timestamp: new Date().toISOString()
        })
        
        // If it's SSE, try to parse the error from the stream
        if (isSSE) {
          try {
            const text = await response.text()
            const lines = text.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'error') {
                  throw new Error(data.data?.message || data.data?.error || `Search failed: ${response.status}`)
                }
              }
            }
          } catch (parseError) {
            // Fall through to generic error
          }
        }
        
        // Generic error for non-SSE or if parsing failed
        throw new Error(`Search failed: ${response.status} ${response.statusText}`)
      }

      if (!isSSE) {
        console.error(`❌ [CLIENT] Invalid content type: ${searchId}`, {
          searchId,
          contentType,
          timestamp: new Date().toISOString()
        })
        throw new Error('Expected SSE stream response')
      }

      console.log(`✅ [CLIENT] SSE connection established: ${searchId}`, {
        searchId,
        contentType,
        timestamp: new Date().toISOString()
      })

      // Process SSE stream
      await processSSEStream(response)

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`🚫 [CLIENT] Search cancelled: ${searchId}`, {
          searchId,
          timestamp: new Date().toISOString()
        })
        // Search was cancelled, don't set error
        return
      }
      
      console.error(`❌ [CLIENT] Search error: ${searchId}`, {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      setError(error instanceof Error ? error.message : 'Search failed')
      setIsLoading(false)
    } finally {
      // Always reset the searching flag
      isSearchingRef.current = false
    }
  }, [query, filters, platforms, maxResults, enabled])

  /**
   * Retry search
   */
  const retry = useCallback(() => {
    startSearch()
  }, [startSearch])

  /**
   * Clear search results
   */
  const clear = useCallback(() => {
    cleanup()
    setEvents([])
    setIsLoading(false)
    setError(null)
    setTotalEvents(0)
    setIsComplete(false)
    setPlatformStatus([])
  }, [])

  // Start search when dependencies change
  useEffect(() => {
    console.log(`🔄 [CLIENT] useEffect triggered`, {
      query,
      filters,
      platforms,
      maxResults,
      enabled,
      timestamp: new Date().toISOString()
    })
    startSearch()
    
    // Cleanup on unmount
    return cleanup
  }, [startSearch, cleanup])

  // Return search result interface
  const result: SearchResult = {
    events,
    isLoading,
    error,
    totalEvents,
    source,
    platformStatus,
    isComplete,
  }

  return {
    ...result,
    retry,
    clear,
    startSearch,
  }
}

export default useSearch


export interface SearchFilters {
  city?: string
  eventType?: string
  price?: string
  date?: string
  platforms?: string[]
}

export interface SearchResult {
  events: Event[]
  isLoading: boolean
  error: string | null
  totalEvents: number
  source: 'database' | 'live_scraping' | 'cache'
  platformStatus: PlatformStatus[]
  isComplete: boolean
}

export interface PlatformStatus {
  platform: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  eventsFound: number
  error?: string
}

export interface SSEEvent {
  type: 'event' | 'platform_status' | 'search_complete' | 'error' | 'heartbeat'
  data: any
  timestamp: string
}

/**
 * Custom hook for advanced search with SSE streaming
 * Implements database-first search with live scraping fallback
 */
export const useSearch = (
  query: string,
  filters: SearchFilters = {},
  options: {
    platforms?: string[]
    maxResults?: number
    enabled?: boolean
  } = {}
) => {
  const {
    platforms = ['luma', 'eventbrite'],
    maxResults = 50,
    enabled = true,
  } = options

  // State management
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalEvents, setTotalEvents] = useState(0)
  const [source, setSource] = useState<'database' | 'live_scraping' | 'cache'>('database')
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([])
  const [isComplete, setIsComplete] = useState(false)

  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isSearchingRef = useRef<boolean>(false)

  /**
   * Handle individual SSE events
   */
  const handleSSEEvent = useCallback(async (event: SSEEvent) => {
    console.log(`📨 [CLIENT] SSE event received:`, {
      type: event.type,
      timestamp: event.timestamp,
      data: event.data
    })
    
    switch (event.type) {
      case 'event':
        const { event: eventData, source: eventSource, platform } = event.data
        
        console.log(`📤 [CLIENT] Processing event: ${eventData.title}`, {
          eventId: eventData.id,
          platform,
          source: eventSource,
          timestamp: new Date().toISOString()
        })
        
        // Add event to results
        setEvents(prev => {
          // Check for duplicates
          const exists = prev.some(e => e.id === eventData.id)
          if (exists) {
            console.log(`⚠️ [CLIENT] Duplicate event skipped: ${eventData.title}`)
            return prev
          }
          
          // Limit array size to prevent memory leaks
          const newEvents = [...prev, eventData]
          const limitedEvents = newEvents.slice(-100) // Keep only last 100 events
          
          console.log(`✅ [CLIENT] Event added to results: ${eventData.title}`, {
            totalEvents: limitedEvents.length,
            eventId: eventData.id
          })
          
          return limitedEvents
        })

        // Update source
        setSource(eventSource)
        break

      case 'platform_status':
        console.log(`📊 [CLIENT] Platform status update:`, {
          platforms: event.data.platforms,
          timestamp: new Date().toISOString()
        })
        setPlatformStatus(event.data.platforms || [])
        break

      case 'search_complete':
        console.log(`🎉 [CLIENT] Search completed:`, {
          totalEvents: event.data.totalEvents,
          source: event.data.source,
          timestamp: new Date().toISOString()
        })
        setTotalEvents(event.data.totalEvents || 0)
        setSource(event.data.source || 'database')
        setIsComplete(true)
        setIsLoading(false)
        isSearchingRef.current = false
        break

      case 'error':
        console.error(`❌ [CLIENT] Search error:`, {
          message: event.data?.message || event.data?.error,
          error: event.data,
          timestamp: new Date().toISOString()
        })
        const errorMessage = event.data?.message || event.data?.error || 'Search error'
        setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage))
        setIsLoading(false)
        setIsComplete(false)
        isSearchingRef.current = false
        break

      case 'heartbeat':
        console.log(`💓 [CLIENT] Heartbeat received:`, {
          timestamp: new Date().toISOString()
        })
        // Keep connection alive
        break

      default:
        console.warn(`⚠️ [CLIENT] Unknown SSE event type:`, {
          type: event.type,
          data: event.data,
          timestamp: new Date().toISOString()
        })
    }
  }, [])

  /**
   * Process SSE stream from search API
   */
  const processSSEStream = useCallback(async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep incomplete event in buffer

        for (const eventString of events) {
          if (!eventString.trim()) continue // Skip empty lines
          
          if (eventString.startsWith('data: ')) {
            try {
              const jsonString = eventString.slice(6).trim()
              if (!jsonString) continue // Skip empty data
              
              const eventData = JSON.parse(jsonString) as SSEEvent
              await handleSSEEvent(eventData)
            } catch (parseError) {
              console.error('❌ [CLIENT] Failed to parse SSE event:', {
                error: parseError instanceof Error ? parseError.message : 'Unknown error',
                eventString: eventString.substring(0, 200), // Log first 200 chars
                timestamp: new Date().toISOString()
              })
              // Don't break the stream on parse errors - continue processing
            }
          } else if (eventString.trim() && !eventString.startsWith(':')) {
            // Log unexpected SSE format (not data: or comment)
            console.warn('⚠️ [CLIENT] Unexpected SSE format:', {
              eventString: eventString.substring(0, 100),
              timestamp: new Date().toISOString()
            })
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }, [])

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    // Close SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Abort fetch request
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch (error) {
        // Ignore abort errors - they're expected when cleaning up
        console.log('🔧 [CLIENT] Cleanup aborted request (expected)')
      }
      abortControllerRef.current = null
    }
  }, [])

  /**
   * Start search with SSE streaming
   */
  const startSearch = useCallback(async () => {
    console.log(`🔍 [CLIENT] startSearch called`, {
      query,
      queryTrimmed: query.trim(),
      enabled,
      shouldSearch: query.trim() && enabled,
      timestamp: new Date().toISOString()
    })
    
    if (!query.trim() || !enabled) {
      console.log(`🚫 [CLIENT] Search skipped`, {
        reason: !query.trim() ? 'empty query' : 'disabled',
        query,
        enabled,
        timestamp: new Date().toISOString()
      })
      return
    }

    // Prevent multiple simultaneous searches
    if (isSearchingRef.current) {
      console.log('🔧 [CLIENT] Search already in progress, skipping')
      return
    }

    const searchId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log(`🔍 [CLIENT] Starting search: ${searchId}`, {
      searchId,
      query,
      filters,
      platforms,
      maxResults,
      enabled,
      timestamp: new Date().toISOString()
    })

    isSearchingRef.current = true

    // Cleanup previous search FIRST (before creating new abort controller)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Reset state
    setEvents([])
    setIsLoading(true)
    setError(null)
    setTotalEvents(0)
    setIsComplete(false)
    setPlatformStatus([])

    try {
      // Create NEW abort controller AFTER cleanup
      abortControllerRef.current = new AbortController()

      // Prepare request body - validate it's not empty
      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        throw new Error('Query cannot be empty')
      }

      const requestBody = {
        query: trimmedQuery,
        filters,
        platforms,
        maxResults,
      }

      // Create SSE connection using fetch with streaming
      const requestBodyString = JSON.stringify(requestBody)
      
      // Validate request body is not empty
      if (!requestBodyString || requestBodyString === '{}') {
        throw new Error('Request body is empty')
      }

      console.log(`📡 [CLIENT] Making API request: ${searchId}`, {
        searchId,
        url: '/api/search',
        method: 'POST',
        requestBody,
        bodyLength: requestBodyString.length,
        bodyPreview: requestBodyString.substring(0, 100),
        timestamp: new Date().toISOString()
      })
      
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: requestBodyString,
        signal: abortControllerRef.current.signal,
      })

      // Check if response is SSE stream
      const contentType = response.headers.get('content-type')
      const isSSE = contentType?.includes('text/event-stream')
      
      if (!response.ok) {
        console.error(`❌ [CLIENT] API request failed: ${searchId}`, {
          searchId,
          status: response.status,
          statusText: response.statusText,
          contentType,
          timestamp: new Date().toISOString()
        })
        
        // If it's SSE, try to parse the error from the stream
        if (isSSE) {
          try {
            const text = await response.text()
            const lines = text.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'error') {
                  throw new Error(data.data?.message || data.data?.error || `Search failed: ${response.status}`)
                }
              }
            }
          } catch (parseError) {
            // Fall through to generic error
          }
        }
        
        // Generic error for non-SSE or if parsing failed
        throw new Error(`Search failed: ${response.status} ${response.statusText}`)
      }

      if (!isSSE) {
        console.error(`❌ [CLIENT] Invalid content type: ${searchId}`, {
          searchId,
          contentType,
          timestamp: new Date().toISOString()
        })
        throw new Error('Expected SSE stream response')
      }

      console.log(`✅ [CLIENT] SSE connection established: ${searchId}`, {
        searchId,
        contentType,
        timestamp: new Date().toISOString()
      })

      // Process SSE stream
      await processSSEStream(response)

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`🚫 [CLIENT] Search cancelled: ${searchId}`, {
          searchId,
          timestamp: new Date().toISOString()
        })
        // Search was cancelled, don't set error
        return
      }
      
      console.error(`❌ [CLIENT] Search error: ${searchId}`, {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      setError(error instanceof Error ? error.message : 'Search failed')
      setIsLoading(false)
    } finally {
      // Always reset the searching flag
      isSearchingRef.current = false
    }
  }, [query, filters, platforms, maxResults, enabled])

  /**
   * Retry search
   */
  const retry = useCallback(() => {
    startSearch()
  }, [startSearch])

  /**
   * Clear search results
   */
  const clear = useCallback(() => {
    cleanup()
    setEvents([])
    setIsLoading(false)
    setError(null)
    setTotalEvents(0)
    setIsComplete(false)
    setPlatformStatus([])
  }, [])

  // Start search when dependencies change
  useEffect(() => {
    console.log(`🔄 [CLIENT] useEffect triggered`, {
      query,
      filters,
      platforms,
      maxResults,
      enabled,
      timestamp: new Date().toISOString()
    })
    startSearch()
    
    // Cleanup on unmount
    return cleanup
  }, [startSearch, cleanup])

  // Return search result interface
  const result: SearchResult = {
    events,
    isLoading,
    error,
    totalEvents,
    source,
    platformStatus,
    isComplete,
  }

  return {
    ...result,
    retry,
    clear,
    startSearch,
  }
}

export default useSearch




export interface SearchFilters {
  city?: string
  eventType?: string
  price?: string
  date?: string
  platforms?: string[]
}

export interface SearchResult {
  events: Event[]
  isLoading: boolean
  error: string | null
  totalEvents: number
  source: 'database' | 'live_scraping' | 'cache'
  platformStatus: PlatformStatus[]
  isComplete: boolean
}

export interface PlatformStatus {
  platform: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  eventsFound: number
  error?: string
}

export interface SSEEvent {
  type: 'event' | 'platform_status' | 'search_complete' | 'error' | 'heartbeat'
  data: any
  timestamp: string
}

/**
 * Custom hook for advanced search with SSE streaming
 * Implements database-first search with live scraping fallback
 */
export const useSearch = (
  query: string,
  filters: SearchFilters = {},
  options: {
    platforms?: string[]
    maxResults?: number
    enabled?: boolean
  } = {}
) => {
  const {
    platforms = ['luma', 'eventbrite'],
    maxResults = 50,
    enabled = true,
  } = options

  // State management
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalEvents, setTotalEvents] = useState(0)
  const [source, setSource] = useState<'database' | 'live_scraping' | 'cache'>('database')
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([])
  const [isComplete, setIsComplete] = useState(false)

  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isSearchingRef = useRef<boolean>(false)

  /**
   * Handle individual SSE events
   */
  const handleSSEEvent = useCallback(async (event: SSEEvent) => {
    console.log(`📨 [CLIENT] SSE event received:`, {
      type: event.type,
      timestamp: event.timestamp,
      data: event.data
    })
    
    switch (event.type) {
      case 'event':
        const { event: eventData, source: eventSource, platform } = event.data
        
        console.log(`📤 [CLIENT] Processing event: ${eventData.title}`, {
          eventId: eventData.id,
          platform,
          source: eventSource,
          timestamp: new Date().toISOString()
        })
        
        // Add event to results
        setEvents(prev => {
          // Check for duplicates
          const exists = prev.some(e => e.id === eventData.id)
          if (exists) {
            console.log(`⚠️ [CLIENT] Duplicate event skipped: ${eventData.title}`)
            return prev
          }
          
          // Limit array size to prevent memory leaks
          const newEvents = [...prev, eventData]
          const limitedEvents = newEvents.slice(-100) // Keep only last 100 events
          
          console.log(`✅ [CLIENT] Event added to results: ${eventData.title}`, {
            totalEvents: limitedEvents.length,
            eventId: eventData.id
          })
          
          return limitedEvents
        })

        // Update source
        setSource(eventSource)
        break

      case 'platform_status':
        console.log(`📊 [CLIENT] Platform status update:`, {
          platforms: event.data.platforms,
          timestamp: new Date().toISOString()
        })
        setPlatformStatus(event.data.platforms || [])
        break

      case 'search_complete':
        console.log(`🎉 [CLIENT] Search completed:`, {
          totalEvents: event.data.totalEvents,
          source: event.data.source,
          timestamp: new Date().toISOString()
        })
        setTotalEvents(event.data.totalEvents || 0)
        setSource(event.data.source || 'database')
        setIsComplete(true)
        setIsLoading(false)
        isSearchingRef.current = false
        break

      case 'error':
        console.error(`❌ [CLIENT] Search error:`, {
          message: event.data?.message || event.data?.error,
          error: event.data,
          timestamp: new Date().toISOString()
        })
        const errorMessage = event.data?.message || event.data?.error || 'Search error'
        setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage))
        setIsLoading(false)
        setIsComplete(false)
        isSearchingRef.current = false
        break

      case 'heartbeat':
        console.log(`💓 [CLIENT] Heartbeat received:`, {
          timestamp: new Date().toISOString()
        })
        // Keep connection alive
        break

      default:
        console.warn(`⚠️ [CLIENT] Unknown SSE event type:`, {
          type: event.type,
          data: event.data,
          timestamp: new Date().toISOString()
        })
    }
  }, [])

  /**
   * Process SSE stream from search API
   */
  const processSSEStream = useCallback(async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep incomplete event in buffer

        for (const eventString of events) {
          if (!eventString.trim()) continue // Skip empty lines
          
          if (eventString.startsWith('data: ')) {
            try {
              const jsonString = eventString.slice(6).trim()
              if (!jsonString) continue // Skip empty data
              
              const eventData = JSON.parse(jsonString) as SSEEvent
              await handleSSEEvent(eventData)
            } catch (parseError) {
              console.error('❌ [CLIENT] Failed to parse SSE event:', {
                error: parseError instanceof Error ? parseError.message : 'Unknown error',
                eventString: eventString.substring(0, 200), // Log first 200 chars
                timestamp: new Date().toISOString()
              })
              // Don't break the stream on parse errors - continue processing
            }
          } else if (eventString.trim() && !eventString.startsWith(':')) {
            // Log unexpected SSE format (not data: or comment)
            console.warn('⚠️ [CLIENT] Unexpected SSE format:', {
              eventString: eventString.substring(0, 100),
              timestamp: new Date().toISOString()
            })
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }, [])

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    // Close SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Abort fetch request
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch (error) {
        // Ignore abort errors - they're expected when cleaning up
        console.log('🔧 [CLIENT] Cleanup aborted request (expected)')
      }
      abortControllerRef.current = null
    }
  }, [])

  /**
   * Start search with SSE streaming
   */
  const startSearch = useCallback(async () => {
    console.log(`🔍 [CLIENT] startSearch called`, {
      query,
      queryTrimmed: query.trim(),
      enabled,
      shouldSearch: query.trim() && enabled,
      timestamp: new Date().toISOString()
    })
    
    if (!query.trim() || !enabled) {
      console.log(`🚫 [CLIENT] Search skipped`, {
        reason: !query.trim() ? 'empty query' : 'disabled',
        query,
        enabled,
        timestamp: new Date().toISOString()
      })
      return
    }

    // Prevent multiple simultaneous searches
    if (isSearchingRef.current) {
      console.log('🔧 [CLIENT] Search already in progress, skipping')
      return
    }

    const searchId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log(`🔍 [CLIENT] Starting search: ${searchId}`, {
      searchId,
      query,
      filters,
      platforms,
      maxResults,
      enabled,
      timestamp: new Date().toISOString()
    })

    isSearchingRef.current = true

    // Cleanup previous search FIRST (before creating new abort controller)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Reset state
    setEvents([])
    setIsLoading(true)
    setError(null)
    setTotalEvents(0)
    setIsComplete(false)
    setPlatformStatus([])

    try {
      // Create NEW abort controller AFTER cleanup
      abortControllerRef.current = new AbortController()

      // Prepare request body - validate it's not empty
      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        throw new Error('Query cannot be empty')
      }

      const requestBody = {
        query: trimmedQuery,
        filters,
        platforms,
        maxResults,
      }

      // Create SSE connection using fetch with streaming
      const requestBodyString = JSON.stringify(requestBody)
      
      // Validate request body is not empty
      if (!requestBodyString || requestBodyString === '{}') {
        throw new Error('Request body is empty')
      }

      console.log(`📡 [CLIENT] Making API request: ${searchId}`, {
        searchId,
        url: '/api/search',
        method: 'POST',
        requestBody,
        bodyLength: requestBodyString.length,
        bodyPreview: requestBodyString.substring(0, 100),
        timestamp: new Date().toISOString()
      })
      
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: requestBodyString,
        signal: abortControllerRef.current.signal,
      })

      // Check if response is SSE stream
      const contentType = response.headers.get('content-type')
      const isSSE = contentType?.includes('text/event-stream')
      
      if (!response.ok) {
        console.error(`❌ [CLIENT] API request failed: ${searchId}`, {
          searchId,
          status: response.status,
          statusText: response.statusText,
          contentType,
          timestamp: new Date().toISOString()
        })
        
        // If it's SSE, try to parse the error from the stream
        if (isSSE) {
          try {
            const text = await response.text()
            const lines = text.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'error') {
                  throw new Error(data.data?.message || data.data?.error || `Search failed: ${response.status}`)
                }
              }
            }
          } catch (parseError) {
            // Fall through to generic error
          }
        }
        
        // Generic error for non-SSE or if parsing failed
        throw new Error(`Search failed: ${response.status} ${response.statusText}`)
      }

      if (!isSSE) {
        console.error(`❌ [CLIENT] Invalid content type: ${searchId}`, {
          searchId,
          contentType,
          timestamp: new Date().toISOString()
        })
        throw new Error('Expected SSE stream response')
      }

      console.log(`✅ [CLIENT] SSE connection established: ${searchId}`, {
        searchId,
        contentType,
        timestamp: new Date().toISOString()
      })

      // Process SSE stream
      await processSSEStream(response)

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`🚫 [CLIENT] Search cancelled: ${searchId}`, {
          searchId,
          timestamp: new Date().toISOString()
        })
        // Search was cancelled, don't set error
        return
      }
      
      console.error(`❌ [CLIENT] Search error: ${searchId}`, {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      setError(error instanceof Error ? error.message : 'Search failed')
      setIsLoading(false)
    } finally {
      // Always reset the searching flag
      isSearchingRef.current = false
    }
  }, [query, filters, platforms, maxResults, enabled])

  /**
   * Retry search
   */
  const retry = useCallback(() => {
    startSearch()
  }, [startSearch])

  /**
   * Clear search results
   */
  const clear = useCallback(() => {
    cleanup()
    setEvents([])
    setIsLoading(false)
    setError(null)
    setTotalEvents(0)
    setIsComplete(false)
    setPlatformStatus([])
  }, [])

  // Start search when dependencies change
  useEffect(() => {
    console.log(`🔄 [CLIENT] useEffect triggered`, {
      query,
      filters,
      platforms,
      maxResults,
      enabled,
      timestamp: new Date().toISOString()
    })
    startSearch()
    
    // Cleanup on unmount
    return cleanup
  }, [startSearch, cleanup])

  // Return search result interface
  const result: SearchResult = {
    events,
    isLoading,
    error,
    totalEvents,
    source,
    platformStatus,
    isComplete,
  }

  return {
    ...result,
    retry,
    clear,
    startSearch,
  }
}

export default useSearch


export interface SearchFilters {
  city?: string
  eventType?: string
  price?: string
  date?: string
  platforms?: string[]
}

export interface SearchResult {
  events: Event[]
  isLoading: boolean
  error: string | null
  totalEvents: number
  source: 'database' | 'live_scraping' | 'cache'
  platformStatus: PlatformStatus[]
  isComplete: boolean
}

export interface PlatformStatus {
  platform: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  eventsFound: number
  error?: string
}

export interface SSEEvent {
  type: 'event' | 'platform_status' | 'search_complete' | 'error' | 'heartbeat'
  data: any
  timestamp: string
}

/**
 * Custom hook for advanced search with SSE streaming
 * Implements database-first search with live scraping fallback
 */
export const useSearch = (
  query: string,
  filters: SearchFilters = {},
  options: {
    platforms?: string[]
    maxResults?: number
    enabled?: boolean
  } = {}
) => {
  const {
    platforms = ['luma', 'eventbrite'],
    maxResults = 50,
    enabled = true,
  } = options

  // State management
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalEvents, setTotalEvents] = useState(0)
  const [source, setSource] = useState<'database' | 'live_scraping' | 'cache'>('database')
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([])
  const [isComplete, setIsComplete] = useState(false)

  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isSearchingRef = useRef<boolean>(false)

  /**
   * Handle individual SSE events
   */
  const handleSSEEvent = useCallback(async (event: SSEEvent) => {
    console.log(`📨 [CLIENT] SSE event received:`, {
      type: event.type,
      timestamp: event.timestamp,
      data: event.data
    })
    
    switch (event.type) {
      case 'event':
        const { event: eventData, source: eventSource, platform } = event.data
        
        console.log(`📤 [CLIENT] Processing event: ${eventData.title}`, {
          eventId: eventData.id,
          platform,
          source: eventSource,
          timestamp: new Date().toISOString()
        })
        
        // Add event to results
        setEvents(prev => {
          // Check for duplicates
          const exists = prev.some(e => e.id === eventData.id)
          if (exists) {
            console.log(`⚠️ [CLIENT] Duplicate event skipped: ${eventData.title}`)
            return prev
          }
          
          // Limit array size to prevent memory leaks
          const newEvents = [...prev, eventData]
          const limitedEvents = newEvents.slice(-100) // Keep only last 100 events
          
          console.log(`✅ [CLIENT] Event added to results: ${eventData.title}`, {
            totalEvents: limitedEvents.length,
            eventId: eventData.id
          })
          
          return limitedEvents
        })

        // Update source
        setSource(eventSource)
        break

      case 'platform_status':
        console.log(`📊 [CLIENT] Platform status update:`, {
          platforms: event.data.platforms,
          timestamp: new Date().toISOString()
        })
        setPlatformStatus(event.data.platforms || [])
        break

      case 'search_complete':
        console.log(`🎉 [CLIENT] Search completed:`, {
          totalEvents: event.data.totalEvents,
          source: event.data.source,
          timestamp: new Date().toISOString()
        })
        setTotalEvents(event.data.totalEvents || 0)
        setSource(event.data.source || 'database')
        setIsComplete(true)
        setIsLoading(false)
        isSearchingRef.current = false
        break

      case 'error':
        console.error(`❌ [CLIENT] Search error:`, {
          message: event.data?.message || event.data?.error,
          error: event.data,
          timestamp: new Date().toISOString()
        })
        const errorMessage = event.data?.message || event.data?.error || 'Search error'
        setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage))
        setIsLoading(false)
        setIsComplete(false)
        isSearchingRef.current = false
        break

      case 'heartbeat':
        console.log(`💓 [CLIENT] Heartbeat received:`, {
          timestamp: new Date().toISOString()
        })
        // Keep connection alive
        break

      default:
        console.warn(`⚠️ [CLIENT] Unknown SSE event type:`, {
          type: event.type,
          data: event.data,
          timestamp: new Date().toISOString()
        })
    }
  }, [])

  /**
   * Process SSE stream from search API
   */
  const processSSEStream = useCallback(async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep incomplete event in buffer

        for (const eventString of events) {
          if (!eventString.trim()) continue // Skip empty lines
          
          if (eventString.startsWith('data: ')) {
            try {
              const jsonString = eventString.slice(6).trim()
              if (!jsonString) continue // Skip empty data
              
              const eventData = JSON.parse(jsonString) as SSEEvent
              await handleSSEEvent(eventData)
            } catch (parseError) {
              console.error('❌ [CLIENT] Failed to parse SSE event:', {
                error: parseError instanceof Error ? parseError.message : 'Unknown error',
                eventString: eventString.substring(0, 200), // Log first 200 chars
                timestamp: new Date().toISOString()
              })
              // Don't break the stream on parse errors - continue processing
            }
          } else if (eventString.trim() && !eventString.startsWith(':')) {
            // Log unexpected SSE format (not data: or comment)
            console.warn('⚠️ [CLIENT] Unexpected SSE format:', {
              eventString: eventString.substring(0, 100),
              timestamp: new Date().toISOString()
            })
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }, [])

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    // Close SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Abort fetch request
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch (error) {
        // Ignore abort errors - they're expected when cleaning up
        console.log('🔧 [CLIENT] Cleanup aborted request (expected)')
      }
      abortControllerRef.current = null
    }
  }, [])

  /**
   * Start search with SSE streaming
   */
  const startSearch = useCallback(async () => {
    console.log(`🔍 [CLIENT] startSearch called`, {
      query,
      queryTrimmed: query.trim(),
      enabled,
      shouldSearch: query.trim() && enabled,
      timestamp: new Date().toISOString()
    })
    
    if (!query.trim() || !enabled) {
      console.log(`🚫 [CLIENT] Search skipped`, {
        reason: !query.trim() ? 'empty query' : 'disabled',
        query,
        enabled,
        timestamp: new Date().toISOString()
      })
      return
    }

    // Prevent multiple simultaneous searches
    if (isSearchingRef.current) {
      console.log('🔧 [CLIENT] Search already in progress, skipping')
      return
    }

    const searchId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log(`🔍 [CLIENT] Starting search: ${searchId}`, {
      searchId,
      query,
      filters,
      platforms,
      maxResults,
      enabled,
      timestamp: new Date().toISOString()
    })

    isSearchingRef.current = true

    // Cleanup previous search FIRST (before creating new abort controller)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Reset state
    setEvents([])
    setIsLoading(true)
    setError(null)
    setTotalEvents(0)
    setIsComplete(false)
    setPlatformStatus([])

    try {
      // Create NEW abort controller AFTER cleanup
      abortControllerRef.current = new AbortController()

      // Prepare request body - validate it's not empty
      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        throw new Error('Query cannot be empty')
      }

      const requestBody = {
        query: trimmedQuery,
        filters,
        platforms,
        maxResults,
      }

      // Create SSE connection using fetch with streaming
      const requestBodyString = JSON.stringify(requestBody)
      
      // Validate request body is not empty
      if (!requestBodyString || requestBodyString === '{}') {
        throw new Error('Request body is empty')
      }

      console.log(`📡 [CLIENT] Making API request: ${searchId}`, {
        searchId,
        url: '/api/search',
        method: 'POST',
        requestBody,
        bodyLength: requestBodyString.length,
        bodyPreview: requestBodyString.substring(0, 100),
        timestamp: new Date().toISOString()
      })
      
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: requestBodyString,
        signal: abortControllerRef.current.signal,
      })

      // Check if response is SSE stream
      const contentType = response.headers.get('content-type')
      const isSSE = contentType?.includes('text/event-stream')
      
      if (!response.ok) {
        console.error(`❌ [CLIENT] API request failed: ${searchId}`, {
          searchId,
          status: response.status,
          statusText: response.statusText,
          contentType,
          timestamp: new Date().toISOString()
        })
        
        // If it's SSE, try to parse the error from the stream
        if (isSSE) {
          try {
            const text = await response.text()
            const lines = text.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'error') {
                  throw new Error(data.data?.message || data.data?.error || `Search failed: ${response.status}`)
                }
              }
            }
          } catch (parseError) {
            // Fall through to generic error
          }
        }
        
        // Generic error for non-SSE or if parsing failed
        throw new Error(`Search failed: ${response.status} ${response.statusText}`)
      }

      if (!isSSE) {
        console.error(`❌ [CLIENT] Invalid content type: ${searchId}`, {
          searchId,
          contentType,
          timestamp: new Date().toISOString()
        })
        throw new Error('Expected SSE stream response')
      }

      console.log(`✅ [CLIENT] SSE connection established: ${searchId}`, {
        searchId,
        contentType,
        timestamp: new Date().toISOString()
      })

      // Process SSE stream
      await processSSEStream(response)

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`🚫 [CLIENT] Search cancelled: ${searchId}`, {
          searchId,
          timestamp: new Date().toISOString()
        })
        // Search was cancelled, don't set error
        return
      }
      
      console.error(`❌ [CLIENT] Search error: ${searchId}`, {
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      setError(error instanceof Error ? error.message : 'Search failed')
      setIsLoading(false)
    } finally {
      // Always reset the searching flag
      isSearchingRef.current = false
    }
  }, [query, filters, platforms, maxResults, enabled])

  /**
   * Retry search
   */
  const retry = useCallback(() => {
    startSearch()
  }, [startSearch])

  /**
   * Clear search results
   */
  const clear = useCallback(() => {
    cleanup()
    setEvents([])
    setIsLoading(false)
    setError(null)
    setTotalEvents(0)
    setIsComplete(false)
    setPlatformStatus([])
  }, [])

  // Start search when dependencies change
  useEffect(() => {
    console.log(`🔄 [CLIENT] useEffect triggered`, {
      query,
      filters,
      platforms,
      maxResults,
      enabled,
      timestamp: new Date().toISOString()
    })
    startSearch()
    
    // Cleanup on unmount
    return cleanup
  }, [startSearch, cleanup])

  // Return search result interface
  const result: SearchResult = {
    events,
    isLoading,
    error,
    totalEvents,
    source,
    platformStatus,
    isComplete,
  }

  return {
    ...result,
    retry,
    clear,
    startSearch,
  }
}

export default useSearch

