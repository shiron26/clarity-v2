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
      birthday: {
        Row: {
          created_at: string | null
          day: number | null
          first_name: string | null
          id: string | null
          month: number | null
          name: string | null
          phone: string | null
          source: string | null
          updated_at: string | null
          year: number | null
        }
        Relationships: []
      }
      calendar_event: {
        Row: {
          all_day: boolean | null
          calendar: string | null
          ends_at: string | null
          id: string | null
          location: string | null
          starts_at: string | null
          title: string | null
        }
        Relationships: []
      }
      digest_settings: {
        Row: {
          birthday_message_template: string | null
          enabled: boolean | null
          last_ingest_at: string | null
          last_sent_on: string | null
          last_viewed_on: string | null
          send_time: string | null
        }
        Relationships: []
      }
      email: {
        Row: {
          from_email: string | null
          from_name: string | null
          id: string | null
          is_important: boolean | null
          received_at: string | null
          subject: string | null
          url: string | null
        }
        Relationships: []
      }
      ingest_token: {
        Row: {
          created_at: string | null
          id: string | null
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
        }
        Relationships: []
      }
      list: {
        Row: {
          color: string | null
          created_at: string | null
          id: string | null
          kind: string | null
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
          start_value: number | null
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
      push_subscription: {
        Row: {
          created_at: string | null
          id: string | null
          last_success_at: string | null
          user_agent: string | null
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
      birthday_rows: {
        Args: never
        Returns: {
          created_at: string
          day: number
          first_name: string
          id: string
          month: number
          name: string
          phone: string
          source: string
          updated_at: string
          year: number
        }[]
      }
      calendar_event_rows: {
        Args: never
        Returns: {
          all_day: boolean
          calendar: string
          ends_at: string
          id: string
          location: string
          starts_at: string
          title: string
        }[]
      }
      claim_due_digests: {
        Args: never
        Returns: {
          subscriptions: Json
          summary: Json
          user_id: string
        }[]
      }
      create_ingest_token: { Args: { p_label: string }; Returns: string }
      delete_account: { Args: never; Returns: undefined }
      digest_preview: {
        Args: { p_user_id: string }
        Returns: {
          subscriptions: Json
          summary: Json
        }[]
      }
      digest_settings_rows: {
        Args: never
        Returns: {
          birthday_message_template: string
          enabled: boolean
          last_ingest_at: string
          last_sent_on: string
          last_viewed_on: string
          send_time: string
        }[]
      }
      digest_summary: {
        Args: { p_date?: string; p_user_id: string }
        Returns: Json
      }
      email_rows: {
        Args: never
        Returns: {
          from_email: string
          from_name: string
          id: string
          is_important: boolean
          received_at: string
          subject: string
          url: string
        }[]
      }
      get_my_day: { Args: { p_date?: string }; Returns: Json }
      ingest_daily_snapshot: {
        Args: { p_payload: Json; p_token: string }
        Returns: Json
      }
      ingest_token_rows: {
        Args: never
        Returns: {
          created_at: string
          id: string
          label: string
          last_used_at: string
          revoked_at: string
        }[]
      }
      is_objective_visible: { Args: { p_objective: string }; Returns: boolean }
      is_space_member: { Args: { p_space: string }; Returns: boolean }
      list_rows: {
        Args: never
        Returns: {
          color: string
          created_at: string
          id: string
          kind: string
          name: string
          position: number
          space_id: string
          user_id: string
        }[]
      }
      mark_my_day_viewed: { Args: never; Returns: undefined }
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
          start_value: number
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
      push_subscription_rows: {
        Args: never
        Returns: {
          created_at: string
          id: string
          last_success_at: string
          user_agent: string
        }[]
      }
      push_subscriptions_gone: { Args: { p_ids: string[] }; Returns: undefined }
      push_subscriptions_ok: { Args: { p_ids: string[] }; Returns: undefined }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      remove_push_subscription: { Args: { p_id: string }; Returns: undefined }
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
      revoke_ingest_token: { Args: { p_id: string }; Returns: undefined }
      skip_task_occurrence: { Args: { p_task: string }; Returns: string }
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
      unregister_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      update_digest_settings: {
        Args: {
          p_birthday_message_template?: string
          p_enabled?: boolean
          p_send_time?: string
        }
        Returns: undefined
      }
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

