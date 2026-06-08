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
  public: {
    Tables: {
      consigup_sessions: {
        Row: {
          cookies: Json
          created_at: string
          last_used_at: string
          orgaos: Json
          slot: number
          user_id: string
        }
        Insert: {
          cookies?: Json
          created_at?: string
          last_used_at?: string
          orgaos?: Json
          slot: number
          user_id: string
        }
        Update: {
          cookies?: Json
          created_at?: string
          last_used_at?: string
          orgaos?: Json
          slot?: number
          user_id?: string
        }
        Relationships: []
      }
      consultas_margem: {
        Row: {
          categoria: string | null
          cpf: string
          created_at: string
          erro: string | null
          erro_tipo: string | null
          id: string
          margem_cartao_beneficio: number | null
          margem_cartao_credito: number | null
          margem_disponivel: number | null
          margem_emprestimo: number | null
          matricula: string | null
          nome: string
          orgao: string | null
          processed_at: string | null
          servidor_nome: string | null
          situacao: string | null
          status: Database["public"]["Enums"]["consulta_status"]
          tentativas: number
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          cpf: string
          created_at?: string
          erro?: string | null
          erro_tipo?: string | null
          id?: string
          margem_cartao_beneficio?: number | null
          margem_cartao_credito?: number | null
          margem_disponivel?: number | null
          margem_emprestimo?: number | null
          matricula?: string | null
          nome: string
          orgao?: string | null
          processed_at?: string | null
          servidor_nome?: string | null
          situacao?: string | null
          status?: Database["public"]["Enums"]["consulta_status"]
          tentativas?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          cpf?: string
          created_at?: string
          erro?: string | null
          erro_tipo?: string | null
          id?: string
          margem_cartao_beneficio?: number | null
          margem_cartao_credito?: number | null
          margem_disponivel?: number | null
          margem_emprestimo?: number | null
          matricula?: string | null
          nome?: string
          orgao?: string | null
          processed_at?: string | null
          servidor_nome?: string | null
          situacao?: string | null
          status?: Database["public"]["Enums"]["consulta_status"]
          tentativas?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pesquisas: {
        Row: {
          created_at: string
          finalidade: string | null
          id: string
          resultado_json: Json | null
          termo_busca: string
          tipo_busca: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finalidade?: string | null
          id?: string
          resultado_json?: Json | null
          termo_busca: string
          tipo_busca: string
          user_id: string
        }
        Update: {
          created_at?: string
          finalidade?: string | null
          id?: string
          resultado_json?: Json | null
          termo_busca?: string
          tipo_busca?: string
          user_id?: string
        }
        Relationships: []
      }
      pesquisas_nv: {
        Row: {
          celular: string | null
          created_at: string
          data_nascimento: string | null
          documento: string
          email: string | null
          finalidade: string | null
          id: string
          nome: string | null
          resultado: Json | null
          tipo: string
          user_id: string
        }
        Insert: {
          celular?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento: string
          email?: string | null
          finalidade?: string | null
          id?: string
          nome?: string | null
          resultado?: Json | null
          tipo?: string
          user_id: string
        }
        Update: {
          celular?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento?: string
          email?: string | null
          finalidade?: string | null
          id?: string
          nome?: string | null
          resultado?: Json | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      processar_logs: {
        Row: {
          consulta_id: string
          created_at: string
          id: number
          level: string
          message: string
          user_id: string
        }
        Insert: {
          consulta_id: string
          created_at?: string
          id?: number
          level?: string
          message: string
          user_id: string
        }
        Update: {
          consulta_id?: string
          created_at?: string
          id?: number
          level?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processar_logs_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas_margem"
            referencedColumns: ["id"]
          },
        ]
      }
      processar_runs: {
        Row: {
          created_at: string
          errors: number
          finished_at: string | null
          id: string
          processed: number
          started_at: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          errors?: number
          finished_at?: string | null
          id?: string
          processed?: number
          started_at?: string
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          errors?: number
          finished_at?: string | null
          id?: string
          processed?: number
          started_at?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rh_benefits: {
        Row: {
          activated_at: string | null
          active: boolean
          created_at: string
          employee_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          active?: boolean
          created_at?: string
          employee_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          active?: boolean
          created_at?: string
          employee_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "rh_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_employees: {
        Row: {
          created_at: string
          department: string | null
          full_name: string
          id: string
          job_title: string | null
          salary: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          full_name: string
          id?: string
          job_title?: string | null
          salary?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          salary?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rh_kpi_metrics: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          kpi: string
          ref_month: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          kpi: string
          ref_month: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          kpi?: string
          ref_month?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_kpi_metrics_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "rh_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      rh_tab_access: {
        Row: {
          created_at: string
          id: string
          tab_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tab_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tab_key?: string
          user_id?: string
        }
        Relationships: []
      }
      rh_vacation_requests: {
        Row: {
          created_at: string
          dias: number
          employee_id: string
          fim: string
          id: string
          inicio: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias?: number
          employee_id: string
          fim: string
          id?: string
          inicio: string
          status: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias?: number
          employee_id?: string
          fim?: string
          id?: string
          inicio?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_vacation_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "rh_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      safeconsig_leads: {
        Row: {
          consultado_em: string
          consultado_por: string
          cpf: string
          id: string
          mensagem: string | null
          status: string
        }
        Insert: {
          consultado_em?: string
          consultado_por: string
          cpf: string
          id?: string
          mensagem?: string | null
          status: string
        }
        Update: {
          consultado_em?: string
          consultado_por?: string
          cpf?: string
          id?: string
          mensagem?: string | null
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_accounts: {
        Row: {
          access_token: string
          active: boolean
          business_account_id: string | null
          created_at: string
          display_phone: string | null
          id: string
          name: string
          phone_number_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          active?: boolean
          business_account_id?: string | null
          created_at?: string
          display_phone?: string | null
          id?: string
          name: string
          phone_number_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          active?: boolean
          business_account_id?: string | null
          created_at?: string
          display_phone?: string | null
          id?: string
          name?: string
          phone_number_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      wa_contacts: {
        Row: {
          account_id: string
          created_at: string
          id: string
          last_message_at: string | null
          name: string | null
          unread_count: number
          updated_at: string
          wa_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          name?: string | null
          unread_count?: number
          updated_at?: string
          wa_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          name?: string | null
          unread_count?: number
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          account_id: string
          body: string | null
          contact_id: string
          created_at: string
          direction: string
          id: string
          sender_name: string | null
          status: string
          wa_message_id: string | null
        }
        Insert: {
          account_id: string
          body?: string | null
          contact_id: string
          created_at?: string
          direction: string
          id?: string
          sender_name?: string | null
          status?: string
          wa_message_id?: string | null
        }
        Update: {
          account_id?: string
          body?: string | null
          contact_id?: string
          created_at?: string
          direction?: string
          id?: string
          sender_name?: string | null
          status?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_run_counters: {
        Args: { _errors_inc: number; _processed_inc: number; _run_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      consulta_status: "pendente" | "processando" | "concluido" | "erro"
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
      app_role: ["admin", "user"],
      consulta_status: ["pendente", "processando", "concluido", "erro"],
    },
  },
} as const
