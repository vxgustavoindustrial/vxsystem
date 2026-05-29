import { useState, useEffect, useCallback } from 'react';
import { 
  ChevronRight, Rocket, Shield, Activity, FileCheck
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClientProjectRoadmapProps {
  clientId: string;
}

interface VXProject {
  id: string;
  title: string;
  status: 'analysis' | 'processing' | 'completed';
}

export function ClientProjectRoadmap({ clientId }: ClientProjectRoadmapProps) {
  const [project, setProject] = useState<VXProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoadmap = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vx_projects')
        .select('id, title, status')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setProject(data as VXProject | null);
    } catch (error) {
      console.error('Erro ao carregar roteiro do projeto:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  let globalProgress = 20;
  let stageName = "Etapa 1: Acesso à Área VX Autorizado";
  let StageIcon = Shield;

  if (project) {
    if (project.status === 'analysis') {
      globalProgress = 40;
      stageName = "Etapa 2: Análise de Engenharia do Modelo 3D";
      StageIcon = Rocket;
    } else if (project.status === 'processing') {
      globalProgress = 70;
      stageName = "Etapa 3: Esteira de Conversão & Otimização";
      StageIcon = Activity;
    } else if (project.status === 'completed') {
      globalProgress = 100;
      stageName = "Etapas 4 e 5: Projeto Homologado & Pronto para o Óculos";
      StageIcon = FileCheck;
    }
  }

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm bg-card">
        <CardContent className="p-6">
           <div className="h-2 w-full bg-muted animate-pulse rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border shadow-sm transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-2">
            <StageIcon className="w-5 h-5 text-primary" />
            Progresso Geral da Jornada VX
          </span>
          <span className="text-primary text-xl font-bold">{globalProgress}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="space-y-4">
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out bg-primary relative",
                globalProgress === 100 && "bg-emerald-500"
              )}
              style={{ width: `${globalProgress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent animate-pulse" />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-muted-foreground font-medium">
            <div>
              <p className="text-foreground font-semibold text-sm mb-0.5">{stageName}</p>
              {project ? (
                <p className="text-muted-foreground">Projeto ativo: <span className="text-foreground font-medium">{project.title}</span></p>
              ) : (
                <p className="text-muted-foreground">Aguardando o envio do primeiro modelo 3D para iniciar o projeto.</p>
              )}
            </div>
            <button 
              onClick={() => window.location.href = '/client/onboarding'}
              className="text-primary font-bold hover:underline flex items-center gap-1 shrink-0 self-end sm:self-center"
            >
              Ver Detalhes do Roteiro <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
