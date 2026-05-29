import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Loader2, LayoutGrid, List, Milestone } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { ClientModuleTasksView } from '@/components/modules/ClientModuleTasksView';
import { supabase } from '../../../services/supabase';
import { OnboardingVXSteps } from '../../../modules/onboarding/components/OnboardingVXSteps';
import { CompletionScreen } from '../../../modules/onboarding/components/CompletionScreen';
import { toast } from 'sonner';
import type { Client } from '../../../types/client.types';
import { NotificationService } from '../../../services/notification.service';

export function ClientOnboardingPage() {
  const { clientId } = useAuthStore();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get('view') as 'roadmap' | 'kanban' | 'list' | null;
  const [viewMode, setViewMode] = useState<'roadmap' | 'kanban' | 'list'>(viewParam || 'roadmap');

  const loadData = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      // Busca dados do cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData as Client);
    } catch (err: unknown) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados do onboarding.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadData();
    
    // Marcar notificações como lidas ao entrar na página
    if (clientId) {
      NotificationService.markAsReadByType(clientId, 'task');
    }
  }, [loadData, clientId]);


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p>Carregando seu roadmap...</p>
      </div>
    );
  }

  if (client?.onboarding_completed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Estratégia Concluída" description="Todas as etapas foram finalizadas." />
        <CompletionScreen clientName={client.name || 'Cliente'} />
      </div>
    );
  }



  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Plano Estratégico"
          description="Acompanhe cada etapa da implementação dos seus serviços."
        />
        
        <div className="flex bg-muted p-1 rounded-lg shrink-0 border border-border">
          <button
            onClick={() => setViewMode('roadmap')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'roadmap' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Milestone className="w-3.5 h-3.5" />
            Timeline
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'kanban' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Kanban
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Lista
          </button>
        </div>
      </div>

      <div className="mt-6">
        {viewMode === 'roadmap' ? (
          <OnboardingVXSteps clientId={clientId || ''} />
        ) : (
          <ClientModuleTasksView module="onboarding" view={viewMode === 'kanban' ? 'kanban' : 'list'} />
        )}
      </div>
    </div>
  );
}
