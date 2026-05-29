export type ClientStatus = 'active' | 'inactive' | 'onboarding';

export interface ModulesEnabled {
  approvals: boolean;
  financial: boolean;
  documents: boolean;
  support: boolean;
}

export interface Client {
  id: string;
  name: string;
  legal_name?: string | null;
  cnpj?: string | null;
  email: string;
  phone?: string | null;
  logo_url?: string;
  status: ClientStatus;
  assigned_to: string | null;
  modules_enabled: ModulesEnabled;
  onboarding_step: number;
  onboarding_completed: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  whatsapp_group_id?: string | null;
  ai_summary_enabled?: boolean;
  last_ai_summary_at?: string | null;
  evolution_instance_name?: string | null;
  evolution_instance_status?: string | null;
}

export interface ClientWithProfile extends Client {
  profiles?: { full_name: string; email?: string | null };
}
