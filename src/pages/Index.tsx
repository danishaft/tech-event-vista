import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { EventCard } from "@/components/EventCard";
import { EventDialog } from "@/components/EventDialog";
import { FilterBar } from "@/components/FilterBar";
import { BottomNavigation } from "@/components/BottomNavigation";
import { sampleEvents, TechEvent } from "@/data/sampleEvents";
import { TrendingUp, Users, Calendar, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TechEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    eventType: "all",
    city: "all", 
    price: "all",
    date: "all"
  });

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

  const filteredEvents = useMemo(() => {
    return sampleEvents.filter(event => {
      if (filters.eventType !== "all" && event.eventType !== filters.eventType) return false;
      if (filters.city !== "all" && event.city !== filters.city) return false;
      if (filters.price !== "all") {
        if (filters.price === "free" && event.price !== "Free") return false;
        if (filters.price === "paid" && event.price === "Free") return false;
      }
      // Add date filtering logic here if needed
      return true;
    });
  }, [filters]);

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

  return (
    <div className="min-h-screen bg-background">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredEvents.map((event) => (
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
};

export default Index;
