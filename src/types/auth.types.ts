import type { Client } from './client.types';

export type Role = 'admin' | 'client' | 'member';

export interface Permissions {
  approvals?: 'view' | 'manage';
  financial?: 'view' | 'manage';
  documents?: 'view' | 'manage';
  support?: 'view' | 'manage';
  onboarding?: 'view' | 'manage';
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  client_id?: string;
  client?: Client;
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  permissions?: Permissions;
  created_at: string;
  updated_at: string;
}
