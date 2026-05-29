import { create } from 'zustand';
import type { Notification } from '../types/general.types';
import { supabase } from '../services/supabase';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  initialize: (scopeId: string, scope?: 'client' | 'user') => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) => set({ 
    notifications,
    unreadCount: notifications.filter(n => !n.read_at).length
  }),
  markAsRead: async (id) => {
    // Update local state first for instant feedback
    set((state) => {
      const updated = state.notifications.map(n => 
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.read_at).length
      };
    });

    // Sync with DB
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  },
  markAllAsRead: async () => {
    const notifications = get().notifications;
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
    if (unreadIds.length === 0) return;

    set((state) => {
      const updated = state.notifications.map(n => ({
        ...n,
        read_at: n.read_at || new Date().toISOString()
      }));
      return {
        notifications: updated,
        unreadCount: 0
      };
    });

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
      .is('read_at', null);
  },
  initialize: (scopeId: string, scope = 'client') => {
    const field = scope === 'user' ? 'user_id' : 'client_id';

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq(field, scopeId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        get().setNotifications(data as Notification[]);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${scope}-${scopeId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `${field}=eq.${scopeId}`
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}));
