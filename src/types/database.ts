export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      objective_entry: {
        Row: {
          created_at: string
          created_by: string
          entry_date: string
          id: string
          objective_id: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          entry_date?: string
          id?: string
          objective_id: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string
          entry_date?: string
          id?: string
          objective_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "objective_entry_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      objective_period: {
        Row: {
          done: number
          objective_id: string
          period_index: number
          period_unit: string
          period_year: number
          target: number
        }
        Insert: {
          done?: number
          objective_id: string
          period_index: number
          period_unit: string
          period_year: number
          target: number
        }
        Update: {
          done?: number
          objective_id?: string
          period_index?: number
          period_unit?: string
          period_year?: number
          target?: number
        }
        Relationships: []
      }
      objective_session: {
        Row: {
          created_at: string
          created_by: string
          day: string
          id: string
          objective_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          day: string
          id?: string
          objective_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day?: string
          id?: string
          objective_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_session_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          deleted_at: string | null
          display_name: string
          id: string
          last_seen_on: string | null
          onboarded_at: string | null
        }
        Insert: {
          deleted_at?: string | null
          display_name?: string
          id: string
          last_seen_on?: string | null
          onboarded_at?: string | null
        }
        Update: {
          deleted_at?: string | null
          display_name?: string
          id?: string
          last_seen_on?: string | null
          onboarded_at?: string | null
        }
        Relationships: []
      }
      review: {
        Row: {
          created_at: string
          created_by: string
          current_objective_id: string | null
          id: string
          period_index: number | null
          period_type: string
          period_year: number
          space_id: string | null
          user_id: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          current_objective_id?: string | null
          id?: string
          period_index?: number | null
          period_type: string
          period_year: number
          space_id?: string | null
          user_id?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          current_objective_id?: string | null
          id?: string
          period_index?: number | null
          period_type?: string
          period_year?: number
          space_id?: string | null
          user_id?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      space_invitation: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          space_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          id?: string
          space_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          space_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_invitation_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_invitation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      space_member: {
        Row: {
          joined_at: string
          left_at: string | null
          space_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          left_at?: string | null
          space_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          left_at?: string | null
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_member_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      list: {
        Row: {
          color: string | null
          created_at: string | null
          id: string | null
          name: string | null
          position: number | null
          space_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      milestone: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string | null
          objective_id: string | null
          position: number | null
          quarter: number | null
          title: string | null
          year: number | null
        }
        Relationships: []
      }
      objective: {
        Row: {
          cadence: number | null
          closed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          direction: string | null
          entry_mode: string | null
          id: string | null
          kind: string | null
          label: string | null
          measure: string | null
          parent_objective_id: string | null
          period_unit: string | null
          quarter: number | null
          slot: number | null
          space_id: string | null
          target_value: number | null
          title: string | null
          unit: string | null
          user_id: string | null
          why: string | null
          window_range: unknown
          year: number | null
        }
        Relationships: []
      }
      review_item: {
        Row: {
          achieved: boolean | null
          comment: string | null
          created_at: string | null
          id: string | null
          objective_id: string | null
          rating: number | null
          review_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      space: {
        Row: {
          color: string | null
          created_at: string | null
          id: string | null
          name: string | null
        }
        Relationships: []
      }
      task: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string | null
          is_important: boolean | null
          list_id: string | null
          objective_id: string | null
          position: number | null
          recurrence: Json | null
          space_id: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_day_start: { Args: never; Returns: string }
      app_today: { Args: never; Returns: string }
      delete_account: { Args: never; Returns: undefined }
      is_objective_visible: { Args: { p_objective: string }; Returns: boolean }
      is_space_member: { Args: { p_space: string }; Returns: boolean }
      list_rows: {
        Args: never
        Returns: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          space_id: string
          user_id: string
        }[]
      }
      milestone_rows: {
        Args: never
        Returns: {
          completed_at: string
          completed_by: string
          created_at: string
          id: string
          objective_id: string
          position: number
          quarter: number
          title: string
          year: number
        }[]
      }
      objective_active_days: {
        Args: { p_from: string; p_objectives: string[]; p_to: string }
        Returns: {
          day: string
          objective_id: string
        }[]
      }
      objective_progress: {
        Args: { p_objectives: string[] }
        Returns: {
          entries: number
          last_entry_date: string
          objective_id: string
          value: number
        }[]
      }
      objective_regularity: {
        Args: { p_objectives: string[] }
        Returns: {
          done: number
          done_projected: number
          objective_id: string
          target: number
          target_projected: number
        }[]
      }
      objective_rows: {
        Args: never
        Returns: {
          cadence: number
          closed_at: string
          created_at: string
          created_by: string
          description: string
          direction: string
          entry_mode: string
          id: string
          kind: string
          label: string
          measure: string
          parent_objective_id: string
          period_unit: string
          quarter: number
          slot: number
          space_id: string
          target_value: number
          title: string
          unit: string
          user_id: string
          why: string
          window_range: unknown
          year: number
        }[]
      }
      postpone_overdue_tasks: { Args: never; Returns: number }
      review_item_rows: {
        Args: never
        Returns: {
          achieved: boolean
          comment: string
          created_at: string
          id: string
          objective_id: string
          rating: number
          review_id: string
          updated_at: string
        }[]
      }
      review_openings: {
        Args: { p_years: number[] }
        Returns: {
          is_open: boolean
          open_at: string
          period_index: number
          period_type: string
          period_year: number
        }[]
      }
      space_objective_weekly_state: {
        Args: { p_iso_week: number; p_iso_year: number; p_objective: string }
        Returns: string
      }
      space_rows: {
        Args: never
        Returns: {
          color: string
          created_at: string
          id: string
          name: string
        }[]
      }
      task_rows: {
        Args: never
        Returns: {
          assignee_id: string
          completed_at: string
          completed_by: string
          created_at: string
          description: string
          due_date: string
          id: string
          is_important: boolean
          list_id: string
          objective_id: string
          position: number
          recurrence: Json
          space_id: string
          title: string
          user_id: string
        }[]
      }
      touch_last_seen: { Args: never; Returns: string }
      undate_overdue_tasks: { Args: never; Returns: number }
      week_task_count: {
        Args: { p_from: string; p_to: string }
        Returns: {
          linked: number
          total: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

