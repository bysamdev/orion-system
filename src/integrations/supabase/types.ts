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
      api_keys: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          key_value: string
          label: string | null
          last_used_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_value: string
          label?: string | null
          last_used_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_value?: string
          label?: string | null
          last_used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_relationships: {
        Row: {
          created_at: string
          id: string
          port_source: string | null
          port_target: string | null
          relationship_type: string
          source_asset_id: string
          target_asset_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          port_source?: string | null
          port_target?: string | null
          relationship_type: string
          source_asset_id: string
          target_asset_id: string
        }
        Update: {
          created_at?: string
          id?: string
          port_source?: string | null
          port_target?: string | null
          relationship_type?: string
          source_asset_id?: string
          target_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_relationships_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_relationships_target_asset_id_fkey"
            columns: ["target_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          brand: string | null
          company_id: string
          created_at: string
          hostname: string | null
          id: string
          internal_ip: string | null
          last_check: string | null
          model: string | null
          name: string
          notes: string | null
          os: string | null
          purchased_at: string | null
          serial_number: string | null
          status: string
          type: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          brand?: string | null
          company_id: string
          created_at?: string
          hostname?: string | null
          id?: string
          internal_ip?: string | null
          last_check?: string | null
          model?: string | null
          name: string
          notes?: string | null
          os?: string | null
          purchased_at?: string | null
          serial_number?: string | null
          status?: string
          type?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          brand?: string | null
          company_id?: string
          created_at?: string
          hostname?: string | null
          id?: string
          internal_ip?: string | null
          last_check?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          os?: string | null
          purchased_at?: string | null
          serial_number?: string | null
          status?: string
          type?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action_result: string | null
          action_type: string
          created_at: string
          id: string
          rule_id: string | null
          rule_name: string | null
          ticket_id: string | null
        }
        Insert: {
          action_result?: string | null
          action_type: string
          created_at?: string
          id?: string
          rule_id?: string | null
          rule_name?: string | null
          ticket_id?: string | null
        }
        Update: {
          action_result?: string | null
          action_type?: string
          created_at?: string
          id?: string
          rule_id?: string | null
          rule_name?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "routing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_secrets: {
        Row: {
          created_at: string
          name: string
          secret: string
        }
        Insert: {
          created_at?: string
          name: string
          secret: string
        }
        Update: {
          created_at?: string
          name?: string
          secret?: string
        }
        Relationships: []
      }
      canned_responses: {
        Row: {
          company_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          shortcut: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          shortcut?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          shortcut?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canned_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canned_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string
          current_plan_id: string | null
          domain: string | null
          has_contract: boolean
          id: string
          is_master: boolean
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          current_plan_id?: string | null
          domain?: string | null
          has_contract?: boolean
          id?: string
          is_master?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          current_plan_id?: string | null
          domain?: string | null
          has_contract?: boolean
          id?: string
          is_master?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_sistema: {
        Row: {
          chave: string
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          chave: string
          updated_at?: string
          updated_by?: string | null
          valor: Json
        }
        Update: {
          chave?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      contract_billing_cycles: {
        Row: {
          closed_at: string
          company_id: string
          consumed_hours: number
          contract_id: string
          contracted_hours: number | null
          created_at: string
          id: string
          period_end: string
          period_start: string
        }
        Insert: {
          closed_at?: string
          company_id: string
          consumed_hours?: number
          contract_id: string
          contracted_hours?: number | null
          created_at?: string
          id?: string
          period_end: string
          period_start: string
        }
        Update: {
          closed_at?: string
          company_id?: string
          consumed_hours?: number
          contract_id?: string
          contracted_hours?: number | null
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_billing_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_billing_cycles_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          company_id: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          monthly_hours: number | null
          name: string
          notes: string | null
          sla_config_id: string | null
          start_date: string
          tickets_limit: number | null
          tickets_used: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          monthly_hours?: number | null
          name: string
          notes?: string | null
          sla_config_id?: string | null
          start_date: string
          tickets_limit?: number | null
          tickets_used?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          monthly_hours?: number | null
          name?: string
          notes?: string | null
          sla_config_id?: string | null
          start_date?: string
          tickets_limit?: number | null
          tickets_used?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_sla_config_id_fkey"
            columns: ["sla_config_id"]
            isOneToOne: false
            referencedRelation: "sla_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string
          custom_field_id: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          custom_field_id: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          custom_field_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          applies_to: string
          company_id: string
          created_at: string
          field_type: string
          id: string
          is_active: boolean
          name: string
          options: Json | null
          required: boolean
          sort_order: number
        }
        Insert: {
          applies_to: string
          company_id: string
          created_at?: string
          field_type: string
          id?: string
          is_active?: boolean
          name: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Update: {
          applies_to?: string
          company_id?: string
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          name?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_departments_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      egress_diario: {
        Row: {
          bytes: number
          dia: string
        }
        Insert: {
          bytes?: number
          dia: string
        }
        Update: {
          bytes?: number
          dia?: string
        }
        Relationships: []
      }
      invite_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      knowledge_base_articles: {
        Row: {
          category: string
          company_id: string
          content: string
          created_at: string
          created_by: string
          embedding: string | null
          id: string
          is_public: boolean
          search_vector: unknown
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          view_count: number
        }
        Insert: {
          category?: string
          company_id: string
          content: string
          created_at?: string
          created_by: string
          embedding?: string | null
          id?: string
          is_public?: boolean
          search_vector?: unknown
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          view_count?: number
        }
        Update: {
          category?: string
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string
          embedding?: string | null
          id?: string
          is_public?: boolean
          search_vector?: unknown
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_alerts: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          message: string | null
          resolved: boolean
          severity: string | null
          type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          message?: string | null
          resolved?: boolean
          severity?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          message?: string | null
          resolved?: boolean
          severity?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_alerts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_commands: {
        Row: {
          command: string
          created_at: string
          executed_by_name: string | null
          executed_by_user_id: string | null
          id: string
          machine_id: string
          output: string | null
          status: string
          updated_at: string
        }
        Insert: {
          command: string
          created_at?: string
          executed_by_name?: string | null
          executed_by_user_id?: string | null
          id?: string
          machine_id: string
          output?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          command?: string
          created_at?: string
          executed_by_name?: string | null
          executed_by_user_id?: string | null
          id?: string
          machine_id?: string
          output?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_commands_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_device_type_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          machine_id: string
          new_type: string
          old_type: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string
          id?: string
          machine_id: string
          new_type: string
          old_type?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          machine_id?: string
          new_type?: string
          old_type?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_device_type_history_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_groups: {
        Row: {
          client_contact: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          client_contact?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          client_contact?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_hardware: {
        Row: {
          battery_info: Json | null
          cpu_model: string | null
          disks: Json | null
          gpu: string | null
          id: string
          interfaces: Json | null
          machine_id: string
          ram_slots: Json | null
          remote_software: Json | null
          security_info: Json | null
          update_status: Json | null
          updated_at: string
        }
        Insert: {
          battery_info?: Json | null
          cpu_model?: string | null
          disks?: Json | null
          gpu?: string | null
          id?: string
          interfaces?: Json | null
          machine_id: string
          ram_slots?: Json | null
          remote_software?: Json | null
          security_info?: Json | null
          update_status?: Json | null
          updated_at?: string
        }
        Update: {
          battery_info?: Json | null
          cpu_model?: string | null
          disks?: Json | null
          gpu?: string | null
          id?: string
          interfaces?: Json | null
          machine_id?: string
          ram_slots?: Json | null
          remote_software?: Json | null
          security_info?: Json | null
          update_status?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_hardware_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: true
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_identity_merges: {
        Row: {
          criterio: string
          hostname_anterior: string | null
          hostname_novo: string | null
          id: string
          machine_id: string
          merged_at: string
        }
        Insert: {
          criterio: string
          hostname_anterior?: string | null
          hostname_novo?: string | null
          id?: string
          machine_id: string
          merged_at?: string
        }
        Update: {
          criterio?: string
          hostname_anterior?: string | null
          hostname_novo?: string | null
          id?: string
          machine_id?: string
          merged_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_identity_merges_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          agent_version: string | null
          approval_status: string
          auth_recusada_em: string | null
          board_mac: string | null
          company_id: string | null
          cpu_usage: number | null
          created_at: string
          current_user: string | null
          current_user_sid: string | null
          device_type: string | null
          device_type_locked: boolean
          device_type_reason: string | null
          disk_total: number | null
          disk_used: number | null
          domain: string | null
          group_id: string | null
          hardware_uuid: string | null
          hostname: string
          id: string
          ip_address: string | null
          last_seen: string | null
          local_ip: string | null
          logged_in_user: string | null
          mac_address: string | null
          machine_token: string | null
          machine_uuid: string | null
          metrics_collected_at: string | null
          os: string | null
          os_version: string | null
          ram_total: number | null
          ram_used: number | null
          status: string
          updated_at: string
          uptime: number | null
        }
        Insert: {
          agent_version?: string | null
          approval_status?: string
          auth_recusada_em?: string | null
          board_mac?: string | null
          company_id?: string | null
          cpu_usage?: number | null
          created_at?: string
          current_user?: string | null
          current_user_sid?: string | null
          device_type?: string | null
          device_type_locked?: boolean
          device_type_reason?: string | null
          disk_total?: number | null
          disk_used?: number | null
          domain?: string | null
          group_id?: string | null
          hardware_uuid?: string | null
          hostname: string
          id?: string
          ip_address?: string | null
          last_seen?: string | null
          local_ip?: string | null
          logged_in_user?: string | null
          mac_address?: string | null
          machine_token?: string | null
          machine_uuid?: string | null
          metrics_collected_at?: string | null
          os?: string | null
          os_version?: string | null
          ram_total?: number | null
          ram_used?: number | null
          status?: string
          updated_at?: string
          uptime?: number | null
        }
        Update: {
          agent_version?: string | null
          approval_status?: string
          auth_recusada_em?: string | null
          board_mac?: string | null
          company_id?: string | null
          cpu_usage?: number | null
          created_at?: string
          current_user?: string | null
          current_user_sid?: string | null
          device_type?: string | null
          device_type_locked?: boolean
          device_type_reason?: string | null
          disk_total?: number | null
          disk_used?: number | null
          domain?: string | null
          group_id?: string | null
          hardware_uuid?: string | null
          hostname?: string
          id?: string
          ip_address?: string | null
          last_seen?: string | null
          local_ip?: string | null
          logged_in_user?: string | null
          mac_address?: string | null
          machine_token?: string | null
          machine_uuid?: string | null
          metrics_collected_at?: string | null
          os?: string | null
          os_version?: string | null
          ram_total?: number | null
          ram_used?: number | null
          status?: string
          updated_at?: string
          uptime?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "machine_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      monitored_endpoints: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          last_check: string | null
          name: string
          status: string | null
          url_or_ip: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          last_check?: string | null
          name: string
          status?: string | null
          url_or_ip: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          last_check?: string | null
          name?: string
          status?: string | null
          url_or_ip?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitored_endpoints_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      network_links: {
        Row: {
          check_interval_seconds: number | null
          company_id: string | null
          created_at: string | null
          id: string
          ip_or_hostname: string | null
          last_checked_at: string | null
          last_ping_ms: number | null
          link_type: string
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          check_interval_seconds?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          ip_or_hostname?: string | null
          last_checked_at?: string | null
          last_ping_ms?: number | null
          link_type?: string
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          check_interval_seconds?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          ip_or_hostname?: string | null
          last_checked_at?: string | null
          last_ping_ms?: number | null
          link_type?: string
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      package_deployments: {
        Row: {
          command_id: string | null
          completed_at: string | null
          dispatched_at: string
          dispatched_by: string | null
          id: string
          machine_id: string
          package_id: string
          status: string
        }
        Insert: {
          command_id?: string | null
          completed_at?: string | null
          dispatched_at?: string
          dispatched_by?: string | null
          id?: string
          machine_id: string
          package_id: string
          status?: string
        }
        Update: {
          command_id?: string | null
          completed_at?: string | null
          dispatched_at?: string
          dispatched_by?: string | null
          id?: string
          machine_id?: string
          package_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_deployments_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "machine_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_deployments_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_deployments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "software_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          max_users: number
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_users: number
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_users?: number
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          last_assigned_at: string | null
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          last_assigned_at?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          last_assigned_at?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_inscricoes: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          bucket_key: string
          count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      remote_terminal_sessions: {
        Row: {
          company_id: string | null
          id: string
          machine_id: string
          opened_at: string
          opened_by: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          machine_id: string
          opened_at?: string
          opened_by: string
        }
        Update: {
          company_id?: string | null
          id?: string
          machine_id?: string
          opened_at?: string
          opened_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "remote_terminal_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          created_by: string
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          next_run_at: string
          recipients: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          frequency: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_run_at?: string
          recipients: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_run_at?: string
          recipients?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resolution_checklists: {
        Row: {
          category: string
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          items: Json
          updated_at: string | null
        }
        Insert: {
          category: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json
          updated_at?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resolution_checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rmm_remediation_logs: {
        Row: {
          agent_id: string
          alert_type: string | null
          company_id: string | null
          created_at: string | null
          id: string
          output: string | null
          rule_id: string | null
          status: string
        }
        Insert: {
          agent_id: string
          alert_type?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          output?: string | null
          rule_id?: string | null
          status: string
        }
        Update: {
          agent_id?: string
          alert_type?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          output?: string | null
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rmm_remediation_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rmm_remediation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rmm_remediation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rmm_remediation_rules: {
        Row: {
          action_payload: Json | null
          action_type: string
          alert_type: string
          company_id: string | null
          condition_json: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          alert_type: string
          company_id?: string | null
          condition_json?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          alert_type?: string
          company_id?: string | null
          condition_json?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rmm_remediation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rules: {
        Row: {
          actions: Json | null
          company_id: string | null
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          company_id?: string | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          company_id?: string | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      saude_do_banco: {
        Row: {
          alerta_enviado_em: string | null
          anomalia_desde: string | null
          em_alerta: boolean
          id: number
          lido_em: string | null
          rollbacks_lidos: number | null
          ultima_taxa: number | null
        }
        Insert: {
          alerta_enviado_em?: string | null
          anomalia_desde?: string | null
          em_alerta?: boolean
          id?: number
          lido_em?: string | null
          rollbacks_lidos?: number | null
          ultima_taxa?: number | null
        }
        Update: {
          alerta_enviado_em?: string | null
          anomalia_desde?: string | null
          em_alerta?: boolean
          id?: number
          lido_em?: string | null
          rollbacks_lidos?: number | null
          ultima_taxa?: number | null
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          default_priority: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          default_priority?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          default_priority?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_configs: {
        Row: {
          business_end: string | null
          business_hours_only: boolean
          business_start: string | null
          company_id: string
          created_at: string
          high_hours: number
          id: string
          low_hours: number
          medium_hours: number
          name: string
          updated_at: string
          urgent_hours: number
        }
        Insert: {
          business_end?: string | null
          business_hours_only?: boolean
          business_start?: string | null
          company_id: string
          created_at?: string
          high_hours: number
          id?: string
          low_hours: number
          medium_hours: number
          name: string
          updated_at?: string
          urgent_hours: number
        }
        Update: {
          business_end?: string | null
          business_hours_only?: boolean
          business_start?: string | null
          company_id?: string
          created_at?: string
          high_hours?: number
          id?: string
          low_hours?: number
          medium_hours?: number
          name?: string
          updated_at?: string
          urgent_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      software_packages: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deploy_count: number
          description: string | null
          file_path: string | null
          id: string
          name: string
          sha256_hash: string
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deploy_count?: number
          description?: string | null
          file_path?: string | null
          id?: string
          name: string
          sha256_hash: string
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deploy_count?: number
          description?: string | null
          file_path?: string | null
          id?: string
          name?: string
          sha256_hash?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "software_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_assets: {
        Row: {
          asset_id: string
          ticket_id: string
        }
        Insert: {
          asset_id: string
          ticket_id: string
        }
        Update: {
          asset_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_assets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          file_url: string
          id?: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_kb_links: {
        Row: {
          article_id: string
          created_at: string
          id: string
          linked_by: string
          ticket_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          linked_by: string
          ticket_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          linked_by?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_kb_links_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_kb_links_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number | null
          skipped: boolean
          ticket_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          skipped?: boolean
          ticket_id: string
          user_id?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          skipped?: boolean
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_ratings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          reason: string | null
          ticket_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          reason?: string | null
          ticket_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_updates: {
        Row: {
          author: string
          author_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
          type: string
        }
        Insert: {
          author: string
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
          type?: string
        }
        Update: {
          author?: string
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ticket_updates_author"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ticket_updates_ticket"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_updates_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          avaliacao_email_enviada_em: string | null
          cancelled_at: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          operator_name: string | null
          priority: string
          remote_id: string | null
          remote_password: string | null
          remote_tool: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          scheduled_date: string | null
          search_vector: unknown
          service_id: string | null
          sla_accumulated_pause_minutes: number | null
          sla_due_date: string | null
          sla_paused_at: string | null
          sla_status: string | null
          status: string
          ticket_number: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          assigned_to_user_id?: string | null
          avaliacao_email_enviada_em?: string | null
          cancelled_at?: string | null
          category: string
          category_id?: string | null
          closed_at?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          department?: string | null
          description: string
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          operator_name?: string | null
          priority?: string
          remote_id?: string | null
          remote_password?: string | null
          remote_tool?: string | null
          requester_name: string
          resolution_notes?: string | null
          resolved_at?: string | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          scheduled_date?: string | null
          search_vector?: unknown
          service_id?: string | null
          sla_accumulated_pause_minutes?: number | null
          sla_due_date?: string | null
          sla_paused_at?: string | null
          sla_status?: string | null
          status?: string
          ticket_number?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          assigned_to_user_id?: string | null
          avaliacao_email_enviada_em?: string | null
          cancelled_at?: string | null
          category?: string
          category_id?: string | null
          closed_at?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          department?: string | null
          description?: string
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          operator_name?: string | null
          priority?: string
          remote_id?: string | null
          remote_password?: string | null
          remote_tool?: string | null
          requester_name?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          scheduled_date?: string | null
          search_vector?: unknown
          service_id?: string | null
          sla_accumulated_pause_minutes?: number | null
          sla_due_date?: string | null
          sla_paused_at?: string | null
          sla_status?: string | null
          status?: string
          ticket_number?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tickets_assigned_user"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          start_time: string
          ticket_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          start_time: string
          ticket_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          start_time?: string
          ticket_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_roles_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adiciona_dias_uteis: {
        Args: { dias: number; inicio: string }
        Returns: string
      }
      alterar_prioridade_chamado: {
        Args: {
          p_expected_updated_at?: string
          p_priority: string
          p_ticket_id: string
          p_update_content?: string
        }
        Returns: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          avaliacao_email_enviada_em: string | null
          cancelled_at: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          operator_name: string | null
          priority: string
          remote_id: string | null
          remote_password: string | null
          remote_tool: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          scheduled_date: string | null
          search_vector: unknown
          service_id: string | null
          sla_accumulated_pause_minutes: number | null
          sla_due_date: string | null
          sla_paused_at: string | null
          sla_status: string | null
          status: string
          ticket_number: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      alterar_status_chamado: {
        Args: {
          p_expected_updated_at?: string
          p_is_internal?: boolean
          p_status: string
          p_ticket_id: string
          p_update_content?: string
          p_update_type?: string
        }
        Returns: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          avaliacao_email_enviada_em: string | null
          cancelled_at: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          operator_name: string | null
          priority: string
          remote_id: string | null
          remote_password: string | null
          remote_tool: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          scheduled_date: string | null
          search_vector: unknown
          service_id: string | null
          sla_accumulated_pause_minutes: number | null
          sla_due_date: string | null
          sla_paused_at: string | null
          sla_status: string | null
          status: string
          ticket_number: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assumir_chamado: {
        Args: {
          p_expected_updated_at?: string
          p_ticket_id: string
          p_user_name: string
        }
        Returns: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          avaliacao_email_enviada_em: string | null
          cancelled_at: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          operator_name: string | null
          priority: string
          remote_id: string | null
          remote_password: string | null
          remote_tool: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          scheduled_date: string | null
          search_vector: unknown
          service_id: string | null
          sla_accumulated_pause_minutes: number | null
          sla_due_date: string | null
          sla_paused_at: string | null
          sla_status: string | null
          status: string
          ticket_number: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      atribuir_chamado: {
        Args: {
          p_assigned_to: string
          p_assigned_to_user_id?: string
          p_expected_updated_at?: string
          p_ticket_id: string
          p_update_content?: string
        }
        Returns: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          avaliacao_email_enviada_em: string | null
          cancelled_at: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          operator_name: string | null
          priority: string
          remote_id: string | null
          remote_password: string | null
          remote_tool: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          scheduled_date: string | null
          search_vector: unknown
          service_id: string | null
          sla_accumulated_pause_minutes: number | null
          sla_due_date: string | null
          sla_paused_at: string | null
          sla_status: string | null
          status: string
          ticket_number: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_close_resolved_tickets: { Args: never; Returns: number }
      calcular_prazo_sla: {
        Args: { p_company_id: string; p_inicio: string; p_priority: string }
        Returns: string
      }
      calculate_sla_due_date: {
        Args: { ticket_created_at: string; ticket_priority: string }
        Returns: string
      }
      chamado_pendente_de_avaliacao: {
        Args: never
        Returns: {
          encerrado_em: string
          id: string
          ticket_number: number
          title: string
        }[]
      }
      check_index_health: {
        Args: never
        Returns: {
          efficiency: number
          index_name: string
          index_scans: number
          index_size: string
          rows_fetched: number
          rows_read: number
          table_name: string
        }[]
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: number
      }
      check_table_bloat: {
        Args: never
        Returns: {
          dead_ratio: number
          dead_tuples: number
          live_tuples: number
          needs_vacuum: boolean
          table_name: string
          total_size: string
        }[]
      }
      cleanup_audit_logs: { Args: never; Returns: undefined }
      cleanup_expired_invite_tokens: { Args: never; Returns: number }
      cleanup_monitoring_history: { Args: never; Returns: undefined }
      cleanup_old_machine_metrics: { Args: never; Returns: undefined }
      close_contract_billing_cycles: {
        Args: { p_period_end: string; p_period_start: string }
        Returns: number
      }
      close_previous_month_billing_cycles: { Args: never; Returns: number }
      count_company_active_agents: {
        Args: { p_company_id: string }
        Returns: number
      }
      definir_sla_ativo: { Args: { p_ativo: boolean }; Returns: undefined }
      despachar_pacote: {
        Args: { p_machine_id: string; p_package_id: string }
        Returns: string
      }
      dispatch_due_report_schedules: { Args: never; Returns: number }
      eh_usuario_de_maquina: { Args: { _user_id: string }; Returns: boolean }
      escalar_chamado: {
        Args: {
          p_expected_updated_at?: string
          p_new_priority: string
          p_reason: string
          p_technician_name: string
          p_technician_user_id: string
          p_ticket_id: string
        }
        Returns: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          avaliacao_email_enviada_em: string | null
          cancelled_at: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          operator_name: string | null
          priority: string
          remote_id: string | null
          remote_password: string | null
          remote_tool: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          scheduled_date: string | null
          search_vector: unknown
          service_id: string | null
          sla_accumulated_pause_minutes: number | null
          sla_due_date: string | null
          sla_paused_at: string | null
          sla_status: string | null
          status: string
          ticket_number: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      falhar_comando_chamado: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      fechar_chamados_em_pausa_sem_resposta: { Args: never; Returns: number }
      fn_auto_assign_ticket: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      fn_merge_tickets: {
        Args: { duplicate_ids: string[]; primary_id: string }
        Returns: undefined
      }
      get_all_monitoring_targets: { Args: { p_secret?: string }; Returns: Json }
      get_company_plan_usage: { Args: never; Returns: Json }
      get_cron_dispatch_secret: { Args: never; Returns: string }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_reports_active_in_period: {
        Args: {
          p_company_id?: string
          p_end_date: string
          p_start_date: string
          p_tech_id?: string
        }
        Returns: Json
      }
      get_reports_created_in_period: {
        Args: {
          p_company_id?: string
          p_end_date: string
          p_start_date: string
          p_tech_id?: string
        }
        Returns: Json
      }
      get_reports_tickets: {
        Args: {
          p_company_id?: string
          p_end_date: string
          p_mode: string
          p_start_date: string
          p_tech_id?: string
        }
        Returns: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          avaliacao_email_enviada_em: string | null
          cancelled_at: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          operator_name: string | null
          priority: string
          remote_id: string | null
          remote_password: string | null
          remote_tool: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          scheduled_date: string | null
          search_vector: unknown
          service_id: string | null
          sla_accumulated_pause_minutes: number | null
          sla_due_date: string | null
          sla_paused_at: string | null
          sla_status: string | null
          status: string
          ticket_number: number
          title: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_technician_workload: {
        Args: { p_company_id: string }
        Returns: {
          open_tickets: number
          resolved_today: number
          sla_at_risk_tickets: number
          technician_id: string
          technician_name: string
        }[]
      }
      get_ticket_company_id: { Args: { _ticket_id: string }; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_equipe_interna: { Args: { _user_id: string }; Returns: boolean }
      is_master_company_user: { Args: { _user_id: string }; Returns: boolean }
      itens_de_regra: { Args: { p: Json }; Returns: Json[] }
      machine_ticket_counts: {
        Args: never
        Returns: {
          machine_id: string
          tickets_count: number
        }[]
      }
      marcar_maquinas_offline: { Args: never; Returns: number }
      match_kb_articles: {
        Args: {
          match_count: number
          match_threshold: number
          p_company_id: string
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      merge_user_data: {
        Args: { source_id: string; target_id: string }
        Returns: undefined
      }
      normalizar_valor_de_regra: {
        Args: { p_campo: string; p_valor: string }
        Returns: string
      }
      pode_gerir_automacao: { Args: { p_company_id: string }; Returns: boolean }
      politica_sla_da_empresa: {
        Args: { p_company_id: string }
        Returns: {
          business_end: string | null
          business_hours_only: boolean
          business_start: string | null
          company_id: string
          created_at: string
          high_hours: number
          id: string
          low_hours: number
          medium_hours: number
          name: string
          updated_at: string
          urgent_hours: number
        }
        SetofOptions: {
          from: "*"
          to: "sla_configs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      regra_casa_com_chamado: {
        Args: {
          p_chamado: Database["public"]["Tables"]["tickets"]["Row"]
          p_condicoes: Json
        }
        Returns: boolean
      }
      minhas_sessoes: {
        Args: never
        Returns: {
          atual: boolean
          criada_em: string
          id: string
          ip: string | null
          ultimo_uso: string
          user_agent: string | null
        }[]
      }
      encerrar_sessao: { Args: { p_sessao: string }; Returns: boolean }
      sessao_atual_ativa: { Args: never; Returns: boolean }
      registrar_inscricao_push: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      resolver_chamado: {
        Args: {
          p_expected_updated_at?: string
          p_notes: string
          p_resolution_content: string
          p_ticket_id: string
        }
        Returns: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_user_id: string | null
          avaliacao_email_enviada_em: string | null
          cancelled_at: string | null
          category: string
          category_id: string | null
          closed_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          custom_fields: Json | null
          department: string | null
          description: string
          first_response_at: string | null
          id: string
          metadata: Json | null
          operator_name: string | null
          priority: string
          remote_id: string | null
          remote_password: string | null
          remote_tool: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          scheduled_date: string | null
          search_vector: unknown
          service_id: string | null
          sla_accumulated_pause_minutes: number | null
          sla_due_date: string | null
          sla_paused_at: string | null
          sla_status: string | null
          status: string
          ticket_number: number
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_tickets: {
        Args: { search_query: string }
        Returns: {
          created_at: string
          description: string
          id: string
          priority: string
          rank: number
          status: string
          ticket_number: number
          title: string
        }[]
      }
      silencio_tolerado: { Args: { p_device_type: string }; Returns: string }
      sla_ativo: { Args: never; Returns: boolean }
      somar_egress: { Args: { p_bytes: number }; Returns: undefined }
      somar_horas_uteis: {
        Args: {
          p_abre: string
          p_fecha: string
          p_horas: number
          p_inicio: string
        }
        Returns: string
      }
      tem_avaliacao_pendente: { Args: never; Returns: boolean }
      ticket_belongs_to_user_company: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      update_all_tickets_sla_status: { Args: never; Returns: number }
      update_telemetry_status: {
        Args: {
          p_endpoint_results?: Json
          p_link_results?: Json
          p_secret?: string
        }
        Returns: Json
      }
      verificar_saude_do_banco: { Args: { p_limiar?: number }; Returns: string }
    }
    Enums: {
      app_role: "customer" | "technician" | "admin" | "developer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["customer", "technician", "admin", "developer"],
    },
  },
} as const
