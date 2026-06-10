import { useEffect, useState, type ElementType } from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Rocket,
  Settings2,
  Megaphone,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import type { Task } from '@/types/general.types';
import { cn } from '@/lib/utils';
import { supabase } from '@/services/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OnboardingRoadmapProps {
  tasks: Task[];
  onToggleSubtask?: (subtaskId: string, currentStatus: string) => void;
  readOnly?: boolean;
}

const MODULE_CONFIG: Record<string, { icon: ElementType; color: string; gradient: string; label: string }> = {
  general: {
    icon: Settings2,
    color: 'text-sky-400',
    gradient: 'from-sky-500/20 to-sky-900/10',
    label: 'Operacional',
  },
  onboarding: {
    icon: Rocket,
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-blue-900/10',
    label: 'Onboarding',
  },
  financial: {
    icon: Megaphone,
    color: 'text-amber-400',
    gradient: 'from-amber-500/20 to-amber-900/10',
    label: 'Financeiro',
  },
  documents: {
    icon: MessageSquare,
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-emerald-900/10',
    label: 'Documentos',
  },
  support: {
    icon: Loader2,
    color: 'text-violet-400',
    gradient: 'from-violet-500/20 to-violet-900/10',
    label: 'Suporte',
  },
};

function getPhaseLabel(stage: string) {
  if (stage === 'onboarding_access') return 'Acesso a Area do Cliente';
  if (stage === 'onboarding_upload') return 'Upload dos Arquivos';
  if (stage === 'onboarding_processing') return 'Processamento de Dados';
  if (stage === 'onboarding_delivery') return 'Download dos Arquivos';
  if (stage === 'onboarding_installation') return 'Instalacao no Oculos';
  if (stage === 'onboarding_phase_1') return 'Fase 1 - Setup Inicial';
  if (stage === 'onboarding_phase_2') return 'Fase 2 - Escalabilidade';
  if (stage === 'unknown') return 'Atividades Complementares';
  return stage;
}

export function OnboardingRoadmap({ tasks, onToggleSubtask, readOnly = false }: OnboardingRoadmapProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string, { id: string; content: string; created_at: string; author: string }[]>>({});

  useEffect(() => {
    const parentIds = tasks.filter(t => !t.parent_id).map(t => t.id);
    if (parentIds.length === 0) return;

    const loadComments = async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('id, content, created_at, task_id, author:profiles!task_comments_author_id_fkey(full_name)')
        .in('task_id', parentIds)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const map: Record<string, { id: string; content: string; created_at: string; author: string }[]> = {};
        for (const c of data as Record<string, unknown>[]) {
          const taskId = c.task_id as string;
          if (!map[taskId]) map[taskId] = [];
          map[taskId].push({
            id: c.id as string,
            content: c.content as string,
            created_at: c.created_at as string,
            author: (c.author as { full_name: string } | null)?.full_name || 'Equipe',
          });
        }
        setCommentsMap(map);
      }
    };

    void loadComments();
  }, [tasks]);

  const parentTasks = tasks.filter(t => !t.parent_id);
  const subtasksMap = new Map<string, Task[]>();
  tasks.filter(t => t.parent_id).forEach(t => {
    const existing = subtasksMap.get(t.parent_id!) || [];
    existing.push(t);
    subtasksMap.set(t.parent_id!, existing);
  });

  const stages = [...new Set(parentTasks.map(t => t.stage || 'unknown'))];

  const toggleExpand = (taskId: string) => {
    setExpanded(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleStatus = async (task: Task) => {
    if (readOnly || !onToggleSubtask) return;
    onToggleSubtask(task.id, task.status);
  };

  return (
    <div className="space-y-8">
      {stages.map((stage) => {
        const stageTasks = parentTasks.filter(t => (t.stage || 'unknown') === stage);
        const title = getPhaseLabel(stage);

        return (
          <section key={stage} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
            </div>

            <div className="space-y-3">
              {stageTasks.map((task) => {
                const subtasks = subtasksMap.get(task.id) || [];
                const completedSubtasks = subtasks.filter(subtask => subtask.status === 'done').length;
                const progress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;
                const config = MODULE_CONFIG[task.module || 'general'] || MODULE_CONFIG.general;
                const comments = commentsMap[task.id] || [];
                const isExpanded = !!expanded[task.id];
                const canEdit = !readOnly;

                return (
                  <div key={task.id} className={cn('rounded-2xl border bg-card shadow-sm transition-all', `bg-gradient-to-br ${config.gradient}`)}>
                    <button type="button" className="flex w-full items-center justify-between gap-4 p-4 text-left" onClick={() => toggleExpand(task.id)}>
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/80', config.color)}>
                          <config.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{config.label}</p>
                          <h4 className="text-base font-semibold">{task.title}</h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="text-xs font-medium">{progress}%</span>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="space-y-4 border-t px-4 pb-4 pt-3">
                        {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl bg-background/70 p-3 text-sm">
                            <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">Prazo</span>
                            <span>{task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Sem prazo'}</span>
                          </div>
                          <div className="rounded-xl bg-background/70 p-3 text-sm">
                            <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</span>
                            <span>{task.status}</span>
                          </div>
                        </div>

                        {subtasks.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold">Subtarefas</p>
                            {subtasks.map((subtask) => {
                              const done = subtask.status === 'done';
                              return (
                                <button
                                  key={subtask.id}
                                  type="button"
                                  onClick={() => toggleStatus(subtask)}
                                  className={cn(
                                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                                    done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-background/60',
                                    canEdit && 'hover:border-primary/40'
                                  )}
                                >
                                  {done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                                  <span className={cn('text-sm', done && 'line-through text-muted-foreground')}>{subtask.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {comments.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold">Comentários</p>
                            {comments.map((comment) => (
                              <div key={comment.id} className="rounded-xl border bg-background/60 p-3 text-sm">
                                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                  <span>{comment.author}</span>
                                  <span>{format(new Date(comment.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                                </div>
                                <p>{comment.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
