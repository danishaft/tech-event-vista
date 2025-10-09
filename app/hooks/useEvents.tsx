import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Real API event interface matching the database schema
export interface Event {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  status: string;
  eventDate: string;
  eventEndDate?: string;
  venueName?: string;
  venueAddress?: string;
  city?: string;
  country?: string;
  isOnline: boolean;
  isFree: boolean;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  organizerName?: string;
  organizerDescription?: string;
  organizerRating?: number;
  capacity?: number;
  registeredCount: number;
  techStack: string[];
  qualityScore?: number;
  externalUrl: string;
  imageUrl?: string;
  sourcePlatform: string;
  sourceId: string;
  scrapedAt: string;
  lastUpdated: string;
  createdAt: string;
}

export const useEvents = (opts?: {
  city?: string;
  eventType?: string;
  price?: string;
  date?: string;
  limit?: number;
  page?: number;
  enablePolling?: boolean;
}) => {
  const queryClient = useQueryClient();

  // Fetch events from real API
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  else params.set('limit', '50');
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.city && opts.city !== 'all') params.set('city', opts.city);
  if (opts?.eventType && opts.eventType !== 'all') params.set('eventType', opts.eventType);
  if (opts?.price && opts.price !== 'all') params.set('price', opts.price);
  if (opts?.date && opts.date !== 'all') params.set('date', opts.date);

  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['events', Object.fromEntries(params)],
    queryFn: async () => {
      const response = await fetch(`/api/events?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      return data.events;
    },
    refetchInterval: opts?.enablePolling ? 5000 : 30000, // More aggressive polling when enabled
    refetchIntervalInBackground: opts?.enablePolling || false,
  });

  // Scraping mutation
  const scrapeMutation = useMutation({
    mutationFn: async ({ platform, city }: { platform: string; city: string }) => {
      const response = await fetch('/api/scraping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform, city }),
      });
      if (!response.ok) {
        throw new Error('Failed to start scraping');
      }
      return response.json();
    },
    onSuccess: () => {
      // Refetch events after successful scraping
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  return {
    events,
    isLoading,
    error,
    refetch,
    scrapeEvents: (platform: string, city: string) => {
      scrapeMutation.mutate({ platform, city });
    },
    isScraping: scrapeMutation.isPending,
    scrapingError: scrapeMutation.error,
  };
};
