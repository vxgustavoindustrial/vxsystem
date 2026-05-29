import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Zap, Settings2, Play, Plus, Loader2, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { FlowCreateModal } from "@/components/modals/FlowCreateModal";
import { FlowBuilderModal } from "@/components/modals/FlowBuilderModal";
import { AutomationService } from "@/services/automation.service";
import { useAuthStore } from "@/store/authStore";

import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Tipo local com steps para uso nos componentes desta página
type LocalFlow = {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  steps: Array<Record<string, unknown>>;
  created_at: string;
  updated_at?: string;
};

// ============================================================
// Fire Modal — selector de cliente para disparar fluxo
// ============================================================
function FireFlowModal({
  flow, open, onOpenChange, onFired,
}: { flow: LocalFlow | null; open: boolean; onOpenChange: (v: boolean) => void; onFired: () => void; }) {
  const { user } = useAuthStore();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [firing, setFiring] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedClient('');
      supabase.from('clients').select('id, name').in('status', ['active', 'onboarding'])
        .then(({ data }) => { if (data) setClients(data); });
    }
  }, [open]);

  const handleFire = async () => {
    if (!flow || !selectedClient || !user) return;
    setFiring(true);
    try {
      const { tasksCreated } = await AutomationService.executeFlow(flow.id, selectedClient, user.id);
      toast.success(`✅ Fluxo disparado! ${tasksCreated} tarefa(s) criadas para o cliente.`);
      onFired();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao disparar fluxo.');
    } finally {
      setFiring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Disparar Fluxo para Cliente</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-3">
            Selecione o cliente que receberá as tarefas geradas pelo fluxo <strong>"{flow?.name}"</strong>.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-4 border border-amber-500/20">
            ⚠️ As tarefas existentes nos mesmos stages serão substituídas.
          </p>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleFire} disabled={!selectedClient || firing}>
            {firing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Disparar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// FLOW CARD
// ============================================================
function FlowCard({
  flow, onConfigure, onFire, onToggleStatus,
}: {
  flow: LocalFlow;
  onConfigure: () => void;
  onFire: () => void;
  onToggleStatus: () => void;
}) {
  const isActive = flow.is_active;
  const stepsArr = Array.isArray(flow.steps) ? flow.steps as Array<Record<string, unknown>> : [];
  const actionCount = stepsArr.filter(s => s.type === 'action').length;
  const subCount = stepsArr
    .filter(s => s.type === 'action')
    .reduce((acc, s) => acc + ((s.subtasks as unknown[])?.length || 0), 0);

  return (
    <div className={cn(
      'bg-card rounded-xl border p-5 hover:shadow-md transition-all group',
      isActive ? 'border-green-500/30' : 'border-border'
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            isActive ? 'bg-green-500/10' : 'bg-muted'
          )}>
            <Zap className={cn('w-5 h-5', isActive ? 'text-green-500' : 'text-muted-foreground')} />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{flow.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{flow.description || 'Sem descrição'}</p>
          </div>
        </div>
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shrink-0',
          isActive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'
        )}>
          {isActive ? 'Ativo' : 'Rascunho'}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Settings2 className="w-3.5 h-3.5" />
          <span>{actionCount} ação{actionCount !== 1 ? 'ões' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{subCount} subtarefa{subCount !== 1 ? 's' : ''}</span>
        </div>
        {flow.updated_at && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 ml-auto">
            <Clock className="w-3 h-3" />
            <span>{format(new Date(flow.updated_at), "dd/MM/yy", { locale: ptBR })}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <Button variant="outline" size="sm" className="flex-1" onClick={onConfigure}>
          <Settings2 className="w-3.5 h-3.5 mr-1.5" />
          Configurar
        </Button>
        <Button
          size="sm"
          className={cn('flex-1', isActive ? 'bg-green-600 hover:bg-green-700 text-white' : '')}
          onClick={onFire}
          disabled={!isActive}
          title={!isActive ? 'Ative o fluxo para disparar' : 'Disparar para um cliente'}
        >
          <Play className="w-3.5 h-3.5 mr-1.5" />
          Disparar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleStatus}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {isActive ? 'Pausar' : 'Ativar'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export function AgencyFlowsPage() {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [builderFlow, setBuilderFlow] = useState<LocalFlow | null>(null);
  const [fireFlow, setFireFlow] = useState<LocalFlow | null>(null);
  const [flows, setFlows] = useState<LocalFlow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('flows')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setFlows(data as unknown as LocalFlow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => { await fetchFlows(); };
    if (mounted) { void load(); }
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = async (id: string, currentIsActive: boolean) => {
    const newStatus = !currentIsActive;
    const { error } = await supabase.from('flows').update({ is_active: newStatus }).eq('id', id);
    if (error) { toast.error('Erro ao alternar status.'); }
    else { toast.success(`Fluxo ${newStatus ? 'ativado' : 'pausado'}!`); fetchFlows(); }
  };

  const activeFlows = flows.filter(f => f.is_active);
  const draftFlows = flows.filter(f => !f.is_active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <PageHeader
          title="Automações & Fluxos"
          description="Crie fluxos que geram tarefas automaticamente para qualquer cliente."
        />
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Fluxo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de Fluxos', value: flows.length, color: 'text-foreground' },
          { label: 'Ativos', value: activeFlows.length, color: 'text-green-500' },
          { label: 'Rascunhos', value: draftFlows.length, color: 'text-amber-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-card rounded-xl border border-border p-4 text-center">
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-4">
        <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1">💡 Como usar os Fluxos</h4>
        <p className="text-xs text-blue-600 dark:text-blue-400/80">
          1. Crie um fluxo e configure os <strong>Steps</strong> com as tarefas que devem ser geradas.
          2. Ative o fluxo e clique em <strong>Disparar</strong> para aplicá-lo a um cliente.
          3. As tarefas aparecem automaticamente no <strong>Kanban da equipe</strong> e no <strong>Roadmap do cliente</strong>.
        </p>
      </div>

      {/* Flow list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Carregando fluxos...</span>
        </div>
      ) : flows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Nenhum fluxo criado.</p>
          <p className="text-sm mt-1">Clique em "Novo Fluxo" para começar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeFlows.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-3">Ativos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeFlows.map(flow => (
                  <FlowCard
                    key={flow.id}
                    flow={flow}
                    onConfigure={() => setBuilderFlow(flow)}
                    onFire={() => setFireFlow(flow)}
                    onToggleStatus={() => toggleStatus(flow.id, flow.is_active)}
                  />
                ))}
              </div>
            </div>
          )}
          {draftFlows.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-3">Rascunhos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {draftFlows.map(flow => (
                  <FlowCard
                    key={flow.id}
                    flow={flow}
                    onConfigure={() => setBuilderFlow(flow)}
                    onFire={() => setFireFlow(flow)}
                    onToggleStatus={() => toggleStatus(flow.id, flow.is_active)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <FlowCreateModal
        open={isCreateModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={fetchFlows}
      />

      <FlowBuilderModal
        flow={builderFlow as unknown as React.ComponentProps<typeof FlowBuilderModal>['flow']}
        open={!!builderFlow}
        onOpenChange={v => { if (!v) setBuilderFlow(null); }}
        onSaved={fetchFlows}
      />

      <FireFlowModal
        flow={fireFlow}
        open={!!fireFlow}
        onOpenChange={v => { if (!v) setFireFlow(null); }}
        onFired={fetchFlows}
      />
    </div>
  );
}
