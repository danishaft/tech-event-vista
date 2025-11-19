'use client'

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { EventCard } from "@/components/EventCard";
import { EventDialog } from "@/components/EventDialog";
import { BottomNavigation } from "@/components/BottomNavigation";
import { HeroSection } from "@/components/HeroSection";
import { FeaturedEvents } from "@/components/FeaturedEvents";
import { Footer } from "@/components/Footer";
import { useEvents, Event } from "@/hooks/useEvents";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState("all");

  const { events: dbEvents, isLoading } = useEvents();

  const quickFilters = [
    { label: "All", value: "all" },
    { label: "This Week", value: "this-week" },
    { label: "This Month", value: "this-month" },
    { label: "Free Events", value: "free" },
  ];

  // Map database events to component format
  const events = useMemo(() => {
    return dbEvents.map((event: Event) => {
      const sourceMap: Record<string, 'Eventbrite' | 'Luma' | 'Meetup'> = {
        'eventbrite': 'Eventbrite',
        'luma': 'Luma',
        'meetup': 'Meetup',
      };
      
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
        source: sourceMap[event.sourcePlatform] || 'Luma',
        sourceUrl: event.externalUrl,
        isPastEvent: new Date(event.eventDate) < new Date(),
        upcomingDate: new Date(event.eventDate).toISOString(),
        isOnline: event.isOnline,
        isSoldOut: event.status === 'sold_out',
        registrationDeadline: event.eventDate,
        qualityScore: event.qualityScore || 0,
      };
    });
  }, [dbEvents]);

  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    // Apply quick filter
    if (quickFilter === "this-week") {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((event: any) => {
        const eventDate = new Date(event.date);
        return eventDate >= now && eventDate <= weekFromNow;
      });
    } else if (quickFilter === "this-month") {
      const now = new Date();
      const monthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      filtered = filtered.filter((event: any) => {
        const eventDate = new Date(event.date);
        return eventDate >= now && eventDate <= monthFromNow;
      });
    } else if (quickFilter === "free") {
      filtered = filtered.filter((event: any) => event.price === "Free");
    }
    
    return filtered;
  }, [events, quickFilter]);

  // Show only 2 rows (8 events for 4 columns, 6 for 3 columns, etc.)
  const displayedEvents = filteredEvents.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />
      
      <main className="pb-20 md:pb-8">
        {/* Hero Section */}
        <HeroSection />

        {/* Featured Events Section - ARKLYTE Style */}
        <FeaturedEvents />

        {/* Main Content - ARKLYTE Style "Suggestions for discovery" */}
        <div className="max-w-7xl mx-auto px-6 pt-spacing-section pb-spacing-section">
          {/* Section Header with View All Button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-2xl md:text-3xl font-bold mb-2 text-foreground">
                Discover Events
              </h2>
              <p className="text-muted-foreground text-base md:text-lg">
                Popular events recommended for you
              </p>
            </div>
            <Link href="/events">
              <Button 
                variant="outline" 
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-doow-sm md:rounded-doow-md"
              >
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Quick Filters - ARKLYTE Style (Left side) */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            {quickFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setQuickFilter(filter.value)}
                className={`px-4 py-2 rounded-doow-sm md:rounded-doow-md text-sm font-medium transition-all ${
                  quickFilter === filter.value
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Events Grid - 2 Rows Only */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i} className="rounded-lg overflow-hidden">
                  <div className="p-0">
                    <Skeleton className="h-56 w-full" />
                    <div className="p-5 space-y-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedEvents.map((event: any) => (
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
              {filteredEvents.length > 8 && (
                <div className="mt-8 text-center">
                  <Link href="/events">
                    <Button 
                      variant="outline" 
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-doow-sm md:rounded-doow-md"
                    >
                      View All Events ({filteredEvents.length})
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
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

