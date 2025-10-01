import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedEvent {
  title: string;
  description?: string;
  event_type: string;
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
  capacity?: number;
  registered_count?: number;
  tech_stack: string[];
  external_url: string;
  image_url?: string;
  source_platform: string;
  source_id: string;
}

// Tech keywords for categorization
const TECH_KEYWORDS = {
  'React': ['react', 'reactjs', 'react.js', 'react native'],
  'JavaScript': ['javascript', 'js', 'es6', 'typescript', 'ts'],
  'Python': ['python', 'django', 'flask', 'fastapi', 'pytorch'],
  'AI/ML': ['ai', 'ml', 'machine learning', 'artificial intelligence', 'deep learning', 'llm', 'chatgpt'],
  'DevOps': ['devops', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'terraform'],
  'Cloud': ['aws', 'azure', 'gcp', 'cloud computing', 'serverless'],
  'Web3': ['web3', 'blockchain', 'crypto', 'ethereum', 'solidity', 'nft'],
  'Mobile': ['android', 'ios', 'swift', 'kotlin', 'flutter', 'mobile development'],
  'Backend': ['backend', 'api', 'node.js', 'nodejs', 'express', 'nestjs'],
  'Data': ['data science', 'data engineering', 'analytics', 'big data', 'sql'],
  'Security': ['security', 'cybersecurity', 'infosec', 'pentesting'],
};

function extractTechStack(text: string): string[] {
  const lowerText = text.toLowerCase();
  const foundTech = new Set<string>();
  
  for (const [tech, keywords] of Object.entries(TECH_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        foundTech.add(tech);
        break;
      }
    }
  }
  
  return Array.from(foundTech);
}

function generateDedupHash(title: string, date: string, city?: string): string {
  const crypto = globalThis.crypto;
  const text = `${title.toLowerCase().trim()}${date}${city?.toLowerCase().trim() || ''}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return Array.from(new Uint8Array(crypto.subtle.digestSync('MD5', data)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Scraper for Eventbrite (using public search)
async function scrapeEventbrite(city: string = 'San Francisco'): Promise<ScrapedEvent[]> {
  console.log(`Scraping Eventbrite for ${city}...`);
  
  try {
    // Eventbrite public API endpoint (simplified - in production use proper API)
    const searchUrl = `https://www.eventbrite.com/d/${city.toLowerCase().replace(' ', '-')}/tech-events/`;
    
    // In a real implementation, you would:
    // 1. Use Apify's Eventbrite scraper
    // 2. Or use Eventbrite's official API with API key
    // 3. Parse the HTML response properly
    
    // For now, returning mock data structure
    console.log('Eventbrite scraping would happen here. Use Apify or official API.');
    return [];
  } catch (error) {
    console.error('Error scraping Eventbrite:', error);
    return [];
  }
}

// Scraper for Meetup (using public search)
async function scrapeMeetup(city: string = 'San Francisco'): Promise<ScrapedEvent[]> {
  console.log(`Scraping Meetup for ${city}...`);
  
  try {
    // Meetup GraphQL API (requires API key)
    // In production, use Apify's Meetup scraper or official API
    
    console.log('Meetup scraping would happen here. Use Apify or official API.');
    return [];
  } catch (error) {
    console.error('Error scraping Meetup:', error);
    return [];
  }
}

// Scraper for Luma
async function scrapeLuma(city: string = 'San Francisco'): Promise<ScrapedEvent[]> {
  console.log(`Scraping Luma for ${city}...`);
  
  try {
    // Luma API endpoint
    const response = await fetch(`https://api.lu.ma/public/v1/calendar/list-events?city=${encodeURIComponent(city)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TechEventRadar/1.0',
      },
    });
    
    if (!response.ok) {
      console.log(`Luma API returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const events: ScrapedEvent[] = [];
    
    // Parse Luma events
    if (data?.entries) {
      for (const entry of data.entries) {
        const event = entry.event;
        if (!event) continue;
        
        const title = event.name || '';
        const description = event.description || '';
        const techStack = extractTechStack(`${title} ${description}`);
        
        // Only include if it has tech keywords
        if (techStack.length > 0) {
          events.push({
            title,
            description,
            event_type: event.event_type || 'meetup',
            event_date: event.start_at,
            event_end_date: event.end_at,
            venue_name: event.geo_address_json?.venue,
            venue_address: event.geo_address_json?.full_address,
            city: event.geo_address_json?.city || city,
            country: event.geo_address_json?.country,
            is_online: event.meeting_url ? true : false,
            is_free: !event.ticket_types || event.ticket_types.some((t: any) => t.price === 0),
            price_min: event.ticket_types?.[0]?.price,
            price_max: event.ticket_types?.[event.ticket_types.length - 1]?.price,
            organizer_name: event.hosts?.[0]?.name,
            capacity: event.capacity,
            registered_count: event.guests_count,
            tech_stack: techStack,
            external_url: `https://lu.ma/${event.api_id}`,
            image_url: event.cover_url,
            source_platform: 'luma',
            source_id: event.api_id,
          });
        }
      }
    }
    
    console.log(`Found ${events.length} tech events on Luma`);
    return events;
  } catch (error) {
    console.error('Error scraping Luma:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { platform, city = 'San Francisco' } = await req.json();
    
    // Create scraping job
    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert({
        platform: platform || 'luma',
        status: 'running',
        metadata: { city }
      })
      .select()
      .single();
    
    if (jobError) {
      console.error('Error creating job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create scraping job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let events: ScrapedEvent[] = [];
    
    // Scrape based on platform
    if (!platform || platform === 'luma') {
      events = [...events, ...await scrapeLuma(city)];
    }
    if (!platform || platform === 'eventbrite') {
      events = [...events, ...await scrapeEventbrite(city)];
    }
    if (!platform || platform === 'meetup') {
      events = [...events, ...await scrapeMeetup(city)];
    }

    let eventsAdded = 0;
    let eventsUpdated = 0;

    // Insert events into database
    for (const event of events) {
      const dedup_hash = generateDedupHash(event.title, event.event_date, event.city);
      
      // Check if event already exists
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('source_platform', event.source_platform)
        .eq('source_id', event.source_id)
        .single();

      if (existing) {
        // Update existing event
        const { error: updateError } = await supabase
          .from('events')
          .update({ ...event, dedup_hash })
          .eq('id', existing.id);
        
        if (!updateError) eventsUpdated++;
      } else {
        // Insert new event
        const { error: insertError } = await supabase
          .from('events')
          .insert({ ...event, dedup_hash });
        
        if (!insertError) eventsAdded++;
      }
    }

    // Update job status
    await supabase
      .from('scraping_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        events_found: events.length,
        events_added: eventsAdded,
        events_updated: eventsUpdated,
      })
      .eq('id', job.id);

    console.log(`Scraping completed: ${eventsAdded} added, ${eventsUpdated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        events_found: events.length,
        events_added: eventsAdded,
        events_updated: eventsUpdated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-events function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
