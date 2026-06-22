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
      do_arquivos: {
        Row: {
          caminho_arquivo: string | null
          created_at: string
          data_publicacao: string | null
          data_upload: string
          id: string
          nome_arquivo: string
          numero_edicao: string | null
          orgao_detectado: string | null
          status_processamento: string
          texto_extraido: string | null
          tipo_arquivo: string
          total_aprovados: number
          total_erros: number
          total_registros_extraidos: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          caminho_arquivo?: string | null
          created_at?: string
          data_publicacao?: string | null
          data_upload?: string
          id?: string
          nome_arquivo: string
          numero_edicao?: string | null
          orgao_detectado?: string | null
          status_processamento?: string
          texto_extraido?: string | null
          tipo_arquivo: string
          total_aprovados?: number
          total_erros?: number
          total_registros_extraidos?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          caminho_arquivo?: string | null
          created_at?: string
          data_publicacao?: string | null
          data_upload?: string
          id?: string
          nome_arquivo?: string
          numero_edicao?: string | null
          orgao_detectado?: string | null
          status_processamento?: string
          texto_extraido?: string | null
          tipo_arquivo?: string
          total_aprovados?: number
          total_erros?: number
          total_registros_extraidos?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      do_registros: {
        Row: {
          arquivo_id: string
          cargo: string | null
          categoria: string | null
          classe_anterior: string | null
          classe_nova: string | null
          confianca_ia: string | null
          cpf_parcial: string | null
          created_at: string
          data_ato: string | null
          data_publicacao: string | null
          duplicado_possivel: boolean
          id: string
          matricula: string | null
          nivel_anterior: string | null
          nivel_novo: string | null
          nome_servidor: string
          numero_ato: string | null
          orgao: string | null
          pagina: string | null
          referencia_anterior: string | null
          referencia_nova: string | null
          status_revisao: string
          tipo_movimentacao: string | null
          trecho_original: string | null
          updated_at: string
        }
        Insert: {
          arquivo_id: string
          cargo?: string | null
          categoria?: string | null
          classe_anterior?: string | null
          classe_nova?: string | null
          confianca_ia?: string | null
          cpf_parcial?: string | null
          created_at?: string
          data_ato?: string | null
          data_publicacao?: string | null
          duplicado_possivel?: boolean
          id?: string
          matricula?: string | null
          nivel_anterior?: string | null
          nivel_novo?: string | null
          nome_servidor: string
          numero_ato?: string | null
          orgao?: string | null
          pagina?: string | null
          referencia_anterior?: string | null
          referencia_nova?: string | null
          status_revisao?: string
          tipo_movimentacao?: string | null
          trecho_original?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_id?: string
          cargo?: string | null
          categoria?: string | null
          classe_anterior?: string | null
          classe_nova?: string | null
          confianca_ia?: string | null
          cpf_parcial?: string | null
          created_at?: string
          data_ato?: string | null
          data_publicacao?: string | null
          duplicado_possivel?: boolean
          id?: string
          matricula?: string | null
          nivel_anterior?: string | null
          nivel_novo?: string | null
          nome_servidor?: string
          numero_ato?: string | null
          orgao?: string | null
          pagina?: string | null
          referencia_anterior?: string | null
          referencia_nova?: string | null
          status_revisao?: string
          tipo_movimentacao?: string | null
          trecho_original?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "do_registros_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "do_arquivos"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          body: string | null
          consultant_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["prospect_event_kind"]
          lead_id: string
          meta: Json | null
        }
        Insert: {
          body?: string | null
          consultant_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["prospect_event_kind"]
          lead_id: string
          meta?: Json | null
        }
        Update: {
          body?: string | null
          consultant_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["prospect_event_kind"]
          lead_id?: string
          meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospect_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          consultant_id: string | null
          created_at: string
          due_at: string
          id: string
          lead_id: string
          status: Database["public"]["Enums"]["prospect_task_status"]
          title: string
        }
        Insert: {
          consultant_id?: string | null
          created_at?: string
          due_at: string
          id?: string
          lead_id: string
          status?: Database["public"]["Enums"]["prospect_task_status"]
          title: string
        }
        Update: {
          consultant_id?: string | null
          created_at?: string
          due_at?: string
          id?: string
          lead_id?: string
          status?: Database["public"]["Enums"]["prospect_task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospect_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_approvals: {
        Row: {
          aceite_registrado_at: string | null
          audio_path: string | null
          banco: string | null
          cliente_aceite: boolean | null
          consultant_email: string | null
          consultant_id: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          duracao_segundos: number | null
          file_hash: string | null
          gravado_em: string | null
          id: string
          lead_id: string | null
          nome_completo: string
          resumo: string | null
          status: string
          tipo_operacao: string | null
          token: string
          transcricao: string | null
          updated_at: string
          valor_parcela: number | null
          valor_solicitado: number | null
          video_path: string | null
        }
        Insert: {
          aceite_registrado_at?: string | null
          audio_path?: string | null
          banco?: string | null
          cliente_aceite?: boolean | null
          consultant_email?: string | null
          consultant_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          duracao_segundos?: number | null
          file_hash?: string | null
          gravado_em?: string | null
          id?: string
          lead_id?: string | null
          nome_completo: string
          resumo?: string | null
          status?: string
          tipo_operacao?: string | null
          token: string
          transcricao?: string | null
          updated_at?: string
          valor_parcela?: number | null
          valor_solicitado?: number | null
          video_path?: string | null
        }
        Update: {
          aceite_registrado_at?: string | null
          audio_path?: string | null
          banco?: string | null
          cliente_aceite?: boolean | null
          consultant_email?: string | null
          consultant_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          duracao_segundos?: number | null
          file_hash?: string | null
          gravado_em?: string | null
          id?: string
          lead_id?: string | null
          nome_completo?: string
          resumo?: string | null
          status?: string
          tipo_operacao?: string | null
          token?: string
          transcricao?: string | null
          updated_at?: string
          valor_parcela?: number | null
          valor_solicitado?: number | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_approvals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospect_leads"
            referencedColumns: ["id"]
          },
        ]
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
      positiva_alertas: {
        Row: {
          created_at: string
          id: string
          mensagem: string
          meta: Json
          resolvido: boolean
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem: string
          meta?: Json
          resolvido?: boolean
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string
          meta?: Json
          resolvido?: boolean
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      positiva_atividades: {
        Row: {
          created_at: string
          id: string
          meta: Json
          quantidade: number
          ref_date: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          quantidade?: number
          ref_date?: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          quantidade?: number
          ref_date?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      positiva_checkins: {
        Row: {
          created_at: string
          energia: number | null
          id: string
          periodo: string
          ref_date: string
          respostas: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          energia?: number | null
          id?: string
          periodo: string
          ref_date?: string
          respostas?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          energia?: number | null
          id?: string
          periodo?: string
          ref_date?: string
          respostas?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      positiva_coach_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      positiva_humor: {
        Row: {
          created_at: string
          estado: string
          id: string
          ref_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estado: string
          id?: string
          ref_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          ref_date?: string
          user_id?: string
        }
        Relationships: []
      }
      positiva_missoes: {
        Row: {
          alvo: number
          chave: string
          concluida: boolean
          created_at: string
          id: string
          progresso: number
          ref_date: string
          titulo: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          alvo?: number
          chave: string
          concluida?: boolean
          created_at?: string
          id?: string
          progresso?: number
          ref_date?: string
          titulo: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          alvo?: number
          chave?: string
          concluida?: boolean
          created_at?: string
          id?: string
          progresso?: number
          ref_date?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      positiva_score: {
        Row: {
          created_at: string
          dimensoes: Json
          hunter_score: number
          id: string
          ref_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dimensoes?: Json
          hunter_score?: number
          id?: string
          ref_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dimensoes?: Json
          hunter_score?: number
          id?: string
          ref_date?: string
          updated_at?: string
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
      promovidos: {
        Row: {
          cargo: string
          cpf: string
          created_at: string
          created_by: string | null
          id: string
          mes_referencia: string
          nome: string
          updated_at: string
        }
        Insert: {
          cargo: string
          cpf: string
          created_at?: string
          created_by?: string | null
          id?: string
          mes_referencia: string
          nome: string
          updated_at?: string
        }
        Update: {
          cargo?: string
          cpf?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mes_referencia?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospect_leads: {
        Row: {
          cidade: string | null
          consultant_id: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          first_response_at: string | null
          id: string
          idade: number | null
          import_batch: string | null
          last_contact_at: string | null
          loss_reason: string | null
          next_follow_up_at: string | null
          nome: string
          notes: string | null
          opened_at: string | null
          orcamento: number | null
          origem: string | null
          quality_score: number
          respondeu_whatsapp: boolean
          score: number
          sexo: string | null
          situacao: string | null
          sla_status: Database["public"]["Enums"]["prospect_sla_status"]
          status: Database["public"]["Enums"]["prospect_status"]
          telefone: string | null
          telefones: string[]
          updated_at: string
          urgencia: string | null
        }
        Insert: {
          cidade?: string | null
          consultant_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          first_response_at?: string | null
          id?: string
          idade?: number | null
          import_batch?: string | null
          last_contact_at?: string | null
          loss_reason?: string | null
          next_follow_up_at?: string | null
          nome: string
          notes?: string | null
          opened_at?: string | null
          orcamento?: number | null
          origem?: string | null
          quality_score?: number
          respondeu_whatsapp?: boolean
          score?: number
          sexo?: string | null
          situacao?: string | null
          sla_status?: Database["public"]["Enums"]["prospect_sla_status"]
          status?: Database["public"]["Enums"]["prospect_status"]
          telefone?: string | null
          telefones?: string[]
          updated_at?: string
          urgencia?: string | null
        }
        Update: {
          cidade?: string | null
          consultant_id?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          first_response_at?: string | null
          id?: string
          idade?: number | null
          import_batch?: string | null
          last_contact_at?: string | null
          loss_reason?: string | null
          next_follow_up_at?: string | null
          nome?: string
          notes?: string | null
          opened_at?: string | null
          orcamento?: number | null
          origem?: string | null
          quality_score?: number
          respondeu_whatsapp?: boolean
          score?: number
          sexo?: string | null
          situacao?: string | null
          sla_status?: Database["public"]["Enums"]["prospect_sla_status"]
          status?: Database["public"]["Enums"]["prospect_status"]
          telefone?: string | null
          telefones?: string[]
          updated_at?: string
          urgencia?: string | null
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
      rh_candidatos: {
        Row: {
          created_at: string
          email: string | null
          etapa: string
          fit: number
          id: string
          nome: string
          notas: string | null
          telefone: string | null
          updated_at: string
          vaga_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          etapa?: string
          fit?: number
          id?: string
          nome: string
          notas?: string | null
          telefone?: string | null
          updated_at?: string
          vaga_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          etapa?: string
          fit?: number
          id?: string
          nome?: string
          notas?: string | null
          telefone?: string | null
          updated_at?: string
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_candidatos_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_clima_responses: {
        Row: {
          answers: Json
          comment: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          answers?: Json
          comment?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          answers?: Json
          comment?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      rh_desligamentos: {
        Row: {
          alertas_futuros: string | null
          cargo: string | null
          colaborador: string
          created_at: string
          criado_por: string | null
          data_admissao: string | null
          data_desligamento: string
          editado_por: string | null
          historico: Json
          id: string
          motivo: string | null
          motivo_detalhado: string
          responsavel: string | null
          setor: string | null
          sinais_contratacao: string
          tipo: string
          updated_at: string
        }
        Insert: {
          alertas_futuros?: string | null
          cargo?: string | null
          colaborador: string
          created_at?: string
          criado_por?: string | null
          data_admissao?: string | null
          data_desligamento?: string
          editado_por?: string | null
          historico?: Json
          id?: string
          motivo?: string | null
          motivo_detalhado: string
          responsavel?: string | null
          setor?: string | null
          sinais_contratacao: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          alertas_futuros?: string | null
          cargo?: string | null
          colaborador?: string
          created_at?: string
          criado_por?: string | null
          data_admissao?: string | null
          data_desligamento?: string
          editado_por?: string | null
          historico?: Json
          id?: string
          motivo?: string | null
          motivo_detalhado?: string
          responsavel?: string | null
          setor?: string | null
          sinais_contratacao?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
      rh_ocorrencias: {
        Row: {
          colaborador: string
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          id: string
          para_user_id: string | null
          popup: boolean
          tipo: string
          updated_at: string
        }
        Insert: {
          colaborador: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao: string
          id?: string
          para_user_id?: string | null
          popup?: boolean
          tipo?: string
          updated_at?: string
        }
        Update: {
          colaborador?: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          id?: string
          para_user_id?: string | null
          popup?: boolean
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      rh_onboarding: {
        Row: {
          colaborador: string
          created_at: string
          id: string
          tarefas: Json
          updated_at: string
        }
        Insert: {
          colaborador: string
          created_at?: string
          id?: string
          tarefas?: Json
          updated_at?: string
        }
        Update: {
          colaborador?: string
          created_at?: string
          id?: string
          tarefas?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rh_portal_atalhos: {
        Row: {
          created_at: string
          icon: string
          id: string
          label: string
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          label: string
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          label?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      rh_portal_avisos: {
        Row: {
          created_at: string
          icon: string
          id: string
          quando: string | null
          sort: number
          titulo: string
          tone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          quando?: string | null
          sort?: number
          titulo: string
          tone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          quando?: string | null
          sort?: number
          titulo?: string
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      rh_portal_kpis: {
        Row: {
          banco_horas: number
          beneficios: number
          created_at: string
          id: string
          salario: number
          saldo_ferias: number
          trein_concluidos: number
          trein_total: number
          updated_at: string
        }
        Insert: {
          banco_horas?: number
          beneficios?: number
          created_at?: string
          id?: string
          salario?: number
          saldo_ferias?: number
          trein_concluidos?: number
          trein_total?: number
          updated_at?: string
        }
        Update: {
          banco_horas?: number
          beneficios?: number
          created_at?: string
          id?: string
          salario?: number
          saldo_ferias?: number
          trein_concluidos?: number
          trein_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      rh_portal_profiles: {
        Row: {
          created_at: string
          foto_path: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          foto_path?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          foto_path?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rh_producao: {
        Row: {
          consultora: string
          contratos: number
          created_at: string
          created_by: string | null
          departamento: string | null
          id: string
          mes: string
          updated_at: string
          valor: number
        }
        Insert: {
          consultora: string
          contratos?: number
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          id?: string
          mes: string
          updated_at?: string
          valor?: number
        }
        Update: {
          consultora?: string
          contratos?: number
          created_at?: string
          created_by?: string | null
          departamento?: string | null
          id?: string
          mes?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      rh_reconhecimentos: {
        Row: {
          created_at: string
          data: string
          de: string
          id: string
          mensagem: string
          para: string
          periodicidade: string
          periodo_fim: string | null
          periodo_inicio: string | null
          popup: boolean
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          de: string
          id?: string
          mensagem: string
          para: string
          periodicidade?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          popup?: boolean
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          de?: string
          id?: string
          mensagem?: string
          para?: string
          periodicidade?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          popup?: boolean
          tipo?: string
          updated_at?: string
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
      rh_vagas: {
        Row: {
          created_at: string
          departamento: string
          id: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          departamento?: string
          id?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          departamento?: string
          id?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
      prospect_event_kind:
        | "ligacao"
        | "whatsapp"
        | "nota"
        | "status"
        | "followup"
        | "sistema"
      prospect_sla_status: "ok" | "atencao" | "atrasado"
      prospect_status: "novo" | "qualificado" | "proposta" | "ganho" | "perdido"
      prospect_task_status: "pending" | "done" | "canceled"
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
      prospect_event_kind: [
        "ligacao",
        "whatsapp",
        "nota",
        "status",
        "followup",
        "sistema",
      ],
      prospect_sla_status: ["ok", "atencao", "atrasado"],
      prospect_status: ["novo", "qualificado", "proposta", "ganho", "perdido"],
      prospect_task_status: ["pending", "done", "canceled"],
    },
  },
} as const
