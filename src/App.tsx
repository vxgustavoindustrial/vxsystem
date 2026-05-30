import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { useAuthStore } from './store/authStore';
import { useAuth } from './hooks/useAuth';

import { AuthLayout } from './layouts/AuthLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { ClientLayout } from './layouts/ClientLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThemeProvider } from './components/ThemeProvider';

import { LoginPage } from './app/login/page';
import { UnauthorizedPage } from './app/unauthorized/page';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthLoadingScreen } from './components/ui/AuthLoadingScreen';

const AdminDashboard = lazy(() => import('./app/admin/page').then((mod) => ({ default: mod.AdminDashboard })));
const AdminClientsPage = lazy(() => import('./app/admin/clients/page').then((mod) => ({ default: mod.AdminClientsPage })));
const AdminClientDetailPage = lazy(() => import('./app/admin/clients/[id]/page').then((mod) => ({ default: mod.AdminClientDetailPage })));
const AdminDocumentsPage = lazy(() => import('./app/admin/documents/page').then((mod) => ({ default: mod.AdminDocumentsPage })));
const AdminFinancialPage = lazy(() => import('./app/admin/financial/page').then((mod) => ({ default: mod.AdminFinancialPage })));
const AdminTasksPage = lazy(() => import('./app/admin/tasks/page').then((mod) => ({ default: mod.AdminTasksPage })));
const AdminTeamPage = lazy(() => import('./app/admin/team/page').then((mod) => ({ default: mod.AdminTeamPage })));
const AdminCalendarPage = lazy(() => import('./app/admin/calendar/page').then((mod) => ({ default: mod.AdminCalendarPage })));
const AdminSupportPage = lazy(() => import('./app/admin/support/page'));
const AdminTicketDetailPage = lazy(() => import('./app/admin/support/[ticketId]/page'));
const AdminContactPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminContactPage })));
const AdminVisitPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminVisitPage })));
const AdminCommercialPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminCommercialPage })));
const AdminProposalPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminProposalPage })));
const AdminContractsPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminContractsPage })));
const AdminServicesPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminServicesPage })));
const AdminNdaPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminNdaPage })));
const AdminPlatformPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminPlatformPage })));
const AdminMonthlyPage = lazy(() => import('./modules/vx-admin/components/AdminCommercialPages').then((mod) => ({ default: mod.AdminMonthlyPage })));
const UnifiedFinancialPage = lazy(() => import('./app/admin/financial/UnifiedFinancialPage').then((mod) => ({ default: mod.UnifiedFinancialPage })));
const CrmKanbanPage = lazy(() => import('./modules/crm/CrmKanbanPage').then((mod) => ({ default: mod.CrmKanbanPage })));
const AdminUploadsPage = lazy(() => import('./modules/vx-admin/components/AdminOperationsPages').then((mod) => ({ default: mod.AdminUploadsPage })));
const AdminProcessingPage = lazy(() => import('./modules/vx-admin/components/AdminOperationsPages').then((mod) => ({ default: mod.AdminProcessingPage })));
const AdminLibraryPage = lazy(() => import('./modules/vx-admin/components/AdminOperationsPages').then((mod) => ({ default: mod.AdminLibraryPage })));
const AdminInstallationPage = lazy(() => import('./modules/vx-admin/components/AdminOperationsPages').then((mod) => ({ default: mod.AdminInstallationPage })));

const ClientDashboard = lazy(() => import('./app/client/page').then((mod) => ({ default: mod.ClientDashboard })));
const ClientOnboardingPage = lazy(() => import('./app/client/onboarding/page').then((mod) => ({ default: mod.ClientOnboardingPage })));
const ClientApprovalsPage = lazy(() => import('./app/client/approvals/page').then((mod) => ({ default: mod.ClientApprovalsPage })));
const ClientSupportPage = lazy(() => import('./app/client/support/page').then((mod) => ({ default: mod.ClientSupportPage })));
const ClientTicketDetailPage = lazy(() => import('./app/client/support/[ticketId]/page').then((mod) => ({ default: mod.ClientTicketDetailPage })));
const ClientFinancialPage = lazy(() => import('./app/client/financial/page').then((mod) => ({ default: mod.ClientFinancialPage })));
const ClientDocumentsPage = lazy(() => import('./app/client/documents/page').then((mod) => ({ default: mod.ClientDocumentsPage })));
const ClientAccessPage = lazy(() => import('./modules/vx-client/components/ClientVxPages').then((mod) => ({ default: mod.ClientAccessPage })));
const ClientUploadPage = lazy(() => import('./modules/vx-client/components/ClientVxPages').then((mod) => ({ default: mod.ClientUploadPage })));
const ClientProcessingPage = lazy(() => import('./modules/vx-client/components/ClientVxPages').then((mod) => ({ default: mod.ClientProcessingPage })));
const ClientLibraryPage = lazy(() => import('./modules/vx-client/components/ClientVxPages').then((mod) => ({ default: mod.ClientLibraryPage })));
const ClientInstallationPage = lazy(() => import('./modules/vx-client/components/ClientVxPages').then((mod) => ({ default: mod.ClientInstallationPage })));

// Agência

// Cliente
// ClientGeneralPage e ClientCalendarPage removidos - módulos eliminados

function RootRedirect() {
  const { role, isLoading } = useAuth();
  
  if (isLoading) return <AuthLoadingScreen />; 
  
  if (role === 'admin' || role === 'member') return <Navigate to="/admin" replace />;
  if (role === 'client') return <Navigate to="/client" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  const { setUser, setProfile, finishLoading, clear } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    // Timeout de segurança: se após 8s o auth ainda estiver em loading, forçar finalização
    const authTimeout = setTimeout(() => {
      if (mounted && useAuthStore.getState().isLoading) {
        console.warn('[Auth] Timeout de 8s atingido. Forçando finalização.');
        finishLoading();
      }
    }, 8000);

    const fetchProfile = async (userId: string) => {
      if (!mounted) return;
      console.log('[Auth] Buscando perfil para:', userId);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error('[Auth] Erro ao buscar perfil:', error);
          setProfile(null);
        } else {
          console.log('[Auth] Perfil carregado:', data?.role);
          
          // Se tiver client_id, buscamos os dados do cliente separadamente
          if (data?.client_id) {
            console.log('[Auth] Buscando dados do cliente:', data.client_id);
            const { data: clientData, error: clientError } = await supabase
              .from('clients')
              .select('*')
              .eq('id', data.client_id)
              .maybeSingle();
            
            if (!clientError && clientData) {
              data.client = clientData;
            }
          }
          
          setProfile(data);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[Auth] Erro inesperado ao buscar perfil:', err);
        setProfile(null);
      }
    };

    // Usamos APENAS onAuthStateChange como fonte única de verdade.
    // O evento INITIAL_SESSION é disparado imediatamente ao se inscrever,
    // contendo a sessão restaurada do localStorage (se existir).
    // Isso evita race conditions entre getSession() e onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('[Auth] Evento:', event, session?.user?.email || 'sem sessão');

      switch (event) {
        case 'INITIAL_SESSION': {
          // Sessão restaurada do localStorage no carregamento da página
          if (session?.user) {
            setUser(session.user);
            // Verificar se o profile já foi pré-populado pela LoginPage
            const existingProfile = useAuthStore.getState().profile;
            if (existingProfile && existingProfile.id === session.user.id) {
              console.log('[Auth] Perfil já existe no store, pulando fetch.');
              finishLoading();
            } else {
              await fetchProfile(session.user.id);
              if (mounted) finishLoading();
            }
          } else {
            console.log('[Auth] Nenhuma sessão encontrada no carregamento.');
            clear();
          }
          clearTimeout(authTimeout);
          break;
        }

        case 'SIGNED_IN': {
          if (session?.user) {
            setUser(session.user);
            // Verificar se o profile já foi setado pela LoginPage
            const existingProfile = useAuthStore.getState().profile;
            if (existingProfile && existingProfile.id === session.user.id) {
              console.log('[Auth] Profile já setado pela LoginPage.');
              finishLoading();
            } else {
              await fetchProfile(session.user.id);
              if (mounted) finishLoading();
            }
          }
          clearTimeout(authTimeout);
          break;
        }

        case 'SIGNED_OUT': {
          console.log('[Auth] Usuário deslogou.');
          clear();
          clearTimeout(authTimeout);
          break;
        }

        case 'TOKEN_REFRESHED': {
          // Apenas atualizar o user object, não mexer no profile
          if (session?.user) {
            setUser(session.user);
          }
          break;
        }

        default: {
          // USER_UPDATED, PASSWORD_RECOVERY, etc.
          if (session?.user) {
            setUser(session.user);
          }
          break;
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, [setUser, setProfile, finishLoading, clear]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
      <ErrorBoundary>
        <Suspense fallback={<AuthLoadingScreen />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/crm" element={<CrmKanbanPage />} />
              <Route path="/admin/contact" element={<AdminContactPage />} />
              <Route path="/admin/visit" element={<AdminVisitPage />} />
              <Route path="/admin/commercial" element={<AdminCommercialPage />} />
              <Route path="/admin/proposal" element={<AdminProposalPage />} />
              <Route path="/admin/contracts" element={<AdminContractsPage />} />
              <Route path="/admin/payments" element={<AdminFinancialPage />} />
              <Route path="/admin/financeiro" element={<UnifiedFinancialPage />} />
              <Route path="/admin/services" element={<AdminServicesPage />} />
              <Route path="/admin/nda" element={<AdminNdaPage />} />
              <Route path="/admin/platform" element={<AdminPlatformPage />} />
              <Route path="/admin/monthly" element={<AdminMonthlyPage />} />
              <Route path="/admin/uploads" element={<AdminUploadsPage />} />
              <Route path="/admin/processing" element={<AdminProcessingPage />} />
              <Route path="/admin/library" element={<AdminLibraryPage />} />
              <Route path="/admin/installation" element={<AdminInstallationPage />} />
              <Route path="/admin/support" element={<AdminSupportPage />} />
              <Route path="/admin/support/:ticketId" element={<AdminTicketDetailPage />} />
              <Route path="/admin/clients" element={<AdminClientsPage />} />
              <Route path="/admin/clients/:id" element={<AdminClientDetailPage />} />
              <Route path="/admin/documents" element={<AdminDocumentsPage />} />
              <Route path="/admin/tasks" element={<AdminTasksPage />} />
              <Route path="/admin/team" element={<AdminTeamPage />} />
              <Route path="/admin/calendar" element={<AdminCalendarPage />} />
            </Route>
          </Route>
          
          <Route element={<ProtectedRoute requiredRole="client" />}>
            <Route element={<ClientLayout />}>
              <Route path="/client" element={<ClientDashboard />} />
              <Route path="/client/access" element={<ClientAccessPage />} />
              <Route path="/client/upload" element={<ClientUploadPage />} />
              <Route path="/client/processing" element={<ClientProcessingPage />} />
              <Route path="/client/library" element={<ClientLibraryPage />} />
              <Route path="/client/installation" element={<ClientInstallationPage />} />
              <Route path="/client/onboarding" element={<ClientOnboardingPage />} />
              {/* Calendário do cliente eliminado - vive dentro de Social Media */}
              <Route path="/client/approvals" element={<ClientApprovalsPage />} />
              <Route path="/client/support" element={<ClientSupportPage />} />
              <Route path="/client/support/:ticketId" element={<ClientTicketDetailPage />} />
              <Route path="/client/documents" element={<ClientDocumentsPage />} />
              <Route path="/client/financial" element={<ClientFinancialPage />} />
              {/* Módulo Geral do cliente eliminado */}
            </Route>
          </Route>
          
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
