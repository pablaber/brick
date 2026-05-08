export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
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
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
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
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          started_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          activities_fetched?: number | null;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          started_at?: string;
          status: string;
          user_id: string;
        };
        Update: {
          activities_fetched?: number | null;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          started_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      monthly_distance_by_sport: {
        Row: {
          activity_count: number | null;
          month_start: string | null;
          sport_type: string | null;
          total_distance_meters: number | null;
          total_distance_miles: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      weekly_activity_minutes: {
        Row: {
          activity_count: number | null;
          sport_type: string | null;
          total_moving_minutes: number | null;
          user_id: string | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      weekly_sport_breakdown: {
        Row: {
          activity_count: number | null;
          sport_type: string | null;
          total_distance_meters: number | null;
          total_moving_minutes: number | null;
          total_moving_seconds: number | null;
          user_id: string | null;
          week_start: string | null;
        };
        Relationships: [];
      };
      yearly_running_distance: {
        Row: {
          activity_count: number | null;
          total_distance_meters: number | null;
          total_distance_miles: number | null;
          user_id: string | null;
          year_start: string | null;
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
  graphql_public: {
    Enums: {}
  },
  public: {
    Enums: {}
  }
} as const;
