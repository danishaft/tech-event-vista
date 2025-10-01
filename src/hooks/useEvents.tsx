import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export const useEvents = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .is('canonical_event_id', null) // Only get non-duplicate events
        .gte('event_date', new Date().toISOString()) // Future events only
        .order('event_date', { ascending: true })
        .limit(100);

      if (error) throw error;
      return data as Event[];
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async ({ platform, city }: { platform?: string; city?: string }) => {
      const { data, error } = await supabase.functions.invoke('scrape-events', {
        body: { platform, city },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Scraping completed',
        description: `Found ${data.events_found} events. Added ${data.events_added}, updated ${data.events_updated}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error) => {
      toast({
        title: 'Scraping failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    events,
    isLoading,
    error,
    scrapeEvents: scrapeMutation.mutate,
    isScraping: scrapeMutation.isPending,
  };
};
