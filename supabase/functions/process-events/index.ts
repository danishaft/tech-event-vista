import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json();

    if (action === 'deduplicate') {
      console.log('Starting deduplication process...');
      
      // Get all events without canonical_event_id
      const { data: events, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .is('canonical_event_id', null);

      if (fetchError) {
        throw fetchError;
      }

      let duplicatesFound = 0;

      // Check each event for duplicates
      for (const event of events || []) {
        const { data: duplicates } = await supabase
          .rpc('find_duplicate_events', { p_event_id: event.id });

        if (duplicates && duplicates.length > 0) {
          // Mark duplicates as pointing to the original event
          for (const dup of duplicates) {
            if (dup.similarity_score >= 0.9) {
              await supabase
                .from('events')
                .update({ canonical_event_id: event.id })
                .eq('id', dup.duplicate_id);
              
              duplicatesFound++;
            }
          }
        }
      }

      console.log(`Deduplication complete. Found ${duplicatesFound} duplicates.`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'deduplicate',
          duplicates_found: duplicatesFound,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cleanup') {
      console.log('Starting cleanup of past events...');
      
      // Delete events that ended more than 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .lt('event_date', thirtyDaysAgo.toISOString())
        .eq('status', 'completed');

      if (deleteError) {
        throw deleteError;
      }

      console.log('Cleanup complete.');

      return new Response(
        JSON.stringify({
          success: true,
          action: 'cleanup',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-events function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
