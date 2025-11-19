'use client'

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { EventCard } from "@/components/EventCard";
import { EventDialog } from "@/components/EventDialog";
import { FilterBar } from "@/components/FilterBar";
import { BottomNavigation } from "@/components/BottomNavigation";
import { Footer } from "@/components/Footer";
import { useEvents, Event } from "@/hooks/useEvents";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function EventsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    eventType: "all",
    city: "all", 
    price: "all",
    date: "all"
  });

  const { events: dbEvents, isLoading } = useEvents();
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      eventType: "all",
      city: "all",
      price: "all", 
      date: "all"
    });
  };

  // Map database events to component format
  const events = useMemo(() => {
    return dbEvents.map((event: Event) => {
      const sourceMap: Record<string, 'Eventbrite' | 'Luma' | 'Meetup'> = {
        'eventbrite': 'Eventbrite',
        'luma': 'Luma',
        'meetup': 'Meetup',
      };
      
      const eventDate = new Date(event.eventDate);
      
      return {
        id: event.id,
        title: event.title,
        date: eventDate.toLocaleDateString(),
        dateObj: eventDate, // Keep original date object for filtering
        time: eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
        source: sourceMap[event.sourcePlatform] || 'Luma',
        sourceUrl: event.externalUrl,
        isPastEvent: eventDate < new Date(),
        upcomingDate: eventDate.toISOString(),
        isOnline: event.isOnline,
        isSoldOut: event.status === 'sold_out',
        registrationDeadline: event.eventDate,
        qualityScore: event.qualityScore || 0,
      };
    });
  }, [dbEvents]);

  // Initialize from URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSearchQuery = searchParams.get('q') || '';
      const urlCity = searchParams.get('city') || '';
      const urlDate = searchParams.get('date') || '';

      if (urlCity && urlCity !== 'all') {
        setFilters(prev => ({ ...prev, city: urlCity }));
      }
      if (urlDate && urlDate !== 'all') {
        setFilters(prev => ({ ...prev, date: urlDate }));
      }
      if (urlSearchQuery) {
        setSearchQuery(urlSearchQuery);
      }
    }
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // The search will filter events below
  };

  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    // Apply text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event: any) => 
        event.title?.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.city?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.techStack?.some((tech: string) => tech.toLowerCase().includes(query))
      );
    }
    
    // Apply filters
    if (filters.eventType !== "all") {
      filtered = filtered.filter((event: any) => event.eventType === filters.eventType);
    }
    
    if (filters.city !== "all") {
      filtered = filtered.filter((event: any) => 
        event.city?.toLowerCase() === filters.city.toLowerCase() ||
        event.location?.toLowerCase().includes(filters.city.toLowerCase())
      );
    }
    
    if (filters.price !== "all") {
      if (filters.price === "free") {
        filtered = filtered.filter((event: any) => event.price === "Free");
      } else if (filters.price === "paid") {
        filtered = filtered.filter((event: any) => event.price !== "Free");
      }
    }
    
    // Apply date filter
    if (filters.date !== "all") {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Reset to start of day
      
      if (filters.date === "this-week") {
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((event: any) => {
          const eventDate = event.dateObj || new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= now && eventDate <= weekFromNow;
        });
      } else if (filters.date === "this-month") {
        const monthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        filtered = filtered.filter((event: any) => {
          const eventDate = event.dateObj || new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= now && eventDate <= monthFromNow;
        });
      } else if (filters.date === "next-month") {
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        filtered = filtered.filter((event: any) => {
          const eventDate = event.dateObj || new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= nextMonthStart && eventDate <= nextMonthEnd;
        });
      }
    }
    
    return filtered;
  }, [events, filters, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />
      
      <main className="pb-20 md:pb-8">
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-spacing-section">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2 text-foreground">
              All Events
            </h1>
            <p className="text-muted-foreground text-lg">
              Discover and explore all available tech events
            </p>
          </div>

          {/* Filters with Search */}
          <FilterBar 
            selectedFilters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            onSearch={handleSearch}
            isSearching={false}
          />

          {/* Events Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i} className="rounded-lg overflow-hidden">
                  <CardContent className="p-0">
                    <Skeleton className="h-56 w-full" />
                    <div className="p-5 space-y-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {filteredEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredEvents.map((event: any) => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      onClick={() => {
                        setSelectedEvent(event);
                        setIsDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-muted-foreground text-lg mb-2">
                    {events.length === 0 
                      ? "No events available at the moment." 
                      : "No events found matching your filters."}
                  </p>
                  <p className="text-muted-foreground-light text-sm mb-4">
                    {events.length === 0 
                      ? "Check back later for new events." 
                      : `Showing ${events.length} total events. Try adjusting your filters.`}
                  </p>
                  {events.length > 0 && (
                    <button
                      onClick={handleClearFilters}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Event Details Dialog */}
          <EventDialog 
            event={selectedEvent}
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
          />

          {filteredEvents.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-2">No events found matching your filters.</p>
              <p className="text-muted-foreground-light">Try adjusting your search criteria.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

