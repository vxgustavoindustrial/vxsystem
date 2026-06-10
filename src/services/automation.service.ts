import { supabase } from './supabase';
import { NotificationService } from './notification.service';

export interface OnboardingTemplate {
  title: string;
  description?: string;
  module: 'general' | 'onboarding' | 'financial' | 'documents' | 'support';
  subtasks?: { title: string; description?: string }[];
}

const PHASE_1_TEMPLATE: OnboardingTemplate[] = [
  {
    title: 'Acesso a Area do Cliente',
    description: 'Liberacao de login, senha e acesso inicial ao portal da VX.',
    module: 'onboarding',
    subtasks: [
      { title: 'Criar login do cliente', description: 'Gerar usuario e credenciais de entrada.' },
      { title: 'Habilitar notificacoes', description: 'Garantir avisos de sistema e status.' },
      { title: 'Validar permissões', description: 'Confirmar o que o cliente pode visualizar.' },
    ],
  },
  {
    title: 'Upload dos Arquivos',
    description: 'Recebimento dos arquivos corretos para iniciar o projeto.',
    module: 'documents',
    subtasks: [
      { title: 'Receber STEP / PDF / JPEG / PNG', description: 'Verificar se os formatos estao corretos.' },
      { title: 'Conferir briefing e informacoes basicas', description: 'Descricao do projeto e requisitos.' },
      { title: 'Validar materiais complementares', description: 'Imagens e documentacoes extras.' },
    ],
  },
  {
    title: 'Processamento de Dados',
    description: 'A equipe tecnica analisa, organiza e prepara o conteudo para execucao.',
    module: 'general',
    subtasks: [
      { title: 'Em analise', description: 'Verificar se os dados estao completos.' },
      { title: 'Em processo', description: 'Executar a montagem tecnica do projeto.' },
      { title: 'Prazo de entrega', description: 'Definir e informar a previsao ao cliente.' },
    ],
  },
];

const PHASE_2_TEMPLATE: OnboardingTemplate[] = [
  {
    title: 'Download dos Arquivos',
    description: 'Publicacao do arquivo final na biblioteca do cliente.',
    module: 'documents',
    subtasks: [
      { title: 'Enviar arquivo finalizado', description: 'Disponibilizar para download seguro.' },
      { title: 'Organizar biblioteca', description: 'Manter a versao mais recente em destaque.' },
    ],
  },
  {
    title: 'Instalacao no Oculos',
    description: 'Entrega do software, tutoriais e treinamento inicial.',
    module: 'support',
    subtasks: [
      { title: 'Liberar software VX', description: 'Disponibilizar o instalador necessario.' },
      { title: 'Enviar tutorial de uso', description: 'Passo a passo de instalacao e operacao.' },
      { title: 'Agendar treinamento inicial', description: 'Apoio com a equipe tecnica do cliente.' },
    ],
  },
];

export const AutomationService = {
  async initializeOnboarding(clientId: string, userId: string) {
    try {
      console.log('Iniciando onboarding VX...');

      await supabase
        .from('tasks')
        .delete()
        .eq('client_id', clientId)
        .in('stage', ['onboarding_phase_1', 'onboarding_phase_2']);

      for (const template of PHASE_1_TEMPLATE) {
        const { data: parentTask, error: parentError } = await supabase
          .from('tasks')
          .insert({
            client_id: clientId,
            title: template.title,
            description: template.description || '',
            module: template.module,
            status: 'todo',
            priority: 'medium',
            created_by: userId,
            stage: 'onboarding_phase_1',
          })
          .select()
          .single();

        if (parentError) throw parentError;

        if (template.subtasks?.length) {
          const subtasks = template.subtasks.map((subtask) => ({
            client_id: clientId,
            parent_id: parentTask.id,
            title: subtask.title,
            description: subtask.description || '',
            module: template.module,
            status: 'todo',
            priority: 'medium',
            created_by: userId,
            stage: 'onboarding_phase_1',
          }));

          const { error: subError } = await supabase.from('tasks').insert(subtasks);
          if (subError) throw subError;
        }
      }

      await supabase
        .from('clients')
        .update({ status: 'onboarding', onboarding_completed: false })
        .eq('id', clientId);

      await NotificationService.createNotification({
        clientId,
        type: 'task',
        title: 'Novas tarefas de onboarding',
        body: 'O onboarding inicial foi liberado. Confira suas primeiras atividades.',
        link: '/client/onboarding',
      });

      return { success: true };
    } catch (error) {
      console.error('Erro ao inicializar onboarding:', error);
      throw error;
    }
  },

  async generatePhase2(clientId: string, userId: string) {
    try {
      for (const template of PHASE_2_TEMPLATE) {
        const { data: parentTask, error: parentError } = await supabase
          .from('tasks')
          .insert({
            client_id: clientId,
            title: template.title,
            description: template.description || '',
            module: template.module,
            status: 'todo',
            priority: 'medium',
            created_by: userId,
            stage: 'onboarding_phase_2',
          })
          .select()
          .single();

        if (parentError) throw parentError;

        if (template.subtasks?.length) {
          const subtasks = template.subtasks.map((subtask) => ({
            client_id: clientId,
            parent_id: parentTask.id,
            title: subtask.title,
            description: subtask.description || '',
            module: template.module,
            status: 'todo',
            priority: 'medium',
            created_by: userId,
            stage: 'onboarding_phase_2',
          }));

          const { error: subError } = await supabase.from('tasks').insert(subtasks);
          if (subError) throw subError;
        }
      }

      await NotificationService.createNotification({
        clientId,
        type: 'task',
        title: 'Novas tarefas da fase 2',
        body: 'A segunda etapa do onboarding foi liberada.',
        link: '/client/onboarding',
      });

      return { success: true };
    } catch (error) {
      console.error('Erro ao gerar fase 2:', error);
      throw error;
    }
  },

  async executeFlow(flowId: string, clientId: string, userId: string, stepId?: string): Promise<{ tasksCreated: number }> {
    const { data: flow, error: flowErr } = await supabase
      .from('flows')
      .select('*')
      .eq('id', flowId)
      .single();

    if (flowErr || !flow) throw new Error('Fluxo nao encontrado.');

    const steps = (flow.steps as Array<Record<string, unknown>>) || [];
    const actionSteps = steps.filter((step) => {
      if (stepId) return step.id === stepId;
      return step.type !== 'trigger';
    });

    if (actionSteps.length === 0) return { tasksCreated: 0 };

    let tasksCreated = 0;

    for (const step of actionSteps) {
      const stage = String(step.stage || 'custom');
      const module = (step.module as OnboardingTemplate['module']) || 'general';
      const priority = (step.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium';
      const title = String(step.description || step.title || 'Tarefa de Fluxo');
      const subtaskDefs = (step.subtasks as Array<{ title: string }> | undefined) || [];

      await supabase
        .from('tasks')
        .delete()
        .eq('client_id', clientId)
        .eq('stage', stage)
        .eq('title', title)
        .is('parent_id', null);

      const { data: parent, error: parentErr } = await supabase
        .from('tasks')
        .insert({
          client_id: clientId,
          title,
          module,
          status: 'todo',
          priority,
          created_by: userId,
          stage,
          is_template: false,
        })
        .select('id')
        .single();

      if (parentErr) {
        console.error('Erro ao criar a tarefa pai do fluxo:', parentErr);
        throw parentErr;
      }

      tasksCreated++;

      if (subtaskDefs.length > 0) {
        const subs = subtaskDefs
          .filter((subtask) => subtask.title.trim() !== '')
          .map((subtask, index) => ({
            client_id: clientId,
            parent_id: parent.id,
            title: subtask.title,
            module,
            status: 'todo',
            priority,
            created_by: userId,
            stage,
            order: index,
            is_template: false,
          }));

        if (subs.length > 0) {
          const { error: subErr } = await supabase.from('tasks').insert(subs);
          if (subErr) {
            console.error('Erro ao criar subtarefas:', subErr);
            throw subErr;
          }
          tasksCreated += subs.length;
        }
      }
    }

    if (tasksCreated > 0) {
      await NotificationService.createNotification({
        clientId,
        type: 'task',
        title: 'Fluxo de atividades atualizado',
        body: 'Novas tarefas foram preparadas para voce.',
        link: '/client/onboarding',
      });
    }

    return { tasksCreated };
  },

  async createTaskFromRejection(clientId: string, userId: string, creativeData: { title: string; feedback: string }) {
    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          client_id: clientId,
          title: `[Ajuste] - ${creativeData.title}`,
          description: `Feedback do cliente: ${creativeData.feedback}`,
          module: 'general',
          status: 'todo',
          priority: 'high',
          created_by: userId,
          stage: 'production_fix',
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao criar tarefa de ajuste:', error);
      throw error;
    }
  },

  async createTaskFromTicket(clientId: string, userId: string, ticketData: { id: string; subject: string; description?: string }) {
    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          client_id: clientId,
          title: `[Suporte] - ${ticketData.subject}`,
          description: `Ticket ID: #${ticketData.id.split('-')[0]}\n\nDescricao: ${ticketData.description || 'Ver no ticket'}`,
          module: 'support',
          status: 'todo',
          priority: 'medium',
          created_by: userId,
          stage: 'support_task',
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erro ao converter ticket em tarefa:', error);
      throw error;
    }
  },
};
