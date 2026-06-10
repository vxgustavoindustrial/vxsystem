import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Clock, ListChecks, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    due_date?: string;
    module: string;
    stage?: string;
    clients?: { name: string } | null;
    profiles?: { full_name: string } | null;
  };
  subtaskCount?: number;
  subtaskCompleted?: number;
}

const MODULE_LABELS: Record<string, string> = {
  general: 'Geral',
  onboarding: 'Onboarding',
  financial: 'Financeiro',
  documents: 'Documentos',
  support: 'Suporte',
};

const MODULE_COLORS: Record<string, string> = {
  general: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50',
  onboarding: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  financial: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
  documents: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30',
  support: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30',
};

export function TaskCard({ task, subtaskCount = 0, subtaskCompleted = 0 }: TaskCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 hover:bg-red-600 text-white';
      case 'high': return 'bg-orange-500 hover:bg-orange-600 text-white';
      case 'medium': return 'bg-yellow-400 hover:bg-yellow-500 text-slate-900';
      default: return 'bg-muted hover:bg-muted/80 text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority: string) => {
     switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      default: return 'Baixa';
    }
  }

  const progressPct = subtaskCount > 0 ? Math.round((subtaskCompleted / subtaskCount) * 100) : 0;
  const isOnboarding = task.stage?.startsWith('onboarding_phase_');

  return (
    <div className="bg-card p-3 rounded-lg shadow-sm border border-border cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <Badge className={`text-[10px] px-1.5 py-0 ${getPriorityColor(task.priority)}`}>
          {getPriorityLabel(task.priority)}
        </Badge>
        <div className="flex items-center gap-1.5">
          {isOnboarding && (
            <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
              Onboarding
            </span>
          )}
          {task.module && task.module !== 'general' && (
            <span className={cn("text-[9px] uppercase font-bold px-1.5 py-0.5 rounded", MODULE_COLORS[task.module] || MODULE_COLORS.general)}>
              {MODULE_LABELS[task.module] || task.module}
            </span>
          )}
        </div>
      </div>
      
      {/* Title */}
      <h4 className="font-medium text-sm text-foreground mb-1 line-clamp-2">
        {task.title}
      </h4>
      
      {/* Client */}
      <p className="text-xs text-muted-foreground mb-2 truncate">
        {task.clients?.name || 'Geral'}
      </p>

      {/* Subtask progress bar */}
      {subtaskCount > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <ListChecks className="w-3 h-3" />
              <span className="text-[10px] font-medium">
                {subtaskCompleted}/{subtaskCount}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : 'linear-gradient(90deg, #3b82f6, #6366f1)',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-muted-foreground text-xs pt-1">
        <div className="flex items-center space-x-2">
          {task.due_date && (
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              <span>{format(new Date(task.due_date), "dd/MM", { locale: ptBR })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3 h-3 opacity-50" />
           {task.profiles?.full_name ? (
              <div 
                className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]"
                title={task.profiles.full_name}
              >
                {task.profiles.full_name.charAt(0)}
              </div>
           ) : (
             <div className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center opacity-50">
                ?
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
