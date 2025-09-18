import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { EventCard } from "@/components/EventCard";
import { AdvancedFilterSidebar } from "@/components/AdvancedFilterSidebar";
import { BottomNavigation } from "@/components/BottomNavigation";
import { sampleEvents } from "@/data/sampleEvents";
import { TrendingUp, Users, Calendar, Star, Filter, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    city: "all",
    techStack: [] as string[],
    eventType: [] as string[],
    dateRange: "all",
    price: [] as string[],
    format: [] as string[],
    rating: "all"
  });

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearAllFilters = () => {
    setFilters({
      city: "all",
      techStack: [],
      eventType: [],
      dateRange: "all",
      price: [],
      format: [],
      rating: "all"
    });
    setSearchQuery("");
  };

  const filteredEvents = useMemo(() => {
    return sampleEvents.filter(event => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          event.title,
          event.description,
          event.city,
          event.neighborhood,
          event.organizer,
          ...event.techStack
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) return false;
      }

      // City filter
      if (filters.city !== "all" && event.city !== filters.city) return false;
      
      // Tech stack filter
      if (filters.techStack.length > 0) {
        const hasMatchingTech = filters.techStack.some(tech => 
          event.techStack.includes(tech)
        );
        if (!hasMatchingTech) return false;
      }
      
      // Event type filter
      if (filters.eventType.length > 0 && !filters.eventType.includes(event.eventType)) return false;
      
      // Price filter
      if (filters.price.length > 0) {
        const isFree = event.price === "Free";
        const isPaid = event.price !== "Free";
        
        if (filters.price.includes('free') && !isFree) return false;
        if (filters.price.includes('paid') && !isPaid) return false;
      }
      
      // Format filter
      if (filters.format.length > 0) {
        if (filters.format.includes('online') && !event.isOnline) return false;
        if (filters.format.includes('in-person') && event.isOnline) return false;
        // Add hybrid logic if needed
      }
      
      // Rating filter
      if (filters.rating !== "all") {
        const minRating = parseFloat(filters.rating);
        if (event.organizerRating < minRating) return false;
      }

      return true;
    });
  }, [filters, searchQuery]);

  // Stats for the dashboard
  const stats = {
    totalEvents: sampleEvents.length,
    thisWeek: sampleEvents.filter(event => {
      const eventDate = new Date(event.date);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return eventDate >= now && eventDate <= weekFromNow;
    }).length,
    averageRating: (sampleEvents.reduce((acc, event) => acc + event.organizerRating, 0) / sampleEvents.length).toFixed(1),
    totalAttendees: sampleEvents.reduce((acc, event) => acc + event.attendees, 0)
  };

  // Check if any filters are active
  const hasActiveFilters = 
    filters.city !== "all" ||
    filters.techStack.length > 0 ||
    filters.eventType.length > 0 ||
    filters.dateRange !== "all" ||
    filters.price.length > 0 ||
    filters.format.length > 0 ||
    filters.rating !== "all" ||
    searchQuery !== "";

  // Get featured events (high quality score)
  const featuredEvents = sampleEvents.filter(event => event.qualityScore >= 9.0).slice(0, 3);

  // Recommended events near you (mock logic)
  const nearbyEvents = sampleEvents.filter(event => 
    ['San Francisco', 'Mountain View', 'Menlo Park'].includes(event.city)
  ).slice(0, 5);

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <div className="flex p-4">
            <Skeleton className="w-30 h-20 rounded" />
            <div className="flex-1 ml-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex space-x-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex space-x-1">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-14" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      <div className="flex">
        {/* Filter Sidebar */}
        <AdvancedFilterSidebar
          isOpen={isFilterSidebarOpen}
          onClose={() => setIsFilterSidebarOpen(false)}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAllFilters}
        />
        
        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto px-4 py-6 pb-20 md:pb-6">
          {/* Hero Section with Filter Toggle */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">
                Discover Amazing Tech Events
              </h1>
              <p className="text-muted-foreground text-lg">
                Find workshops, conferences, and meetups in your area
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsFilterSidebarOpen(true)}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  {[
                    filters.city !== "all" ? 1 : 0,
                    filters.techStack.length,
                    filters.eventType.length,
                    filters.price.length,
                    filters.format.length,
                    filters.rating !== "all" ? 1 : 0,
                    searchQuery ? 1 : 0
                  ].reduce((a, b) => a + b, 0)}
                </Badge>
              )}
            </Button>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mb-6 p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Active Filters:</span>
                <Button variant="ghost" size="sm" onClick={handleClearAllFilters}>
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs">
                    Search: "{searchQuery}"
                  </Badge>
                )}
                {filters.city !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    📍 {filters.city}
                  </Badge>
                )}
                {filters.techStack.map(tech => (
                  <Badge key={tech} variant="secondary" className="text-xs">
                    💻 {tech}
                  </Badge>
                ))}
                {filters.eventType.map(type => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    🎯 {type}
                  </Badge>
                ))}
                {filters.price.map(price => (
                  <Badge key={price} variant="secondary" className="text-xs">
                    💰 {price}
                  </Badge>
                ))}
                {filters.format.map(format => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    📱 {format}
                  </Badge>
                ))}
                {filters.rating !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    ⭐ {filters.rating}+ stars
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

          {/* Featured Events Section */}
          {!hasActiveFilters && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-accent" />
                Featured Events
              </h2>
              <div className="space-y-4">
                {featuredEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* Events Near You Section */}
          {!hasActiveFilters && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Events Near You
              </h2>
              <div className="space-y-4">
                {nearbyEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* All Events / Filtered Results */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-muted-foreground" />
                {hasActiveFilters ? `Filtered Results (${filteredEvents.length})` : 'All Events'}
              </span>
            </h2>
            
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="space-y-4">
                {filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}

            {filteredEvents.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <div className="mb-4">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg font-medium">No events found</p>
                  <p className="text-muted-foreground">Try adjusting your search criteria or filters</p>
                </div>
                <Button variant="outline" onClick={handleClearAllFilters}>
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
