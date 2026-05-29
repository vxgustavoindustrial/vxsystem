export interface SupportTicket {
  id: string;
  client_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketWithClient extends SupportTicket {
  client?: { name: string } | null;
}

export interface SupportMessage {
  id: string;
  client_id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  attachment_url: string | null;
  read_at: string | null;
  created_at: string;
  // join
  sender_profile?: {
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
}
