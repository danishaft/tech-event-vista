'use client'

import { useMemo, useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { FilterBar } from '@/components/FilterBar'
import { EventCard } from '@/components/EventCard'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useSearch, SearchFilters } from '@/hooks/useSearch'
import { Event } from '@/hooks/useEvents'
import { RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') || searchParams.get('query') || 'San Francisco'
  const platform = searchParams.get('platform') || 'eventbrite'
  const searchType = searchParams.get('type') || 'general'
  const city = searchParams.get('city')

  const [filters, setFilters] = useState<SearchFilters>({
    eventType: 'all',
    city: city || 'all',
    price: 'all',
    date: 'all',
  })

  // Memoize filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(() => filters, [filters])
  
  // Memoize platforms array to prevent unnecessary re-renders
  const memoizedPlatforms = useMemo(() => [platform], [platform])

  // Use new search hook with SSE streaming
  const {
    events: searchEvents,
    isLoading,
    error,
    totalEvents,
    source,
    platformStatus,
    isComplete,
    retry,
    clear,
  } = useSearch(q, memoizedFilters, {
    platforms: memoizedPlatforms,
    maxResults: 50,
    enabled: !!q,
  })

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    // update querystring for shareability
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'city') params.set('q', value)
    else params.set(key, value)
    router.replace(`/search?${params.toString()}`)
  }

  // Map search events to component format
  const events = useMemo(() => {
    return searchEvents.map((event: Event) => {
      const sourceMap: Record<string, string> = {
        'eventbrite': 'Eventbrite',
        'luma': 'Luma',
        'meetup': 'Meetup',
      }
      
      return {
        id: event.id,
        title: event.title,
        date: new Date(event.eventDate).toLocaleDateString(),
        time: new Date(event.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        location: event.isOnline ? 'Online' : event.venueName || event.city || 'TBD',
        city: event.city || 'TBD',
        neighborhood: event.venueAddress || '',
        eventType: (event.eventType || 'meetup') as 'conference' | 'hackathon' | 'meetup' | 'networking' | 'workshop',
        price: event.isFree ? 'Free' : `$${event.priceMin || 0}`,
        image: event.imageUrl || '/placeholder.svg',
        imageUrl: event.imageUrl || '/placeholder.svg',
        organizerRating: event.organizerRating || 4.5,
        attendees: event.registeredCount,
        maxAttendees: event.capacity || 100,
        techStack: event.techStack,
        description: event.description || '',
        organizer: event.organizerName || 'Unknown',
        registrationUrl: event.externalUrl,
        venue: event.venueName || 'TBD',
        capacity: event.capacity || 100,
        source: sourceMap[event.sourcePlatform] || 'Unknown',
        sourceUrl: event.externalUrl,
        isPastEvent: new Date(event.eventDate) < new Date(),
        upcomingDate: new Date(event.eventDate).toISOString(),
        isOnline: event.isOnline,
        isSoldOut: event.status === 'sold_out',
        registrationDeadline: event.eventDate,
        qualityScore: event.qualityScore || 0,
      }
    })
  }, [searchEvents])

  // Get platform status icon
  const getPlatformStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        onMobileMenuToggle={() => {}}
        onSearch={(query) => router.push(`/search?q=${encodeURIComponent(query)}&platform=${platform}`)}
        isSearching={isLoading}
      />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="font-heading text-2xl font-bold">Search results for &quot;{q}&quot;</h1>
            {searchType !== 'general' && (
              <Badge variant="secondary" className="text-xs">
                {searchType === 'category' && 'Technology'}
                {searchType === 'city' && 'Location'}
                {searchType === 'event' && 'Event Type'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-muted-foreground">Platform: {platform}</p>
            <Badge variant="outline" className="text-xs">
              {source === 'database' ? 'Database' : source === 'live_scraping' ? 'Live Scraping' : 'Cache'}
            </Badge>
            {totalEvents > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalEvents} events found
              </Badge>
            )}
            {city && (
              <Badge variant="outline" className="text-xs">
                📍 {city.replace('-', ' ')}
              </Badge>
            )}
          </div>
        </div>

        <FilterBar 
          selectedFilters={{
            eventType: filters.eventType || 'all',
            city: filters.city || 'all',
            price: filters.price || 'all',
            date: filters.date || 'all',
          }} 
          onFilterChange={handleFilterChange} 
          onClearFilters={() => setFilters({ eventType: 'all', city: 'all', price: 'all', date: 'all' })} 
        />

        {/* Platform Status */}
        {platformStatus.length > 0 && (
          <div className="mb-6 p-4 bg-card border border-border rounded-lg">
            <h3 className="font-medium mb-3">Platform Status</h3>
            <div className="flex gap-4">
              {platformStatus.map((platform) => (
                <div key={platform.platform} className="flex items-center gap-2">
                  {getPlatformStatusIcon(platform.status)}
                  <span className="text-sm font-medium">{platform.platform}</span>
                  <Badge variant="outline" className="text-xs">
                    {platform.eventsFound} events
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="font-medium text-red-800">Search Error</span>
            </div>
            <p className="text-red-700 text-sm mb-3">{error}</p>
            <Button onClick={retry} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Search
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium">Searching...</span>
            </div>
            <Progress value={undefined} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {source === 'database' ? 'Searching database...' : 'Live scraping in progress...'}
            </p>
          </div>
        )}

        {/* Events Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-40">
                <CardContent className="p-5">
                  <Skeleton className="h-full w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {events.map((event: any) => (
              <EventCard key={event.id} event={event} onClick={() => window.open(event.registrationUrl, '_blank')} />
            ))}
          </div>
        )}

        {/* No Results */}
        {events.length === 0 && !isLoading && !error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No events found for &quot;{q}&quot;. Try another query.</p>
            <Button onClick={retry} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Search Again
            </Button>
          </div>
        )}

        {/* Search Complete */}
        {isComplete && events.length > 0 && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">Search Complete</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Found {totalEvents} events from {source === 'database' ? 'database' : 'live scraping'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <Header onMobileMenuToggle={() => {}} onSearch={() => {}} isSearching={false} />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-40">
                <CardContent className="p-5">
                  <Skeleton className="h-full w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}



