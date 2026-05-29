import { supabase } from '@/services/supabase';
import type { Flow, FlowProgress } from '../types';
import type { Client } from '@/types/client.types';
export const OnboardingService = {
  // Busca o fluxo de onboarding ativo e o progresso do cliente
  async getOnboardingData(clientId: string) {
    try {
      // 1. Busca fluxo ativo do tipo 'onboarding'
      const { data: flowData, error: flowError } = await supabase
        .from('flows')
        .select('*')
        .eq('flow_type', 'onboarding')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (flowError) throw flowError;

      // 2. Busca progresso do cliente para este fluxo
      const response = await supabase
        .from('flow_progress')
        .select('*')
        .eq('client_id', clientId)
        .eq('flow_id', flowData.id)
        .single();
      
      let progressData = response.data as FlowProgress | null;
      const progressError = response.error;

      // Se não existir progresso, cria um inicial
      if (progressError && progressError.code === 'PGRST116') {
        const { data: newProgress, error: createError } = await supabase
          .from('flow_progress')
          .insert({
            client_id: clientId,
            flow_id: flowData.id,
            current_step: 0,
            completed_steps: []
          })
          .select()
          .single();

        if (createError) throw createError;
        progressData = newProgress as FlowProgress;
      } else if (progressError) {
        throw progressError;
      }

      return {
        flow: flowData as Flow,
        progress: progressData as FlowProgress,
      };
    } catch (error) {
      console.error('Erro ao buscar dados de onboarding:', error);
      throw error;
    }
  },

  // Busca dados do cliente para a tela de conclusão
  async getClientData(clientId: string) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data as Client;
    } catch (error) {
      console.error('Erro ao buscar dados do cliente:', error);
      throw error;
    }
  },

  async completeStep(clientId: string, flowId: string, stepNumber: number) {
    try {
      const { data: updatedProgress, error } = await supabase.rpc('complete_my_flow_step', {
        p_client_id: clientId,
        p_flow_id: flowId,
        p_step_number: stepNumber,
      });

      if (error) throw error;
      return updatedProgress as FlowProgress;
    } catch (error) {
      console.error('Erro ao concluir etapa de onboarding:', error);
      throw error;
    }
  },
  
  async completeOnboardingClient(clientId: string) {
    try {
      const { error } = await supabase.rpc('complete_my_onboarding', {
        p_client_id: clientId,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao finalizar fluxo:', error);
      throw error;
    }
  }
};
