'use client'

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { EventCard } from "@/components/EventCard";
import { EventDialog } from "@/components/EventDialog";
import { FilterBar } from "@/components/FilterBar";
import { BottomNavigation } from "@/components/BottomNavigation";
import { QuickSearch } from "@/components/QuickSearch";
import { useEvents, Event } from "@/hooks/useEvents";
import { TrendingUp, Users, Calendar, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
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
    return events.filter((event: any) => {
      if (filters.eventType !== "all" && event.eventType !== filters.eventType) return false;
      if (filters.city !== "all" && event.city !== filters.city) return false;
      if (filters.price !== "all") {
        if (filters.price === "free" && event.price !== "Free") return false;
        if (filters.price === "paid" && event.price === "Free") return false;
      }
      return true;
    });
  }, [events, filters]);

  // Stats for the dashboard
  const stats = {
    totalEvents: dbEvents.length,
    thisWeek: dbEvents.filter((event: Event) => {
      const eventDate = new Date(event.eventDate);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return eventDate >= now && eventDate <= weekFromNow;
    }).length,
    averageRating: dbEvents.length > 0 ? (dbEvents.reduce((acc: number, event: Event) => acc + (event.organizerRating || 4.5), 0) / dbEvents.length).toFixed(1) : '0.0',
    totalAttendees: dbEvents.reduce((acc: number, event: Event) => acc + event.registeredCount, 0)
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onSearch={(query) => {
          // Redirect to search results page
          router.push(`/search?q=${encodeURIComponent(query)}&platform=eventbrite`);
        }}
        isSearching={false}
      />
      
      <main className="max-w-7xl mx-auto px-6 py-8 pb-20 md:pb-8">
        {/* Hero Section */}
        <div className="mb-10">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">
            Discover Amazing Tech Events
          </h1>
          <p className="text-muted-foreground text-lg">
            Find workshops, conferences, and meetups in your area
          </p>
        </div>

        {/* Quick Search Section */}
        <div className="mb-12">
          <QuickSearch />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEvents}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisWeek}</p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Star className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.averageRating}</p>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAttendees.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Attendees</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <FilterBar 
          selectedFilters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

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
        )}

        {/* Event Details Dialog */}
        <EventDialog 
          event={selectedEvent}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No events found matching your filters.</p>
            <p className="text-muted-foreground">Try adjusting your search criteria.</p>
          </div>
        )}
      </main>

      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

