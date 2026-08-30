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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_change_requests: {
        Row: {
          appointment_id: string
          business_id: string
          created_at: string
          id: string
          proposed_start_time: string | null
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          type: string
        }
        Insert: {
          appointment_id: string
          business_id: string
          created_at?: string
          id?: string
          proposed_start_time?: string | null
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type: string
        }
        Update: {
          appointment_id?: string
          business_id?: string
          created_at?: string
          id?: string
          proposed_start_time?: string | null
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_change_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_change_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders_sent: {
        Row: {
          appointment_id: string
          claimed_at: string
          template_id: string
        }
        Insert: {
          appointment_id: string
          claimed_at?: string
          template_id: string
        }
        Update: {
          appointment_id?: string
          claimed_at?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_sent_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          business_id: string
          cancellation_reason: string | null
          created_at: string
          created_via: Database["public"]["Enums"]["booking_source"]
          customer_confirmed: boolean | null
          customer_id: string
          customer_link_token: string
          end_time: string
          google_event_id: string | null
          id: string
          notes: string | null
          service_id: string
          staff_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          cancellation_reason?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["booking_source"]
          customer_confirmed?: boolean | null
          customer_id: string
          customer_link_token?: string
          end_time: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          service_id: string
          staff_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancellation_reason?: string | null
          created_at?: string
          created_via?: Database["public"]["Enums"]["booking_source"]
          customer_confirmed?: boolean | null
          customer_id?: string
          customer_link_token?: string
          end_time?: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          service_id?: string
          staff_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rules: {
        Row: {
          business_id: string
          cancellation_window_minutes: number
          created_at: string
          id: string
          max_future_days: number
          min_advance_minutes: number
          reschedule_window_minutes: number
          updated_at: string
        }
        Insert: {
          business_id: string
          cancellation_window_minutes?: number
          created_at?: string
          id?: string
          max_future_days?: number
          min_advance_minutes?: number
          reschedule_window_minutes?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancellation_window_minutes?: number
          created_at?: string
          id?: string
          max_future_days?: number
          min_advance_minutes?: number
          reschedule_window_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      breaks: {
        Row: {
          business_id: string
          created_at: string
          day_of_week: number | null
          end_time: string
          id: string
          label: string | null
          specific_date: string | null
          staff_id: string | null
          start_time: string
          type: Database["public"]["Enums"]["break_type"]
        }
        Insert: {
          business_id: string
          created_at?: string
          day_of_week?: number | null
          end_time: string
          id?: string
          label?: string | null
          specific_date?: string | null
          staff_id?: string | null
          start_time: string
          type: Database["public"]["Enums"]["break_type"]
        }
        Update: {
          business_id?: string
          created_at?: string
          day_of_week?: number | null
          end_time?: string
          id?: string
          label?: string | null
          specific_date?: string | null
          staff_id?: string | null
          start_time?: string
          type?: Database["public"]["Enums"]["break_type"]
        }
        Relationships: [
          {
            foreignKeyName: "breaks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          allow_multiple_bookings: boolean
          bot_context: string | null
          category: string
          contact_phone: string | null
          cover_url: string | null
          created_at: string
          default_language: Database["public"]["Enums"]["supported_language"]
          description: string | null
          email: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string
          slug: string
          social_links: Json | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_multiple_bookings?: boolean
          bot_context?: string | null
          category: string
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          default_language?: Database["public"]["Enums"]["supported_language"]
          description?: string | null
          email: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone: string
          slug: string
          social_links?: Json | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_multiple_bookings?: boolean
          bot_context?: string | null
          category?: string
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          default_language?: Database["public"]["Enums"]["supported_language"]
          description?: string | null
          email?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string
          slug?: string
          social_links?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          language_preference: Database["public"]["Enums"]["supported_language"]
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_preference?: Database["public"]["Enums"]["supported_language"]
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language_preference?: Database["public"]["Enums"]["supported_language"]
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_events: {
        Row: {
          business_id: string
          end_time: string
          google_event_id: string
          id: string
          start_time: string
          summary: string | null
        }
        Insert: {
          business_id: string
          end_time: string
          google_event_id: string
          id?: string
          start_time: string
          summary?: string | null
        }
        Update: {
          business_id?: string
          end_time?: string
          google_event_id?: string
          id?: string
          start_time?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          business_id: string
          created_at: string
          google_calendar_id: string | null
          id: string
          push_enabled: boolean
          refresh_token: string
          sync_enabled: boolean
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          business_id: string
          created_at?: string
          google_calendar_id?: string | null
          id?: string
          push_enabled?: boolean
          refresh_token: string
          sync_enabled?: boolean
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          business_id?: string
          created_at?: string
          google_calendar_id?: string | null
          id?: string
          push_enabled?: boolean
          refresh_token?: string
          sync_enabled?: boolean
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_tokens_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          appointment_id: string | null
          business_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          customer_id: string | null
          customer_response: string | null
          delivered_at: string | null
          error: string | null
          id: string
          message_content: string | null
          read_at: string | null
          responded_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template_id: string | null
          type: string
          whatsapp_message_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string | null
          customer_response?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          message_content?: string | null
          read_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_id?: string | null
          type: string
          whatsapp_message_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string | null
          customer_response?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          message_content?: string | null
          read_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_id?: string | null
          type?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          is_active: boolean
          max_appointments_monthly: number
          max_staff: number
          monthly_price: number
          name: string
          updated_at: string
          yearly_price: number
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          max_appointments_monthly?: number
          max_staff?: number
          monthly_price?: number
          name: string
          updated_at?: string
          yearly_price?: number
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean
          max_appointments_monthly?: number
          max_staff?: number
          monthly_price?: number
          name?: string
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          minutes_before: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          minutes_before: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          minutes_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "reminder_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          name_ar: string | null
          name_en: string | null
          name_he: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          name_ar?: string | null
          name_en?: string | null
          name_he: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          name_ar?: string | null
          name_en?: string | null
          name_he?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          buffer_minutes: number
          business_id: string
          category_id: string | null
          color: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          description_he: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          max_capacity: number
          name_ar: string | null
          name_en: string | null
          name_he: string
          price: number
          price_type: string
          reminder_confirmation: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          buffer_minutes?: number
          business_id: string
          category_id?: string | null
          color?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_he?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_capacity?: number
          name_ar?: string | null
          name_en?: string | null
          name_he: string
          price?: number
          price_type?: string
          reminder_confirmation?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          buffer_minutes?: number
          business_id?: string
          category_id?: string | null
          color?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          description_he?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          max_capacity?: number
          name_ar?: string | null
          name_en?: string | null
          name_he?: string
          price?: number
          price_type?: string
          reminder_confirmation?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          id: string
          service_id: string
          staff_id: string
        }
        Insert: {
          id?: string
          service_id: string
          staff_id: string
        }
        Update: {
          id?: string
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          payplus_subscription_id: string | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          payplus_subscription_id?: string | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          payplus_subscription_id?: string | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          requested_date: string
          requested_time: string
          service_id: string
          status: Database["public"]["Enums"]["waitlist_status"]
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          requested_date: string
          requested_time: string
          service_id: string
          status?: Database["public"]["Enums"]["waitlist_status"]
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          requested_date?: string
          requested_time?: string
          service_id?: string
          status?: Database["public"]["Enums"]["waitlist_status"]
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_credentials: {
        Row: {
          access_token: string
          app_secret: string | null
          business_id: string
          created_at: string
          display_phone: string | null
          id: string
          is_active: boolean
          phone_number_id: string
          updated_at: string
          verified_at: string | null
          verify_token: string | null
        }
        Insert: {
          access_token: string
          app_secret?: string | null
          business_id: string
          created_at?: string
          display_phone?: string | null
          id?: string
          is_active?: boolean
          phone_number_id: string
          updated_at?: string
          verified_at?: string | null
          verify_token?: string | null
        }
        Update: {
          access_token?: string
          app_secret?: string | null
          business_id?: string
          created_at?: string
          display_phone?: string | null
          id?: string
          is_active?: boolean
          phone_number_id?: string
          updated_at?: string
          verified_at?: string | null
          verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credentials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          business_id: string
          day_of_week: number
          end_time: string
          id: string
          is_closed: boolean
          staff_id: string | null
          start_time: string
        }
        Insert: {
          business_id: string
          day_of_week: number
          end_time: string
          id?: string
          is_closed?: boolean
          staff_id?: string | null
          start_time: string
        }
        Update: {
          business_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_closed?: boolean
          staff_id?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_booking_lock: {
        Args: { biz_id: string; cust_id: string }
        Returns: undefined
      }
      find_or_create_customer: {
        Args: {
          p_language?: Database["public"]["Enums"]["supported_language"]
          p_name?: string
          p_phone: string
        }
        Returns: {
          created_at: string
          id: string
          language_preference: Database["public"]["Enums"]["supported_language"]
          name: string
          phone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_business_ids: { Args: never; Returns: string[] }
      is_business_owner: { Args: { p_business_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
        | "pending_approval"
      booking_source: "whatsapp" | "web" | "manual"
      break_type: "recurring" | "one_time"
      member_role: "owner" | "staff"
      notification_channel: "whatsapp" | "sms" | "email" | "system"
      notification_status:
        | "pending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "logged"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
      supported_language: "he" | "ar" | "en"
      waitlist_status:
        | "waiting"
        | "notified"
        | "claimed"
        | "expired"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
        "pending_approval",
      ],
      booking_source: ["whatsapp", "web", "manual"],
      break_type: ["recurring", "one_time"],
      member_role: ["owner", "staff"],
      notification_channel: ["whatsapp", "sms", "email", "system"],
      notification_status: [
        "pending",
        "sent",
        "delivered",
        "read",
        "failed",
        "logged",
      ],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
      supported_language: ["he", "ar", "en"],
      waitlist_status: [
        "waiting",
        "notified",
        "claimed",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
