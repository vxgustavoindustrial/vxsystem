import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AuthLoadingScreen } from './ui/AuthLoadingScreen';
import type { Role } from '../types/auth.types';

interface ProtectedRouteProps {
  requiredRole?: Role;
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, profile, role, isLoading } = useAuthStore();

  // Enquanto estiver carregando, mostrar tela de loading
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // Se não tem user após o loading terminar, redirecionar para login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se tem user mas o profile ainda não carregou (pode acontecer em edge cases),
  // mostrar loading ao invés de rejeitar
  if (!profile) {
    return <AuthLoadingScreen />;
  }

  if (!profile.is_active) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 'member' pode acessar rotas de 'admin' (painel da agência)
  // Se for admin/member e estiver com impersonatedClientId, pode acessar rotas de 'client'
  const isAgencyRole = role === 'admin' || role === 'member';
  const isImpersonating = isAgencyRole && !!useAuthStore.getState().impersonatedClientId;
  
  const hasAccess = 
    !requiredRole || 
    role === requiredRole || 
    (requiredRole === 'admin' && role === 'member') ||
    (requiredRole === 'client' && isImpersonating);

  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
