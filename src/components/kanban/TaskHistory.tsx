import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { TaskDetailModal } from '@/components/modals/TaskDetailModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  module: string;
  client_id?: string;
  stage?: string;
  parent_id?: string | null;
  completed_at?: string;
  clients: { name: string };
  profiles: { full_name: string };
};

export function TaskHistory({ clientIdFilter }: { clientIdFilter?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    let query = supabase.from('tasks').select(`
      id, title, description, status, priority, due_date, module, client_id, stage, parent_id, completed_at,
      clients!tasks_client_id_fkey ( name ), profiles!tasks_assigned_to_fkey ( full_name )
    `)
    .eq('status', 'done')
    .order('updated_at', { ascending: false });

    if (clientIdFilter && clientIdFilter !== 'all') {
      query = query.eq('client_id', clientIdFilter);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error("Erro listando histórico de tarefas", error);
    } else {
      setTasks((data as unknown as Task[]) || []);
    }
    setIsLoading(false);
  }, [clientIdFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchHistory]);

  const handleCardClick = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleTaskUpdatedFromModal = async () => {
    await fetchHistory();
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando histórico...</div>;
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase border-b border-border">
            <tr>
              <th className="px-6 py-4 font-medium">Tarefa</th>
              <th className="px-6 py-4 font-medium">Cliente</th>
              <th className="px-6 py-4 font-medium">Módulo</th>
              <th className="px-6 py-4 font-medium">Responsável</th>
              <th className="px-6 py-4 font-medium">Data de Conclusão</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  Nenhuma tarefa concluída encontrada no histórico.
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr 
                  key={task.id} 
                  onClick={() => handleCardClick(task)}
                  className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-foreground">{task.title}</td>
                  <td className="px-6 py-4">{task.clients?.name || 'Agência'}</td>
                  <td className="px-6 py-4 capitalize">{task.module}</td>
                  <td className="px-6 py-4">{task.profiles?.full_name || 'Não atribuído'}</td>
                  <td className="px-6 py-4">
                    {task.completed_at 
                      ? format(new Date(task.completed_at), "dd 'de' MMM, yyyy", { locale: ptBR })
                      : 'Não registrada'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TaskDetailModal
        task={selectedTask}
        open={modalOpen}
        onOpenChange={setModalOpen}
        subtasks={[]} // Simplificado para o histórico
        onSubtaskToggle={() => {}}
        onTaskUpdated={handleTaskUpdatedFromModal}
      />
    </div>
  );
}
