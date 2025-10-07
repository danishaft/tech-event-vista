import { useQuery } from '@tanstack/react-query';
import { sampleEvents, TechEvent } from '@/data/sampleEvents';

// Map TechEvent to the expected format for compatibility
export interface Event {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  status: string;
  event_date: string;
  event_end_date?: string;
  venue_name?: string;
  venue_address?: string;
  city?: string;
  country?: string;
  is_online: boolean;
  is_free: boolean;
  price_min?: number;
  price_max?: number;
  currency?: string;
  organizer_name?: string;
  organizer_description?: string;
  organizer_rating?: number;
  capacity?: number;
  registered_count: number;
  tech_stack: string[];
  quality_score?: number;
  external_url: string;
  image_url?: string;
  source_platform: string;
  source_id: string;
  scraped_at: string;
  last_updated: string;
  created_at: string;
}

const mapTechEventToEvent = (techEvent: TechEvent): Event => {
  return {
    id: techEvent.id,
    title: techEvent.title,
    description: techEvent.description,
    event_type: techEvent.eventType,
    status: 'active',
    event_date: techEvent.date,
    event_end_date: techEvent.date,
    venue_name: techEvent.location,
    venue_address: techEvent.neighborhood,
    city: techEvent.city,
    country: 'US',
    is_online: techEvent.isOnline,
    is_free: techEvent.price === 'Free',
    price_min: techEvent.price === 'Free' ? 0 : parseInt(techEvent.price.replace('$', '')),
    price_max: techEvent.price === 'Free' ? 0 : parseInt(techEvent.price.replace('$', '')),
    currency: 'USD',
    organizer_name: techEvent.organizer,
    organizer_description: '',
    organizer_rating: techEvent.organizerRating,
    capacity: techEvent.maxAttendees,
    registered_count: techEvent.attendees,
    tech_stack: techEvent.techStack,
    quality_score: techEvent.qualityScore,
    external_url: techEvent.sourceUrl,
    image_url: techEvent.imageUrl,
    source_platform: techEvent.source.toLowerCase(),
    source_id: techEvent.id,
    scraped_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
};

export const useEvents = () => {
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return sampleEvents.map(mapTechEventToEvent);
    },
  });

  return {
    events,
    isLoading,
    error,
    scrapeEvents: () => {
      console.log('Scraping not available in demo mode');
    },
    isScraping: false,
  };
};
