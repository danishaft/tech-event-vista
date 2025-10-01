export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      events: {
        Row: {
          canonical_event_id: string | null
          capacity: number | null
          city: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          dedup_hash: string | null
          description: string | null
          event_date: string
          event_end_date: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          external_url: string
          id: string
          image_url: string | null
          is_free: boolean | null
          is_online: boolean | null
          last_updated: string | null
          organizer_description: string | null
          organizer_name: string | null
          organizer_rating: number | null
          price_max: number | null
          price_min: number | null
          quality_score: number | null
          registered_count: number | null
          scraped_at: string | null
          source_id: string
          source_platform: Database["public"]["Enums"]["event_platform"]
          status: Database["public"]["Enums"]["event_status"] | null
          tech_stack: string[] | null
          title: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          canonical_event_id?: string | null
          capacity?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          dedup_hash?: string | null
          description?: string | null
          event_date: string
          event_end_date?: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          external_url: string
          id?: string
          image_url?: string | null
          is_free?: boolean | null
          is_online?: boolean | null
          last_updated?: string | null
          organizer_description?: string | null
          organizer_name?: string | null
          organizer_rating?: number | null
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          registered_count?: number | null
          scraped_at?: string | null
          source_id: string
          source_platform: Database["public"]["Enums"]["event_platform"]
          status?: Database["public"]["Enums"]["event_status"] | null
          tech_stack?: string[] | null
          title: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          canonical_event_id?: string | null
          capacity?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          dedup_hash?: string | null
          description?: string | null
          event_date?: string
          event_end_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          external_url?: string
          id?: string
          image_url?: string | null
          is_free?: boolean | null
          is_online?: boolean | null
          last_updated?: string | null
          organizer_description?: string | null
          organizer_name?: string | null
          organizer_rating?: number | null
          price_max?: number | null
          price_min?: number | null
          quality_score?: number | null
          registered_count?: number | null
          scraped_at?: string | null
          source_id?: string
          source_platform?: Database["public"]["Enums"]["event_platform"]
          status?: Database["public"]["Enums"]["event_status"] | null
          tech_stack?: string[] | null
          title?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      scraping_jobs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          events_added: number | null
          events_found: number | null
          events_updated: number | null
          id: string
          metadata: Json | null
          platform: Database["public"]["Enums"]["event_platform"]
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          events_added?: number | null
          events_found?: number | null
          events_updated?: number | null
          id?: string
          metadata?: Json | null
          platform: Database["public"]["Enums"]["event_platform"]
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          events_added?: number | null
          events_found?: number | null
          events_updated?: number | null
          id?: string
          metadata?: Json | null
          platform?: Database["public"]["Enums"]["event_platform"]
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_duplicate_events: {
        Args: { p_event_id: string }
        Returns: {
          duplicate_id: string
          similarity_score: number
        }[]
      }
      generate_dedup_hash: {
        Args: { p_city: string; p_event_date: string; p_title: string }
        Returns: string
      }
    }
    Enums: {
      event_platform: "eventbrite" | "meetup" | "luma" | "other"
      event_status: "active" | "cancelled" | "sold_out" | "completed"
      event_type:
        | "workshop"
        | "conference"
        | "meetup"
        | "hackathon"
        | "networking"
        | "webinar"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_platform: ["eventbrite", "meetup", "luma", "other"],
      event_status: ["active", "cancelled", "sold_out", "completed"],
      event_type: [
        "workshop",
        "conference",
        "meetup",
        "hackathon",
        "networking",
        "webinar",
        "other",
      ],
    },
  },
} as const
