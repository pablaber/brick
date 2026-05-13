export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          average_heartrate: number | null;
          average_speed_mps: number | null;
          created_at: string;
          distance_meters: number | null;
          elapsed_time_seconds: number | null;
          id: string;
          max_heartrate: number | null;
          max_speed_mps: number | null;
          moving_time_seconds: number | null;
          name: string | null;
          raw_json: Json | null;
          sport_type: string | null;
          start_date: string | null;
          strava_activity_id: number;
          total_elevation_gain_meters: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          average_heartrate?: number | null;
          average_speed_mps?: number | null;
          created_at?: string;
          distance_meters?: number | null;
          elapsed_time_seconds?: number | null;
          id?: string;
          max_heartrate?: number | null;
          max_speed_mps?: number | null;
          moving_time_seconds?: number | null;
          name?: string | null;
          raw_json?: Json | null;
          sport_type?: string | null;
          start_date?: string | null;
          strava_activity_id: number;
          total_elevation_gain_meters?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          average_heartrate?: number | null;
          average_speed_mps?: number | null;
          created_at?: string;
          distance_meters?: number | null;
          elapsed_time_seconds?: number | null;
          id?: string;
          max_heartrate?: number | null;
          max_speed_mps?: number | null;
          moving_time_seconds?: number | null;
          name?: string | null;
          raw_json?: Json | null;
          sport_type?: string | null;
          start_date?: string | null;
          strava_activity_id?: number;
          total_elevation_gain_meters?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      oauth_states: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          provider: string;
          redirect_to: string | null;
          state: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          provider: string;
          redirect_to?: string | null;
          state: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          provider?: string;
          redirect_to?: string | null;
          state?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      allowed_emails: {
        Row: {
          id: string;
          email: string;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'allowed_emails_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          is_admin: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_admin?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_admin?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      strava_connections: {
        Row: {
          access_token: string;
          created_at: string;
          expires_at: string;
          last_synced_at: string | null;
          refresh_token: string;
          scope: string | null;
          strava_athlete_id: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token: string;
          created_at?: string;
          expires_at: string;
          last_synced_at?: string | null;
          refresh_token: string;
          scope?: string | null;
          strava_athlete_id: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string;
          created_at?: string;
          expires_at?: string;
          last_synced_at?: string | null;
          refresh_token?: string;
          scope?: string | null;
          strava_athlete_id?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sync_runs: {
        Row: {
          activities_fetched: number | null;
          activities_upserted: number | null;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          started_at: string;
          status: string;
          sync_type: string;
          user_id: string;
        };
        Insert: {
          activities_fetched?: number | null;
          activities_upserted?: number | null;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          started_at?: string;
          status: string;
          sync_type?: string;
          user_id: string;
        };
        Update: {
          activities_fetched?: number | null;
          activities_upserted?: number | null;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          started_at?: string;
          status?: string;
          sync_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_dashboard_preferences: {
        Row: {
          created_at: string;
          preferences: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          preferences?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          preferences?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_goals: {
        Row: {
          created_at: string;
          ends_on: string | null;
          goal_type: string;
          id: string;
          is_active: boolean;
          period: string;
          sport_category: string | null;
          starts_on: string | null;
          target_value: number;
          unit: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          ends_on?: string | null;
          goal_type: string;
          id?: string;
          is_active?: boolean;
          period: string;
          sport_category?: string | null;
          starts_on?: string | null;
          target_value: number;
          unit: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string | null;
          goal_type?: string;
          id?: string;
          is_active?: boolean;
          period?: string;
          sport_category?: string | null;
          starts_on?: string | null;
          target_value?: number;
          unit?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_sport_category_settings: {
        Row: {
          category: string;
          color_hex: string;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category: string;
          color_hex: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          color_hex?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      monthly_activity_breakdown: {
        Row: {
          activity_count: number | null;
          sport_type: string | null;
          total_distance_meters: number | null;
          total_distance_miles: number | null;
          total_moving_minutes: number | null;
          total_moving_seconds: number | null;
          user_id: string | null;
          period_start: string | null;
        };
        Relationships: [];
      };
      weekly_activity_breakdown: {
        Row: {
          activity_count: number | null;
          period_start: string | null;
          sport_type: string | null;
          total_distance_meters: number | null;
          total_distance_miles: number | null;
          total_moving_minutes: number | null;
          total_moving_seconds: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      yearly_activity_breakdown: {
        Row: {
          activity_count: number | null;
          period_start: string | null;
          sport_type: string | null;
          total_distance_meters: number | null;
          total_distance_miles: number | null;
          total_moving_minutes: number | null;
          total_moving_seconds: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {}
  }
} as const;
