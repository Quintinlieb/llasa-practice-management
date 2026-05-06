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
      documents: {
        Row: {
          company_id: string
          created_at: string | null
          date_issued: string
          dates_committed: string
          description: string
          document_type: string | null
          employee_id: string | null
          employee_id_number: string
          employee_name: string
          employee_surname: string
          id: string
          issued_by: string
          misconduct: string
          trading_name: string | null
          updated_at: string | null
          validity_months: number
          warning_type: Database["public"]["Enums"]["warning_type"]
        }
        Insert: {
          company_id: string
          created_at?: string | null
          date_issued: string
          dates_committed: string
          description: string
          document_type?: string | null
          employee_id?: string | null
          employee_id_number: string
          employee_name: string
          employee_surname: string
          id?: string
          issued_by: string
          misconduct: string
          trading_name?: string | null
          updated_at?: string | null
          validity_months: number
          warning_type: Database["public"]["Enums"]["warning_type"]
        }
        Update: {
          company_id?: string
          created_at?: string | null
          date_issued?: string
          dates_committed?: string
          description?: string
          document_type?: string | null
          employee_id?: string | null
          employee_id_number?: string
          employee_name?: string
          employee_surname?: string
          id?: string
          issued_by?: string
          misconduct?: string
          trading_name?: string | null
          updated_at?: string | null
          validity_months?: number
          warning_type?: Database["public"]["Enums"]["warning_type"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string
          created_at: string | null
          citizenship_status: string | null
          date_of_birth: string | null
          disability_status: boolean | null
          employee_name: string
          employee_surname: string
          id: string
          id_number: string
          income_tax_number: string | null
          uif_number: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          citizenship_status?: string | null
          date_of_birth?: string | null
          disability_status?: boolean | null
          employee_name: string
          employee_surname: string
          id?: string
          id_number: string
          income_tax_number?: string | null
          uif_number?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          citizenship_status?: string | null
          date_of_birth?: string | null
          disability_status?: boolean | null
          employee_name?: string
          employee_surname?: string
          id?: string
          id_number?: string
          income_tax_number?: string | null
          uif_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          cell_number: string | null
          client_name: string
          client_number: string | null
          client_surname: string
          company_id: string
          created_at: string | null
          ee_billing_cycle: string | null
          email: string | null
          gender: string | null
          hs_billing_cycle: string | null
          id: string
          id_number: string | null
          lr_billing_cycle: string | null
          pr_billing_cycle: string | null
          race: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cell_number?: string | null
          client_name: string
          client_number?: string | null
          client_surname: string
          company_id: string
          created_at?: string | null
          ee_billing_cycle?: string | null
          email?: string | null
          gender?: string | null
          hs_billing_cycle?: string | null
          id?: string
          id_number?: string | null
          lr_billing_cycle?: string | null
          pr_billing_cycle?: string | null
          race?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cell_number?: string | null
          client_name?: string
          client_number?: string | null
          client_surname?: string
          company_id?: string
          created_at?: string | null
          ee_billing_cycle?: string | null
          email?: string | null
          gender?: string | null
          hs_billing_cycle?: string | null
          id?: string
          id_number?: string | null
          lr_billing_cycle?: string | null
          pr_billing_cycle?: string | null
          race?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          branches: string[]
          branches_enabled: boolean
          company_contact: string
          company_email: string
          company_name: string
          company_type: string
          created_at: string | null
          domestic_contact: string | null
          domestic_email: string | null
          domestic_id_number: string | null
          domestic_name: string | null
          domestic_surname: string | null
          id: string
          physical_address: string
          postal_address: string
          registration_number: string
          representative_name: string
          representative_surname: string
          updated_at: string | null
          user_contact: string
          user_email: string
          user_name: string
          user_surname: string
          vat_number: string | null
        }
        Insert: {
          account_type: string
          branches?: string[]
          branches_enabled?: boolean
          company_contact: string
          company_email: string
          company_name: string
          company_type: string
          created_at?: string | null
          domestic_contact?: string | null
          domestic_email?: string | null
          domestic_id_number?: string | null
          domestic_name?: string | null
          domestic_surname?: string | null
          id: string
          physical_address: string
          postal_address: string
          registration_number: string
          representative_name: string
          representative_surname: string
          updated_at?: string | null
          user_contact: string
          user_email: string
          user_name: string
          user_surname: string
          vat_number?: string | null
        }
        Update: {
          account_type?: string
          branches?: string[]
          branches_enabled?: boolean
          company_contact?: string
          company_email?: string
          company_name?: string
          company_type?: string
          created_at?: string | null
          domestic_contact?: string | null
          domestic_email?: string | null
          domestic_id_number?: string | null
          domestic_name?: string | null
          domestic_surname?: string | null
          id?: string
          physical_address?: string
          postal_address?: string
          registration_number?: string
          representative_name?: string
          representative_surname?: string
          updated_at?: string | null
          user_contact?: string
          user_email?: string
          user_name?: string
          user_surname?: string
          vat_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      warning_type: "first" | "second" | "serious" | "final"
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
      warning_type: ["first", "second", "serious", "final"],
    },
  },
} as const
