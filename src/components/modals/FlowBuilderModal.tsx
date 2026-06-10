import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Zap, Settings2, Plus, Trash2, X, Check, Loader2,
  ChevronDown, ChevronUp, GripVertical, ListChecks,
  Eye, Play
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutomationService } from '@/services/automation.service';
import { useAuthStore } from '@/store/authStore';

// ============================================================
// TYPES
// ============================================================
export interface FlowSubtaskDef {
  id: string;
  title: string;
}

export interface FlowStep {
  id: string;
  type: 'trigger' | 'action';
  // -- trigger fields
  trigger?: 'manual' | 'when_client_created';
  // -- action fields
  action?: 'generate_task_group';
  title: string;
  description?: string;
  module?: 'general' | 'onboarding' | 'financial' | 'documents' | 'support';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  stage?: string;
  subtasks?: FlowSubtaskDef[];
}

interface Flow {
  id: string;
  name: string;
  description?: string;
  steps: FlowStep[];
  status: string;
}

interface FlowBuilderModalProps {
  flow: Flow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================
const MODULE_OPTIONS = [
  { value: 'general', label: 'Geral / CRM' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'documents', label: 'Documentos' },
  { value: 'support', label: 'Suporte' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high',   label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const TRIGGER_OPTIONS = [
  { value: 'manual',               label: 'Disparo Manual', desc: 'Acionado manualmente pela equipe' },
  { value: 'when_client_created',  label: 'Cliente Cadastrado', desc: 'Roda automaticamente ao criar cliente' },
];

const STAGE_OPTIONS = [
  { value: 'onboarding_phase_1', label: 'Onboarding — Fase 1' },
  { value: 'onboarding_phase_2', label: 'Onboarding — Fase 2' },
  { value: 'custom',             label: 'Personalizado' },
];

function genId() { return Math.random().toString(36).slice(2, 9); }

// ============================================================
// STEP CARD
// ============================================================
function StepCard({
  step, index, total, flowId,
  onChange, onDelete, onMoveUp, onMoveDown,
}: {
  step: FlowStep; index: number; total: number; flowId: string;
  onChange: (updated: FlowStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [firing, setFiring] = useState(false);
  const [showFireSelector, setShowFireSelector] = useState(false);

  const set = (field: Partial<FlowStep>) => onChange({ ...step, ...field });
  const setSubtask = (subs: FlowSubtaskDef[]) => set({ subtasks: subs });

  useEffect(() => {
    if (showFireSelector) {
      supabase.from('clients').select('id, name').in('status', ['active', 'onboarding'])
        .then(({ data }) => { if (data) setClients(data); });
    }
  }, [showFireSelector]);

  const handleFireStep = async () => {
    if (!selectedClient || !user) return;
    setFiring(true);
    try {
      const { tasksCreated } = await AutomationService.executeFlow(flowId, selectedClient, user.id, step.id);
      toast.success(`✅ Etapa disparada! ${tasksCreated} tarefa(s) criadas.`);
      setShowFireSelector(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao disparar etapa.');
    } finally {
      setFiring(false);
    }
  };

  const addSubtask = () => {
    const subs = step.subtasks || [];
    setSubtask([...subs, { id: genId(), title: '' }]);
  };

  const removeSubtask = (id: string) => {
    setSubtask((step.subtasks || []).filter(s => s.id !== id));
  };

  const updateSubtask = (id: string, title: string) => {
    setSubtask((step.subtasks || []).map(s => s.id === id ? { ...s, title } : s));
  };

  const isTrigger = step.type === 'trigger';

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden transition-all',
      isTrigger 
        ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10' 
        : 'border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10'
    )}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="w-4 h-4 text-muted-foreground/30 cursor-grab shrink-0" />
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
          isTrigger ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
        )}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wider',
              isTrigger ? 'text-green-600' : 'text-blue-600'
            )}>
              {isTrigger ? '⚡ Gatilho' : '⚙️ Ação'}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{step.title || 'Novo step'}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isTrigger && (
            <div className="relative">
              {showFireSelector ? (
                <div className="absolute right-0 top-0 bg-card border border-border shadow-lg rounded-lg p-3 z-50 w-64 flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Disparar para:</p>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Escolher cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-[10px] flex-1" onClick={handleFireStep} disabled={!selectedClient || firing}>
                      {firing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                      Confirmar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setShowFireSelector(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setShowFireSelector(true)}
                  className="p-1 px-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-[10px] font-bold flex items-center gap-1 mr-2"
                >
                  <Play className="w-3 h-3" />
                  Disparar esta Etapa
                </button>
              )}
            </div>
          )}
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button type="button" onClick={() => setCollapsed(v => !v)}
            className="p-1 rounded hover:bg-muted">
            {collapsed
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <button type="button" onClick={onDelete}
            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground/50 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Título do Step</label>
            <Input
              value={step.title}
              onChange={e => set({ title: e.target.value })}
              placeholder="Ex: Gerar tarefas de campanha..."
              className="h-8 text-sm"
            />
          </div>

          {/* TRIGGER TYPE */}
          {isTrigger && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tipo de Gatilho</label>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGER_OPTIONS.map(opt => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => set({ trigger: opt.value as FlowStep['trigger'] })}
                    className={cn(
                      'text-left p-3 rounded-lg border text-xs transition-all',
                      step.trigger === opt.value
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                    )}
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ACTION CONFIG */}
          {!isTrigger && (
            <>
              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nome da Tarefa Principal (Pai)</label>
                <Input
                  value={step.description || ''}
                  onChange={e => set({ description: e.target.value })}
                  placeholder="Ex: Campanha Meta para WhatsApp"
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Module */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Módulo</label>
                  <select
                    value={step.module || 'general'}
                    onChange={e => set({ module: e.target.value as FlowStep['module'] })}
                    className="w-full h-8 text-sm bg-background border border-border rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Prioridade</label>
                  <select
                    value={step.priority || 'medium'}
                    onChange={e => set({ priority: e.target.value as FlowStep['priority'] })}
                    className="w-full h-8 text-sm bg-background border border-border rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Stage */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Fase/Stage (Roadmap do Cliente)</label>
                <select
                  value={step.stage || 'onboarding_phase_1'}
                  onChange={e => set({ stage: e.target.value })}
                  className="w-full h-8 text-sm bg-background border border-border rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Subtasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5" />
                    Subtarefas ({(step.subtasks || []).length})
                  </label>
                  <button
                    type="button" onClick={addSubtask}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(step.subtasks || []).map((sub, si) => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <span className="text-muted-foreground/40 text-xs shrink-0">{si + 1}.</span>
                      <Input
                        value={sub.title}
                        onChange={e => updateSubtask(sub.id, e.target.value)}
                        placeholder="Título da subtarefa..."
                        className="h-7 text-xs flex-1"
                      />
                      <button type="button" onClick={() => removeSubtask(sub.id)}
                        className="text-muted-foreground/30 hover:text-red-500 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(step.subtasks || []).length === 0 && (
                    <p className="text-xs text-muted-foreground/60 text-center py-2">
                      Nenhuma subtarefa. Clique em "Adicionar".
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FLOW BUILDER MODAL
// ============================================================
export function FlowBuilderModal({ flow, open, onOpenChange, onSaved }: FlowBuilderModalProps) {
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (open && flow) {
      setSteps(flow.steps || []);
      setName(flow.name || '');
      setDescription(flow.description || '');
      setPreview(false);
    }
  }, [open, flow]);

  const addTrigger = () => {
    setSteps(prev => [
      ...prev,
      { id: genId(), type: 'trigger', title: 'Gatilho', trigger: 'manual' }
    ]);
  };

  const addAction = () => {
    setSteps(prev => [
      ...prev,
      {
        id: genId(), type: 'action', action: 'generate_task_group',
        title: 'Nova Ação', description: '', module: 'general',
        priority: 'medium', stage: 'onboarding_phase_1', subtasks: [],
      }
    ]);
  };

  const updateStep = (index: number, updated: FlowStep) => {
    setSteps(prev => prev.map((s, i) => i === index ? updated : s));
  };

  const deleteStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setSteps(prev => {
      const arr = [...prev];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  };

  const handleSave = async () => {
    if (!flow) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('flows')
        .update({ name, description, steps })
        .eq('id', flow.id);
      if (error) throw error;
      toast.success('Fluxo salvo!');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar fluxo.');
    } finally {
      setSaving(false);
    }
  };

  if (!flow) return null;

  // Preview: count tasks/subtasks that would be generated
  const actionSteps = steps.filter(s => s.type === 'action');
  const totalTasks = actionSteps.length;
  const totalSubs = actionSteps.reduce((acc, s) => acc + (s.subtasks?.length || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[92vh] overflow-hidden p-0 gap-0 rounded-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">Configurar Fluxo</h2>
              <p className="text-xs text-muted-foreground/70">{flow.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreview(v => !v)}>
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              {preview ? 'Editor' : 'Preview'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 130px)' }}>

          {preview ? (
            /* ── PREVIEW ── */
            <div className="px-6 py-6">
              <div className="bg-muted/30 rounded-xl p-5 border border-border">
                <h3 className="font-bold text-foreground mb-1">{name || 'Sem título'}</h3>
                <p className="text-sm text-muted-foreground mb-4">{description}</p>
                <div className="flex gap-4 mb-6">
                  <div className="bg-card rounded-lg p-3 border border-border text-center min-w-[100px]">
                    <p className="text-2xl font-bold text-blue-600">{totalTasks}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">tarefas pai</p>
                  </div>
                  <div className="bg-card rounded-lg p-3 border border-border text-center min-w-[100px]">
                    <p className="text-2xl font-bold text-violet-600">{totalSubs}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">subtarefas</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                        step.type === 'trigger' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{step.title}</p>
                        {step.type === 'trigger' && (
                          <p className="text-xs text-muted-foreground">
                            Gatilho: {step.trigger === 'manual' ? 'Manual' : 'Ao criar cliente'}
                          </p>
                        )}
                        {step.type === 'action' && step.description && (
                          <p className="text-xs text-muted-foreground">Tarefa: "{step.description}"</p>
                        )}
                        {(step.subtasks || []).length > 0 && (
                          <ul className="mt-1 space-y-0.5 pl-3 border-l-2 border-border">
                            {step.subtasks!.map(s => (
                              <li key={s.id} className="text-xs text-muted-foreground">• {s.title}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── EDITOR ── */
            <div className="px-6 py-5 space-y-5">
              {/* Flow metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nome do Fluxo</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome..." className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Descrição</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Objetivo do fluxo..." className="h-9" />
                </div>
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground">
                    Steps do Fluxo ({steps.length})
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addTrigger} className="text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10">
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      + Gatilho
                    </Button>
                    <Button variant="outline" size="sm" onClick={addAction} className="text-blue-500 border-blue-500/20 hover:bg-blue-500/10">
                      <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                      + Ação
                    </Button>
                  </div>
                </div>

                {steps.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-border rounded-xl text-muted-foreground/50">
                    <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Nenhum step ainda.</p>
                    <p className="text-xs mt-1">Adicione um Gatilho e depois Ações de geração de tarefas.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {steps.map((step, i) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        index={i}
                        total={steps.length}
                        flowId={flow.id}
                        onChange={updated => updateStep(i, updated)}
                        onDelete={() => deleteStep(i)}
                        onMoveUp={() => moveStep(i, -1)}
                        onMoveDown={() => moveStep(i, 1)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <p className="text-xs text-primary font-medium">💡 Como funciona</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adicione um <strong>Gatilho</strong> para definir quando o fluxo será acionado, depois adicione <strong>Ações</strong> para cada grupo de tarefas que deverá ser gerado. Ao disparar para um cliente, todas as tarefas são criadas automaticamente no Kanban da equipe e no Roadmap do cliente.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border px-6 py-3 bg-card flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {totalTasks > 0 && (
              <span>Este fluxo irá gerar <strong>{totalTasks}</strong> tarefa(s) pai e <strong>{totalSubs}</strong> subtarefa(s).</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Salvar Fluxo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
