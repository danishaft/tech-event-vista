-- Fix security warnings: set search_path for functions

-- Fix generate_dedup_hash function
CREATE OR REPLACE FUNCTION public.generate_dedup_hash(
  p_title TEXT,
  p_event_date TIMESTAMP WITH TIME ZONE,
  p_city TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN md5(
    LOWER(TRIM(p_title)) || 
    TO_CHAR(p_event_date, 'YYYY-MM-DD') || 
    COALESCE(LOWER(TRIM(p_city)), '')
  );
END;
$$;

-- Fix find_duplicate_events function
CREATE OR REPLACE FUNCTION public.find_duplicate_events(
  p_event_id UUID
)
RETURNS TABLE (
  duplicate_id UUID,
  similarity_score DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix update_event_timestamp function
CREATE OR REPLACE FUNCTION public.update_event_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$;