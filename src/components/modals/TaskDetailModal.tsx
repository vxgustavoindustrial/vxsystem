import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CheckSquare, Square, Loader2, Send, MessageSquare,
  Clock, User, Tag, ListChecks, X, Plus, Trash2,
  ChevronDown, Pencil, Check
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================
// TYPES
// ============================================================
export interface TaskData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date?: string;
  module: string;
  client_id?: string;
  stage?: string;
  parent_id?: string | null;
  clients?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

export interface SubtaskData {
  id: string;
  title: string;
  description?: string;
  status: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: { full_name: string } | null;
}

interface TaskDetailModalProps {
  task: TaskData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtasks?: SubtaskData[];
  onSubtaskToggle?: (subtaskId: string, newStatus: string) => void;
  onTaskUpdated?: () => void;
  onTaskDeleted?: (taskId: string) => void;
  readOnly?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================
const STATUS_OPTIONS = [
  { value: 'todo',        label: 'A Fazer',      bg: 'bg-slate-100 dark:bg-slate-800',   text: 'text-slate-700 dark:text-slate-300' },
  { value: 'in_progress', label: 'Em Progresso',  bg: 'bg-blue-100 dark:bg-blue-900/30',  text: 'text-blue-700 dark:text-blue-400' },
  { value: 'review',      label: 'Revisão',       bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  { value: 'done',        label: 'Concluído',     bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Baixa',   bg: 'bg-slate-100 dark:bg-slate-800',  text: 'text-slate-600 dark:text-slate-400' },
  { value: 'medium', label: 'Média',   bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 'high',   label: 'Alta',    bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  { value: 'urgent', label: 'Urgente', bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-700 dark:text-red-400' },
];

const MODULE_OPTIONS = [
  { value: 'general', label: 'Geral',           bg: 'bg-slate-100 dark:bg-slate-800',   text: 'text-slate-700 dark:text-slate-300' },
  { value: 'onboarding', label: 'Onboarding',   bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  { value: 'approvals', label: 'Aprovações',    bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  { value: 'financial', label: 'Financeiro',    bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  { value: 'documents', label: 'Documentos',    bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
  { value: 'support', label: 'Suporte',         bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400' },
];

// ============================================================
// INLINE EDIT FIELD (click-to-edit)
// ============================================================
function InlineEdit({
  value, onSave, multiline = false,
  placeholder = 'Clique para editar...', className = '',
  readOnly = false,
}: {
  value: string; onSave: (v: string) => Promise<void>; multiline?: boolean;
  placeholder?: string; className?: string; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = async () => {
    if (draft.trim() === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    const commonProps = {
      ref: ref as React.RefObject<HTMLInputElement & HTMLTextAreaElement>,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: save,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') cancel();
        if (e.key === 'Enter' && !multiline) save();
        if (e.key === 'Enter' && multiline && e.ctrlKey) save();
      },
      className: cn('text-sm bg-background border border-primary/30 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-primary/20', className),
      disabled: saving,
    };

    return multiline
      ? <textarea {...commonProps} rows={3} ref={ref as React.RefObject<HTMLTextAreaElement>} />
      : <input {...commonProps} type="text" ref={ref as React.RefObject<HTMLInputElement>} />;
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-1 rounded px-1 -mx-1 transition-colors',
        !readOnly && 'cursor-pointer hover:bg-accent/50',
        className
      )}
      onClick={() => !readOnly && setEditing(true)}
    >
      <span className={cn('flex-1 min-w-0', !value && 'text-muted-foreground italic text-sm')}>
        {value || placeholder}
      </span>
      {!readOnly && <Pencil className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </div>
  );
}

// ============================================================
// DROPDOWN SELECT (Badge-style)
// ============================================================
function BadgeSelect({
  options, value, onSelect, readOnly = false
}: {
  options: { value: string; label: string; bg: string; text: string }[];
  value: string;
  onSelect: (v: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = options.find(o => o.value === value) || options[0];

  const handle = async (v: string) => {
    if (v === value) { setOpen(false); return; }
    setSaving(true);
    await onSelect(v);
    setSaving(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !readOnly && setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full transition-opacity',
          !readOnly && 'cursor-pointer',
          current.bg, current.text, saving && 'opacity-60 pointer-events-none'
        )}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : current.label}
        {!readOnly && <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2 transition-colors',
                opt.value === value && 'font-semibold'
              )}
              onClick={() => handle(opt.value)}
            >
              <span className={cn('w-2 h-2 rounded-full', opt.bg.split(' ')[0].replace('bg-', 'bg-').replace('-100', '-400'))} />
              {opt.label}
              {opt.value === value && <Check className="w-3 h-3 ml-auto text-emerald-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export function TaskDetailModal({
  task: initialTask, open, onOpenChange, subtasks: initialSubtasks = [],
  onSubtaskToggle, onTaskUpdated, onTaskDeleted, readOnly = false
}: TaskDetailModalProps) {
  const { user } = useAuthStore();

  // Local mutable copy of task fields
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  // Local mutable subtasks (so we can add/delete without re-fetching parent)
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([]);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New subtask field
  const [newSubTitle, setNewSubTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);

  // Sync fresh data from parent
  useEffect(() => {
    if (open && initialTask) {
      // Usamos uma verificação simples para evitar loops: só atualizamos se o ID mudou
      // ou se o estado interno ainda está vazio.
      if (!taskData || taskData.id !== initialTask.id) {
        setTaskData({ ...initialTask });
        setSubtasks([...(initialSubtasks || [])]);
      }
    }
    
    if (!open) {
      setTaskData(null);
      setSubtasks([]);
      setComments([]);
      setNewComment('');
      setShowAddSubtask(false);
      setNewSubTitle('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTask?.id]);

  // ---- Comments ----
  const loadComments = useCallback(async () => {
    if (!taskData) return;
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('id, content, created_at, author:profiles!task_comments_author_id_fkey(full_name)')
        .eq('task_id', taskData.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments((data || []).map((c: Record<string, unknown>) => ({
        id: c.id as string, content: c.content as string,
        created_at: c.created_at as string,
        author: c.author as { full_name: string } | null,
      })));
    } catch (error) { 
      console.error('Task detail error:', error);
      /* silent */ 
    }
    finally { setLoadingComments(false); }
  }, [taskData]);

  useEffect(() => {
    if (open && taskData) loadComments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskData?.id]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !taskData || !user) return;
    setSendingComment(true);
    try {
      const { error } = await supabase.from('task_comments').insert({
        task_id: taskData.id, author_id: user.id, content: newComment.trim(),
      });
      if (error) throw error;
      setNewComment('');
      await loadComments();
      toast.success('Nota adicionada!');
    } catch (error) { 
      console.error('Note add error:', error);
      toast.error('Não foi possível enviar a nota.'); 
    }
    finally { setSendingComment(false); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Excluir esta nota permanentemente?')) return;
    
    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', commentId);
      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Nota removida.');
    } catch (error) {
      console.error('Remove comment error:', error);
      toast.error('Não foi possível excluir a nota.');
    }
  };

  // ---- Task field updates ----
  const updateTaskField = async (field: string, value: string) => {
    if (!taskData) return;
    
    const updatePayload: Record<string, unknown> = { [field]: value, updated_at: new Date().toISOString() };
    
    // Se o campo é status e o novo valor é 'done', registrar completed_at
    if (field === 'status' && value === 'done') {
      updatePayload.completed_at = new Date().toISOString();
    }
    // Se o campo é status e o novo valor NÃO é 'done', limpar completed_at
    if (field === 'status' && value !== 'done') {
      updatePayload.completed_at = null;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskData.id);
    
    if (error) { 
      toast.error('Erro ao salvar.'); 
      return; 
    }

    // Se mudarmos o módulo ou cliente, propagamos para as subtarefas para garantir a "integração 100%"
    if (field === 'module' || field === 'client_id') {
      await supabase
        .from('tasks')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('parent_id', taskData.id);
    }

    // Se marcou como 'done', também completar todas as subtarefas pendentes
    if (field === 'status' && value === 'done' && subtasks.length > 0) {
      const pendingSubs = subtasks.filter(s => s.status !== 'done');
      if (pendingSubs.length > 0) {
        const pendingIds = pendingSubs.map(s => s.id);
        await supabase
          .from('tasks')
          .update({ status: 'done', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in('id', pendingIds);
        setSubtasks(prev => prev.map(s => pendingIds.includes(s.id) ? { ...s, status: 'done' } : s));
        toast.success(`${pendingSubs.length} subtarefa(s) concluída(s) automaticamente!`);
      }
    }

    setTaskData(prev => prev ? { ...prev, [field]: value } : prev);
    onTaskUpdated?.();
  };

  // ---- Subtask toggle ----
  const handleToggle = async (subId: string, currentStatus: string) => {
    setTogglingId(subId);
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    const payload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'done') payload.completed_at = new Date().toISOString();
    else payload.completed_at = null;
    try {
      const { error } = await supabase.from('tasks').update(payload).eq('id', subId);
      if (error) throw error;
      
      const updatedSubtasks = subtasks.map(s => s.id === subId ? { ...s, status: newStatus } : s);
      setSubtasks(updatedSubtasks);
      onSubtaskToggle?.(subId, newStatus);

      // Se a subtarefa foi marcada como 'done', verificar se todas agora estão 'done'
      if (newStatus === 'done' && updatedSubtasks.length > 0) {
        const allDone = updatedSubtasks.every(s => s.status === 'done');
        if (allDone) {
          await updateTaskField('status', 'done');
          toast.success('Todas as subtarefas concluídas! Tarefa pai finalizada.');
        }
      }
      
      onTaskUpdated?.();
    } catch (error) { 
      console.error('Update task error:', error);
      toast.error('Não foi possível atualizar.'); 
    }
    finally { setTogglingId(null); }
  };

  // ---- Subtask title edit ----
  const handleEditSubtaskTitle = async (subId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from('tasks').update({ title: newTitle.trim(), updated_at: new Date().toISOString() }).eq('id', subId);
    if (error) { toast.error('Erro ao salvar.'); return; }
    setSubtasks(prev => prev.map(s => s.id === subId ? { ...s, title: newTitle.trim() } : s));
    onTaskUpdated?.();
  };

  // ---- Add subtask ----
  const handleAddSubtask = async () => {
    if (!newSubTitle.trim() || !taskData || !user) return;
    setAddingSubtask(true);
    try {
      const { data, error } = await supabase.from('tasks').insert({
        title: newSubTitle.trim(),
        parent_id: taskData.id,
        client_id: taskData.client_id,
        module: taskData.module,
        stage: taskData.stage,
        status: 'todo',
        priority: 'medium',
        created_by: user.id,
      }).select('id, title, status').single();
      if (error) throw error;
      setSubtasks(prev => [...prev, { id: data.id, title: data.title, status: data.status }]);
      setNewSubTitle('');
      toast.success('Subtarefa adicionada!');
      onTaskUpdated?.();
    } catch (error) { 
      console.error('Add checklist item error:', error);
      toast.error('Não foi possível adicionar.'); 
    }
    finally { setAddingSubtask(false); }
  };

  // ---- Delete subtask ----
  const handleDeleteSubtask = async (subId: string) => {
    setDeletingId(subId);
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', subId);
      if (error) throw error;
      setSubtasks(prev => prev.filter(s => s.id !== subId));
      toast.success('Subtarefa removida.');
      onTaskUpdated?.();
    } catch (error) { 
      console.error('Remove checklist item error:', error);
      toast.error('Não foi possível remover.'); 
    }
    finally { setDeletingId(null); }
  };

  // ---- Delete entire task ----
  const handleDeleteTask = async () => {
    if (!taskData) return;
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa e todas as suas subtarefas? Esta ação não pode ser desfeita.')) return;
    
    setDeletingTask(true);
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskData.id);
      if (error) throw error;
      toast.success('Tarefa excluída com sucesso!');
      onOpenChange(false);
      onTaskDeleted?.(taskData.id);
      onTaskUpdated?.();
    } catch (error) {
      console.error('Final task check error:', error);
      toast.error('Erro ao excluir a tarefa.');
    } finally {
      setDeletingTask(false);
    }
  };

  if (!taskData) return null;

  const completedSubs = subtasks.filter(s => s.status === 'done').length;
  const progressPct = subtasks.length > 0 ? Math.round((completedSubs / subtasks.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[740px] max-h-[92vh] overflow-hidden p-0 gap-0 rounded-xl">

        {/* ── HEADER ── */}
        <div className="px-6 pt-5 pb-4 border-b border-border bg-card">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">

              {/* Status + Priority + Module badges */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <BadgeSelect
                  options={STATUS_OPTIONS}
                  value={taskData.status}
                  onSelect={v => updateTaskField('status', v)}
                  readOnly={readOnly}
                />
                <BadgeSelect
                  options={PRIORITY_OPTIONS}
                  value={taskData.priority}
                  onSelect={v => updateTaskField('priority', v)}
                  readOnly={readOnly}
                />
                <BadgeSelect
                  options={MODULE_OPTIONS}
                  value={taskData.module || 'general'}
                  onSelect={v => updateTaskField('module', v)}
                  readOnly={readOnly}
                />
              </div>

              {/* Editable title */}
              <InlineEdit
                value={taskData.title}
                onSave={v => updateTaskField('title', v)}
                placeholder="Título da tarefa..."
                className="text-lg font-bold text-foreground leading-tight"
                readOnly={readOnly}
              />

              {/* Editable description */}
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
                <InlineEdit
                  value={taskData.description || ''}
                  onSave={v => updateTaskField('description', v)}
                  multiline
                  placeholder="Adicione uma descrição..."
                  readOnly={readOnly}
                />
              </div>
            </div>

            {/* Close */}
            <Button variant="ghost" size="icon" className="shrink-0 -mt-0.5 -mr-1" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
            {taskData.clients?.name && (
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>{taskData.clients.name}</span>
              </div>
            )}
            {taskData.profiles?.full_name && (
              <div className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                <span>{taskData.profiles.full_name}</span>
              </div>
            )}
            {taskData.due_date && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{format(new Date(taskData.due_date), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 200px)' }}>

          {/* ─ SUBTAREFAS ─ */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Subtarefas</h3>
                {subtasks.length > 0 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {completedSubs}/{subtasks.length} · {progressPct}%
                  </span>
                )}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowAddSubtask(v => !v)}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              )}
            </div>

            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct === 100
                      ? 'linear-gradient(90deg,#22c55e,#10b981)'
                      : 'linear-gradient(90deg,#3b82f6,#6366f1)',
                  }}
                />
              </div>
            )}

            {/* Subtask list */}
            <div className="space-y-0.5">
              {subtasks.map(sub => {
                const isDone = sub.status === 'done';
                const isToggling = togglingId === sub.id;
                const isDeleting = deletingId === sub.id;

                return (
                  <div
                    key={sub.id}
                    className={cn(
                      'flex items-center gap-2 py-1.5 px-2 rounded-lg group transition-colors',
                      isDone ? 'opacity-60' : 'hover:bg-accent/50'
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      className="shrink-0 focus:outline-none"
                      onClick={() => !readOnly && !isToggling && !isDeleting && handleToggle(sub.id, sub.status)}
                      disabled={readOnly || isToggling || isDeleting}
                    >
                      {isToggling ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      ) : isDone ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
                      )}
                    </button>

                    {/* Editable title */}
                    <div className="flex-1 min-w-0">
                      <InlineEdit
                        value={sub.title}
                        onSave={v => handleEditSubtaskTitle(sub.id, v)}
                        className={cn(isDone ? 'text-muted-foreground line-through' : 'text-foreground')}
                        readOnly={readOnly}
                      />
                    </div>

                    {/* Delete */}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(sub.id)}
                        disabled={isDeleting}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
                        title="Remover subtarefa"
                      >
                        {isDeleting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                          : <Trash2 className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-red-400 transition-colors" />
                        }
                      </button>
                    )}
                  </div>
                );
              })}

              {subtasks.length === 0 && !showAddSubtask && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Nenhuma subtarefa. Clique em "Adicionar" para criar.
                </p>
              )}
            </div>

            {/* Add subtask input */}
            {showAddSubtask && (
              <div className="flex items-center gap-2 mt-2 pl-6">
                <Input
                  autoFocus
                  value={newSubTitle}
                  onChange={e => setNewSubTitle(e.target.value)}
                  placeholder="Título da subtarefa..."
                  className="h-8 text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddSubtask();
                    if (e.key === 'Escape') { setShowAddSubtask(false); setNewSubTitle(''); }
                  }}
                  disabled={addingSubtask}
                />
                <Button
                  size="sm"
                  className="h-8 px-3"
                  onClick={handleAddSubtask}
                  disabled={!newSubTitle.trim() || addingSubtask}
                >
                  {addingSubtask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => { setShowAddSubtask(false); setNewSubTitle(''); }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* ─ NOTAS / COMENTÁRIOS ─ */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Notas & Comentários</h3>
              <span className="text-xs text-muted-foreground">({comments.length})</span>
            </div>

            {loadingComments ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">
                Nenhuma nota ainda. As notas são visíveis para o cliente.
              </p>
            ) : (
              <div className="space-y-3 mb-4">
                {comments.map(c => (
                  <div key={c.id} className="bg-muted/50 rounded-lg px-4 py-3 relative group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {c.author?.full_name || 'Equipe'}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="p-1 hover:bg-red-500/10 text-muted-foreground/50 hover:text-red-500 rounded transition-colors"
                            title="Excluir nota"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground/60">
                        {format(new Date(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <Textarea
                placeholder={readOnly ? "Você não tem permissão para adicionar notas." : "Escreva uma nota ou atualização..."}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                className="min-h-[72px] resize-none text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSendComment();
                }}
                disabled={readOnly}
              />
              <Button
                size="icon"
                className="shrink-0 h-10 w-10"
                disabled={!newComment.trim() || sendingComment || readOnly}
                onClick={handleSendComment}
              >
                {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">
              Ctrl+Enter para enviar • Visível para o cliente no Roadmap
            </p>
            {/* Delete entire task footer */}
            {!readOnly && (
              <div className="pt-4 mt-6 border-t border-border flex justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteTask}
                  disabled={deletingTask}
                  className="gap-2"
                >
                  {deletingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Excluir Tarefa
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
