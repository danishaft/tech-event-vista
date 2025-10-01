-- Create enum for event platforms
CREATE TYPE public.event_platform AS ENUM ('eventbrite', 'meetup', 'luma', 'other');

-- Create enum for event types
CREATE TYPE public.event_type AS ENUM ('workshop', 'conference', 'meetup', 'hackathon', 'networking', 'webinar', 'other');

-- Create enum for event status
CREATE TYPE public.event_status AS ENUM ('active', 'cancelled', 'sold_out', 'completed');

-- Main events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic event info
  title TEXT NOT NULL,
  description TEXT,
  event_type public.event_type NOT NULL,
  status public.event_status DEFAULT 'active',
  
  -- Date and time
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Location
  venue_name TEXT,
  venue_address TEXT,
  city TEXT,
  country TEXT,
  is_online BOOLEAN DEFAULT false,
  
  -- Pricing
  is_free BOOLEAN DEFAULT true,
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  
  -- Organizer
  organizer_name TEXT,
  organizer_description TEXT,
  organizer_rating DECIMAL(3,2),
  
  -- Attendance
  capacity INTEGER,
  registered_count INTEGER DEFAULT 0,
  
  -- Tech stack (array of tech tags)
  tech_stack TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Quality metrics
  quality_score DECIMAL(5,2) DEFAULT 0,
  
  -- External references
  external_url TEXT NOT NULL,
  image_url TEXT,
  
  -- Source tracking
  source_platform public.event_platform NOT NULL,
  source_id TEXT NOT NULL, -- ID from the source platform
  
  -- Deduplication hash (for finding duplicates)
  dedup_hash TEXT,
  canonical_event_id UUID REFERENCES public.events(id), -- Points to main event if duplicate
  
  -- Metadata
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(source_platform, source_id)
);

-- Create indexes for common queries
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_city ON public.events(city);
CREATE INDEX idx_events_tech_stack ON public.events USING GIN(tech_stack);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_platform ON public.events(source_platform);
CREATE INDEX idx_events_dedup_hash ON public.events(dedup_hash) WHERE dedup_hash IS NOT NULL;

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Public read access for events (anyone can view)
CREATE POLICY "Events are viewable by everyone"
  ON public.events
  FOR SELECT
  USING (true);

-- Function to generate deduplication hash
CREATE OR REPLACE FUNCTION public.generate_dedup_hash(
  p_title TEXT,
  p_event_date TIMESTAMP WITH TIME ZONE,
  p_city TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN md5(
    LOWER(TRIM(p_title)) || 
    TO_CHAR(p_event_date, 'YYYY-MM-DD') || 
    COALESCE(LOWER(TRIM(p_city)), '')
  );
END;
$$;

-- Function to find potential duplicate events
CREATE OR REPLACE FUNCTION public.find_duplicate_events(
  p_event_id UUID
)
RETURNS TABLE (
  duplicate_id UUID,
  similarity_score DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_event RECORD;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  
  RETURN QUERY
  SELECT 
    e.id as duplicate_id,
    CASE 
      WHEN e.dedup_hash = v_event.dedup_hash THEN 1.0
      WHEN e.title = v_event.title AND e.event_date::DATE = v_event.event_date::DATE THEN 0.9
      ELSE 0.0
    END as similarity_score
  FROM public.events e
  WHERE e.id != p_event_id
    AND e.event_date::DATE = v_event.event_date::DATE
    AND (
      e.dedup_hash = v_event.dedup_hash
      OR e.title = v_event.title
    )
  ORDER BY similarity_score DESC;
END;
$$;

-- Scraping jobs tracking table
CREATE TABLE public.scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform public.event_platform NOT NULL,
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  events_found INTEGER DEFAULT 0,
  events_added INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Enable RLS
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Public read access for scraping jobs (for monitoring)
CREATE POLICY "Scraping jobs are viewable by everyone"
  ON public.scraping_jobs
  FOR SELECT
  USING (true);

-- Function to update event's updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_event_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update timestamp
CREATE TRIGGER update_events_timestamp
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_timestamp();