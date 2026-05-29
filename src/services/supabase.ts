import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'FATAL: Variáveis de ambiente VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não estão definidas. ' +
    'Verifique o arquivo .env.local (local) ou as Settings > Environment Variables na Vercel.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Desabilitar o mecanismo de navigator.locks para evitar travamento
    // ao recarregar a página ou em janelas anônimas.
    // O lock padrão do Supabase usa navigator.locks que pode ficar "órfão"
    // quando a página é destruída abruptamente (Ctrl+R, F5, fechar aba),
    // causando deadlock nas chamadas subsequentes de getSession/signIn.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return await fn();
    },
  },
});
