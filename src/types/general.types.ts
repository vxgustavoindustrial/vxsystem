export interface Task {
  id: string;
  client_id?: string;
  title: string;
  description?: string;
  module?: 'general' | 'onboarding' | 'financial' | 'documents' | 'support';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  created_by: string;
  due_date?: string;
  completed_at?: string;
  parent_id?: string;
  stage?: string;
  is_template?: boolean;
  order?: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  client_id?: string;
  title: string;
  description?: string;
  file_url: string;
  file_type?: 'pdf' | 'image' | 'doc' | 'spreadsheet';
  file_size?: number;
  category?: 'contract' | 'brief' | 'report' | 'creative';
  uploaded_by: string;
  deleted_at?: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  client_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  client_id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  attachment_url?: string;
  read_at?: string;
  created_at: string;
}

export interface FinancialInvoice {
  id: string;
  client_id: string;
  title: string;
  description: string;
  amount: number;
  category: 'labor' | 'ads' | 'software' | 'other' | string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'disputed' | string;
  due_date: string;
  paid_at?: string | null;
  file_url?: string;
  client_notes?: string;
  dispute_message?: string;
  dispute_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  client_id?: string;
  type: 'task' | 'report' | 'support' | 'financial';
  title: string;
  body?: string;
  link?: string;
  read_at?: string;
  created_at: string;
}

export type FlowStatus = 'active' | 'draft';

export interface Flow {
  id: string;
  name: string;
  description?: string;
  status: FlowStatus;
  steps: Array<Record<string, unknown>>;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}
export interface ClientCredential {
  id: string;
  client_id: string;
  platform: string;
  url?: string;
  username?: string;
  password?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
