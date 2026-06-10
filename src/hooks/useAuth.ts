import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export function useAuth() {
  const { user, profile, role, clientId, impersonatedClientId, isLoading, clear } = useAuthStore();
  const navigate = useNavigate();

  // Se estiver impessoalizando, usamos o ID do cliente alvo
  const activeClientId = impersonatedClientId || clientId;

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao fazer logout no Supabase:', error);
    } finally {
      clear();
      navigate('/login', { replace: true });
    }
  };

  const vxRole = profile?.vx_role ?? null;
  const isVxAdmin = vxRole === 'admin' || vxRole === null; // null = legacy admin
  const isVxProgramador = vxRole === 'programador';
  const isVxFinanceiro = vxRole === 'financeiro';

  return {
    user,
    profile,
    role,
    clientId: activeClientId,
    impersonatedClientId,
    isLoading,
    clientRole: profile?.client_role ?? null,
    isProjetista: profile?.client_role === 'projetista',
    isFinanceiro: profile?.client_role === 'financeiro',
    vxRole,
    isVxAdmin,
    isVxProgramador,
    isVxFinanceiro,
    signOut
  };
}
