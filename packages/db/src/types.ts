export interface Database {
  public: {
    Tables: {
      plans: {
        Row: {
          id: string;
          name: string;
          monthly_price: number;
          yearly_price: number;
          max_staff: number;
          max_appointments_monthly: number;
          features: Record<string, unknown> | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          monthly_price?: number;
          yearly_price?: number;
          max_staff?: number;
          max_appointments_monthly?: number;
          features?: Record<string, unknown> | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          monthly_price?: number;
          yearly_price?: number;
          max_staff?: number;
          max_appointments_monthly?: number;
          features?: Record<string, unknown> | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          logo_url: string | null;
          cover_url: string | null;
          category: string;
          phone: string;
          email: string;
          address: string | null;
          social_links: Record<string, unknown> | null;
          default_language: string;
          is_active: boolean;
          bot_context: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          logo_url?: string | null;
          cover_url?: string | null;
          category: string;
          phone: string;
          email: string;
          address?: string | null;
          social_links?: Record<string, unknown> | null;
          default_language?: string;
          is_active?: boolean;
          bot_context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          logo_url?: string | null;
          cover_url?: string | null;
          category?: string;
          phone?: string;
          email?: string;
          address?: string | null;
          social_links?: Record<string, unknown> | null;
          default_language?: string;
          is_active?: boolean;
          bot_context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name_he: string;
          name_ar: string | null;
          name_en: string | null;
          description_he: string | null;
          description_ar: string | null;
          description_en: string | null;
          duration_minutes: number;
          buffer_minutes: number;
          price: number;
          price_type: string;
          max_capacity: number;
          is_active: boolean;
          sort_order: number;
          category_id: string | null;
          reminder_confirmation: boolean;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name_he: string;
          name_ar?: string | null;
          name_en?: string | null;
          description_he?: string | null;
          description_ar?: string | null;
          description_en?: string | null;
          duration_minutes?: number;
          buffer_minutes?: number;
          price?: number;
          price_type?: string;
          max_capacity?: number;
          is_active?: boolean;
          sort_order?: number;
          category_id?: string | null;
          reminder_confirmation?: boolean;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name_he?: string;
          name_ar?: string | null;
          name_en?: string | null;
          description_he?: string | null;
          description_ar?: string | null;
          description_en?: string | null;
          duration_minutes?: number;
          buffer_minutes?: number;
          price?: number;
          price_type?: string;
          max_capacity?: number;
          is_active?: boolean;
          sort_order?: number;
          category_id?: string | null;
          reminder_confirmation?: boolean;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      working_hours: {
        Row: {
          id: string;
          business_id: string;
          staff_id: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_closed: boolean;
        };
        Insert: {
          id?: string;
          business_id: string;
          staff_id?: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_closed?: boolean;
        };
        Update: {
          id?: string;
          business_id?: string;
          staff_id?: string | null;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          is_closed?: boolean;
        };
        Relationships: [];
      };
      breaks: {
        Row: {
          id: string;
          business_id: string;
          staff_id: string | null;
          type: string;
          day_of_week: number | null;
          specific_date: string | null;
          start_time: string;
          end_time: string;
          label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          staff_id?: string | null;
          type: string;
          day_of_week?: number | null;
          specific_date?: string | null;
          start_time: string;
          end_time: string;
          label?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          staff_id?: string | null;
          type?: string;
          day_of_week?: number | null;
          specific_date?: string | null;
          start_time?: string;
          end_time?: string;
          label?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          phone: string;
          name: string;
          language_preference: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          name: string;
          language_preference?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          name?: string;
          language_preference?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          business_id: string;
          service_id: string;
          customer_id: string;
          staff_id: string | null;
          start_time: string;
          end_time: string;
          status: string;
          notes: string | null;
          created_via: string;
          google_event_id: string | null;
          customer_confirmed: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          service_id: string;
          customer_id: string;
          staff_id?: string | null;
          start_time: string;
          end_time: string;
          status?: string;
          notes?: string | null;
          created_via?: string;
          google_event_id?: string | null;
          customer_confirmed?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          service_id?: string;
          customer_id?: string;
          staff_id?: string | null;
          start_time?: string;
          end_time?: string;
          status?: string;
          notes?: string | null;
          created_via?: string;
          google_event_id?: string | null;
          customer_confirmed?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist: {
        Row: {
          id: string;
          business_id: string;
          service_id: string;
          customer_id: string;
          requested_date: string;
          requested_time: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          service_id: string;
          customer_id: string;
          requested_date: string;
          requested_time: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          service_id?: string;
          customer_id?: string;
          requested_date?: string;
          requested_time?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          business_id: string;
          plan_id: string;
          status: string;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          payplus_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          plan_id: string;
          status?: string;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          payplus_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          plan_id?: string;
          status?: string;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          payplus_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications_log: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string | null;
          appointment_id: string | null;
          type: string;
          channel: string;
          template_id: string | null;
          status: string;
          message_content: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          read_at: string | null;
          error: string | null;
          whatsapp_message_id: string | null;
          customer_response: string | null;
          responded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id?: string | null;
          appointment_id?: string | null;
          type: string;
          channel?: string;
          template_id?: string | null;
          status?: string;
          message_content?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          error?: string | null;
          whatsapp_message_id?: string | null;
          customer_response?: string | null;
          responded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string | null;
          appointment_id?: string | null;
          type?: string;
          channel?: string;
          template_id?: string | null;
          status?: string;
          message_content?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          error?: string | null;
          whatsapp_message_id?: string | null;
          customer_response?: string | null;
          responded_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      booking_rules: {
        Row: {
          id: string;
          business_id: string;
          min_advance_minutes: number;
          max_future_days: number;
          cancellation_window_minutes: number;
          reschedule_window_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          min_advance_minutes?: number;
          max_future_days?: number;
          cancellation_window_minutes?: number;
          reschedule_window_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          min_advance_minutes?: number;
          max_future_days?: number;
          cancellation_window_minutes?: number;
          reschedule_window_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reminder_settings: {
        Row: {
          id: string;
          business_id: string;
          minutes_before: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          minutes_before: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          minutes_before?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      google_calendar_tokens: {
        Row: {
          id: string;
          business_id: string;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          google_calendar_id: string | null;
          sync_enabled: boolean;
          push_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          google_calendar_id?: string | null;
          sync_enabled?: boolean;
          push_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          access_token?: string;
          refresh_token?: string;
          token_expires_at?: string;
          google_calendar_id?: string | null;
          sync_enabled?: boolean;
          push_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_calendar_events: {
        Row: {
          id: string;
          business_id: string;
          google_event_id: string;
          summary: string | null;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          google_event_id: string;
          summary?: string | null;
          start_time: string;
          end_time: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          google_event_id?: string;
          summary?: string | null;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      service_categories: {
        Row: {
          id: string;
          business_id: string;
          name_he: string;
          name_ar: string | null;
          name_en: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name_he: string;
          name_ar?: string | null;
          name_en?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name_he?: string;
          name_ar?: string | null;
          name_en?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_services: {
        Row: {
          id: string;
          staff_id: string;
          service_id: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          service_id: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          service_id?: string;
        };
        Relationships: [];
      };
      appointment_reminders_sent: {
        Row: {
          appointment_id: string;
          template_id: string;
          claimed_at: string;
        };
        Insert: {
          appointment_id: string;
          template_id: string;
          claimed_at?: string;
        };
        Update: {
          appointment_id?: string;
          template_id?: string;
          claimed_at?: string;
        };
        Relationships: [];
      };
      whatsapp_credentials: {
        Row: {
          id: string;
          business_id: string;
          phone_number_id: string;
          access_token: string;
          app_secret: string | null;
          verify_token: string | null;
          display_phone: string | null;
          verified_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          phone_number_id: string;
          access_token: string;
          app_secret?: string | null;
          verify_token?: string | null;
          display_phone?: string | null;
          verified_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          phone_number_id?: string;
          access_token?: string;
          app_secret?: string | null;
          verify_token?: string | null;
          display_phone?: string | null;
          verified_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;
export type TableRow<T extends TableName> = Tables[T]["Row"];
export type TableInsert<T extends TableName> = Tables[T]["Insert"];
export type TableUpdate<T extends TableName> = Tables[T]["Update"];
