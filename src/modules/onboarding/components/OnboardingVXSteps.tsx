import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  UploadCloud,
  FileText,
  AlertTriangle,
  Download,
  HelpCircle,
  Rocket,
  Cpu,
  Clock,
  ArrowRight,
  Loader2,
  Shield,
  Activity,
  FileCheck,
  FolderOpen
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

interface OnboardingVXStepsProps {
  clientId: string;
  initialStep?: number;
}

interface VXProject {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  animation_details: string | null;
  lighting_details: string | null;
  status: 'analysis' | 'processing' | 'completed';
  estimated_delivery: string | null;
  technical_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface VXProjectFile {
  id: string;
  project_id: string;
  file_url: string;
  file_name: string;
  file_type: 'step' | 'pdf' | 'jpeg' | 'png' | 'apk';
  file_size: number | null;
  is_result: boolean;
  created_at: string;
}

interface VXSoftware {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  tutorial_url: string | null;
  version: string | null;
  created_at: string;
}

const PROJECTS_BUCKET = 'vx-projects';
const PUBLIC_PROJECTS_PATH = `/storage/v1/object/public/${PROJECTS_BUCKET}/`;
const R2_FILE_PREFIX = 'r2://';

function isR2ProjectUrl(fileUrlOrPath: string) {
  return fileUrlOrPath.startsWith(R2_FILE_PREFIX);
}

async function createR2UploadUrl(clientId: string, projectId: string, fileName: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Sessao expirada. Faca login novamente.');

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-r2-upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ clientId, projectId, fileName, isResult: false }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Erro ao preparar upload no Cloudflare R2.');
  }

  return await res.json() as { uploadUrl: string; fileUrl: string };
}

async function createR2DownloadUrl(fileUrl: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error('Sessao expirada. Faca login novamente.');

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-r2-download-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fileUrl }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Nao foi possivel liberar o download no Cloudflare R2.');
  }

  const data = await res.json();
  return data.downloadUrl as string;
}

function getProjectStoragePath(fileUrlOrPath: string) {
  const markerIndex = fileUrlOrPath.indexOf(PUBLIC_PROJECTS_PATH);
  if (markerIndex === -1) return fileUrlOrPath;

  return decodeURIComponent(fileUrlOrPath.slice(markerIndex + PUBLIC_PROJECTS_PATH.length));
}

function isExternalProjectUrl(fileUrlOrPath: string) {
  return /^https?:\/\//i.test(fileUrlOrPath) && !fileUrlOrPath.includes(PUBLIC_PROJECTS_PATH);
}

async function createProjectDownloadUrl(fileUrlOrPath: string) {
  if (isR2ProjectUrl(fileUrlOrPath)) return await createR2DownloadUrl(fileUrlOrPath);
  if (isExternalProjectUrl(fileUrlOrPath)) return fileUrlOrPath;
  const storagePath = getProjectStoragePath(fileUrlOrPath);
  const { data, error } = await supabase.storage
    .from(PROJECTS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

export function OnboardingVXSteps({ clientId, initialStep = 1 }: OnboardingVXStepsProps) {
  const { isFinanceiro, isProjetista } = useAuth();
  const [activeStep, setActiveStep] = useState<number>(initialStep);
  const [projects, setProjects] = useState<VXProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<VXProject | null>(null);
  const [projectFiles, setProjectFiles] = useState<VXProjectFile[]>([]);
  const [softwares, setSoftwares] = useState<VXSoftware[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef(false);
  const [editingClientProject, setEditingClientProject] = useState<VXProject | null>(null);
  const [editClientForm, setEditClientForm] = useState({ title: "", description: "", animation_details: "", lighting_details: "" });

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [animationDetails, setAnimationDetails] = useState('');
  const [lightingDetails, setLightingDetails] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      // 1. Fetch projects
      const { data: projData, error: projError } = await supabase
        .from('vx_projects')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (projError) throw projError;
      setProjects((projData as VXProject[]) || []);

      if (projData && projData.length > 0) {
        // Default to latest project
        setSelectedProject(projData[0] as VXProject);
      }

      // 2. Fetch software downloads
      const { data: softData, error: softError } = await supabase
        .from('vx_software_downloads')
        .select('*')
        .order('created_at', { ascending: true });

      if (softError) throw softError;
      setSoftwares((softData as VXSoftware[]) || []);
    } catch (error: unknown) {
      console.error('Erro ao carregar dados:', error instanceof Error ? error.message : error);
      toast.error('Erro ao carregar os dados do Onboarding.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch files when selected project changes
  useEffect(() => {
    if (!selectedProject) {
      setProjectFiles([]);
      return;
    }

    const fetchFiles = async () => {
      const { data, error } = await supabase
        .from('vx_project_files')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setProjectFiles(data as VXProjectFile[]);
      }
    };

    fetchFiles();
  }, [selectedProject]);

  // Handle Drag & Drop Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndAddFiles = (filesList: FileList) => {
    const allowedExtensions = ['step', 'pdf', 'jpg', 'jpeg', 'png'];
    const addedFiles: File[] = [];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const extension = file.name.split('.').pop()?.toLowerCase() || '';

      if (!allowedExtensions.includes(extension)) {
        toast.warning(`Arquivo rejeitado: "${file.name}". Apenas .step, .pdf e imagens são permitidos.`);
        continue;
      }

      addedFiles.push(file);
    }

    if (addedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...addedFiles]);
      toast.success(`${addedFiles.length} arquivo(s) adicionado(s) com sucesso.`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndAddFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit Project Upload
  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Por favor, informe o título do projeto.');
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error('Por favor, adicione pelo menos um arquivo de modelo (.step, .pdf ou imagem).');
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      // 1. Criar o projeto
      const { data: newProj, error: projError } = await supabase
        .from('vx_projects')
        .insert({
          client_id: clientId,
          title: title.trim(),
          description: description.trim() || null,
          animation_details: animationDetails.trim() || null,
          lighting_details: lightingDetails.trim() || null,
          status: 'analysis'
        })
        .select()
        .single();

      if (projError) throw projError;

      const project = newProj as VXProject;

      // 2. Fazer upload dos arquivos e criar registros
      for (const file of selectedFiles) {
        const ext = file.name.split('.').pop()?.toLowerCase();

        const { uploadUrl, fileUrl } = await createR2UploadUrl(clientId, project.id, file.name);
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Erro ao enviar "${file.name}" para o Cloudflare R2.`);
        }

        // Mapeamento de tipo
        let fileType: 'step' | 'pdf' | 'jpeg' | 'png' = 'pdf';
        if (ext === 'step') fileType = 'step';
        else if (ext === 'pdf') fileType = 'pdf';
        else if (ext === 'png') fileType = 'png';
        else if (ext === 'jpg' || ext === 'jpeg') fileType = 'jpeg';

        // Inserir registro do arquivo
        const { error: fileInsertError } = await supabase
          .from('vx_project_files')
          .insert({
            project_id: project.id,
            file_url: fileUrl,
            file_name: file.name,
            file_type: fileType,
            file_size: file.size,
            is_result: false
          });

        if (fileInsertError) throw fileInsertError;
      }

      toast.success('Projeto enviado com sucesso para análise técnica!');
      
      // Limpar form
      setTitle('');
      setDescription('');
      setAnimationDetails('');
      setLightingDetails('');
      setSelectedFiles([]);

      // Recarregar dados e selecionar novo projeto
      await loadData();
      
      // Mover para aba de processamento
      setActiveStep(3);
    } catch (error: unknown) {
      console.error('Erro ao enviar projeto:', error instanceof Error ? error.message : error);
      toast.error('Ocorreu um erro ao enviar o projeto. Tente novamente.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const startClientEdit = (proj: VXProject) => {
    setEditingClientProject(proj);
    setEditClientForm({
      title: proj.title,
      description: proj.description || "",
      animation_details: proj.animation_details || "",
      lighting_details: proj.lighting_details || "",
    });
  };

  const saveClientEdit = async () => {
    if (!editingClientProject) return;
    setIsSubmitting(true);
    const { error } = await supabase.from("vx_projects").update({
      title: editClientForm.title.trim(),
      description: editClientForm.description.trim() || null,
      animation_details: editClientForm.animation_details.trim() || null,
      lighting_details: editClientForm.lighting_details.trim() || null,
    }).eq("id", editingClientProject.id);
    setIsSubmitting(false);
    if (error) return toast.error("Erro ao salvar edicao.");
    toast.success("Projeto atualizado.");
    setEditingClientProject(null);
    await loadData();
  };

  const deleteClientProject = async (proj: VXProject) => {
    if (!window.confirm(`Excluir o projeto "${proj.title}"? Esta acao nao pode ser desfeita.`)) return;
    setIsSubmitting(true);
    const { data: files } = await supabase.from("vx_project_files").select("file_url").eq("project_id", proj.id);
    if (files) {
      for (const file of files) {
        await supabase.storage.from("vx-projects").remove([file.file_url]);
      }
    }
    await supabase.from("vx_project_files").delete().eq("project_id", proj.id);
    const { error } = await supabase.from("vx_projects").delete().eq("id", proj.id);
    setIsSubmitting(false);
    if (error) return toast.error("Erro ao excluir projeto.");
    toast.success("Projeto excluido.");
    setEditingClientProject(null);
    await loadData();
  };

  const getStatusLabel = (status: VXProject['status']) => {
    switch (status) {
      case 'analysis': return 'Em Análise';
      case 'processing': return 'Em Processamento';
      case 'completed': return 'Finalizado';
      default: return 'Desconhecido';
    }
  };

  const getStatusBadgeClass = (status: VXProject['status']) => {
    switch (status) {
      case 'analysis': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p className="text-sm font-medium">Carregando painel de onboarding da VX Industrial...</p>
      </div>
    );
  }

  // Abas
  const stepsConfig = [
    { num: 1, label: 'Acesso', icon: Shield },
    { num: 2, label: 'Envio de Modelos', icon: UploadCloud },
    { num: 3, label: 'Esteira de Conversão', icon: Activity },
    { num: 4, label: 'Biblioteca de Downloads', icon: FileCheck },
    ...(isProjetista ? [] : [{ num: 5, label: 'Configuração Óculos' as const, icon: Cpu }]),
  ];

  return (
    <div className="space-y-6">
      {/* Navegação de Etapas */}
      <div className="bg-card border border-border/80 rounded-2xl p-2 md:p-3 overflow-x-auto shadow-md">
        <div className="flex space-x-1 md:space-x-2 min-w-[700px] justify-between">
          {stepsConfig.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.num;
            const isPassed = activeStep > step.num;
            return (
              <button
                key={step.num}
                onClick={() => setActiveStep(step.num)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 flex-1 justify-center font-medium text-xs md:text-sm',
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                    : isPassed
                      ? 'text-primary/80 hover:bg-muted/40' 
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] border shrink-0',
                  isActive
                    ? 'bg-primary-foreground text-primary border-transparent'
                    : isPassed
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                )}>
                  {isPassed ? '✓' : step.num}
                </div>
                <Icon className="w-4 h-4 shrink-0" />
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo das Etapas */}
      <div className="bg-card border border-border/80 rounded-3xl p-6 md:p-8 shadow-lg min-h-[450px] relative overflow-hidden">
        {/* Fundo decorativo premium */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full filter blur-3xl pointer-events-none -mr-48 -mt-48" />

        {/* ETAPA 1: ACESSO */}
        {activeStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                <Shield className="w-3.5 h-3.5" />
                Segurança Industrial Garantida
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Boas-vindas à Esteira de Pós-Vendas da <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">VX Industrial</span>
              </h2>
              <p className="text-muted-foreground max-w-3xl leading-relaxed text-sm md:text-base">
                Esta área foi desenvolvida exclusivamente para automatizar o recebimento, processamento e entrega dos modelos 3D que serão rodados em seus dispositivos de Realidade Virtual e Aumentada. 
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 pt-4">
              <div className="bg-muted/40 border border-border/50 rounded-2xl p-5 hover:border-primary/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-base mb-2">Confidencialidade Rigorosa</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Garantia de NDA ativo. Seus arquivos STEP e diagramas técnicos confidenciais são armazenados de forma isolada e criptografada no nosso ecossistema.
                </p>
              </div>

              <div className="bg-muted/40 border border-border/50 rounded-2xl p-5 hover:border-primary/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-base mb-2">Engenharia de Otimização</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nossos engenheiros processam sua geometria CAD, reduzem a contagem de polígonos, configuram materiais avançados, iluminação realista e entregam executáveis ultra fluidos.
                </p>
              </div>

              <div className="bg-muted/40 border border-border/50 rounded-2xl p-5 hover:border-primary/30 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-base mb-2">Pronto para o Dispositivo</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Após a conclusão, os arquivos prontos e os instaladores dos óculos VR/AR ficam centralizados e documentados na etapa 5 para sua equipe técnica.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-border flex justify-end">
              <button
                onClick={() => setActiveStep(2)}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:shadow-primary/20 hover:scale-[1.02] transition-all"
              >
                Iniciar Upload de Modelos
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 2: ENVIO DE ARQUIVOS */}
        {activeStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isFinanceiro ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/30 p-6 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
                <h3 className="font-bold text-lg mb-1">Acesso Restrito</h3>
                <p className="text-sm text-muted-foreground">
                  Seu perfil financeiro não tem permissão para realizar upload de arquivos de projeto.
                  Entre em contato com o projetista responsável.
                </p>
              </div>
            ) : (
            <>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Envio de Arquivos & Detalhes do Projeto</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Forneça os metadados do projeto e arraste os arquivos de modelo 3D (.step), documentações adicionais (.pdf) ou imagens auxiliares.
              </p>
            </div>

            <form onSubmit={handleSubmitProject} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="proj-title" className="block text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground">Título do Projeto <span className="text-red-500">*</span></label>
                    <input
                      id="proj-title"
                      type="text"
                      required
                      placeholder="Ex: Motor Gerador Trifásico X-100"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="proj-desc" className="block text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground">Descrição Geral</label>
                    <textarea
                      id="proj-desc"
                      rows={3}
                      placeholder="Descreva brevemente o projeto e a finalidade desta conversão..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="proj-anim" className="block text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground">Animações & Interações Solicitadas</label>
                    <textarea
                      id="proj-anim"
                      rows={2.5}
                      placeholder="Ex: Rotação do rotor primário, explosão do cabeçote superior ao toque do gatilho..."
                      value={animationDetails}
                      onChange={(e) => setAnimationDetails(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="proj-lights" className="block text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground">Cores, Luzes e Materiais</label>
                    <textarea
                      id="proj-lights"
                      rows={2.5}
                      placeholder="Ex: Acabamento metálico polido, luzes vermelhas piscantes no painel traseiro..."
                      value={lightingDetails}
                      onChange={(e) => setLightingDetails(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Zona de Drag & Drop */}
                <div className="flex flex-col space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Arquivos do Projeto</span>
                  
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={cn(
                      "flex-1 border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[220px]",
                      dragActive 
                        ? "border-primary bg-primary/5 scale-[0.99]" 
                        : "border-border/80 hover:border-primary/40 bg-muted/20"
                    )}
                  >
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      accept=".step,.pdf,.jpg,.jpeg,.png"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6 text-primary" />
                    </div>
                    
                    <p className="text-sm font-semibold mb-1">Arraste e solte seus arquivos técnicos aqui</p>
                    <p className="text-xs text-muted-foreground max-w-[280px] mb-4">
                      Apenas formatos <strong className="text-primary font-bold">.step, .pdf, .jpg, .jpeg, .png</strong> são permitidos. O envio vai direto para o Cloudflare R2.
                    </p>
                    
                    <label
                      htmlFor="file-upload"
                      className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                    >
                      Selecionar do Dispositivo
                    </label>
                  </div>

                  {/* Lista de Arquivos Selecionados */}
                  {selectedFiles.length > 0 && (
                    <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 max-h-[180px] overflow-y-auto custom-scrollbar">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Arquivos selecionados ({selectedFiles.length})</span>
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-card border border-border/60 rounded-xl p-2.5 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-primary shrink-0" />
                              <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                              <span className="text-muted-foreground/60 shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="text-red-500 hover:text-red-600 font-bold px-1.5 py-0.5 rounded hover:bg-red-500/5 transition-colors"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-border flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="px-5 py-2.5 border border-border hover:bg-muted font-bold text-xs rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:shadow-primary/20 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:pointer-events-none transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando Arquivos...
                    </>
                  ) : (
                    <>
                      Enviar Modelo 3D
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
          )}
          </div>
        )}

        {/* ETAPA 3: PROCESSAMENTO (ESTEIRA DE CONVERSÃO) */}
        {activeStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Esteira de Conversão & Acompanhamento</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Monitore o progresso do seu projeto 3D enquanto nossos engenheiros modelam, reduzem polígonos e configuram o executável final.
                </p>
              </div>

              {projects.length > 1 && (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-xs font-bold text-muted-foreground shrink-0 uppercase tracking-wider">Projeto:</span>
                  <select
                    value={selectedProject?.id || ''}
                    onChange={(e) => {
                      const proj = projects.find(p => p.id === e.target.value);
                      if (proj) setSelectedProject(proj);
                    }}
                    className="bg-muted/60 border border-border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-56"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedProject ? (
              <div className="space-y-6">
                {/* Visual Tracker Cards */}
                <div className="bg-muted/30 border border-border/50 rounded-2xl p-6">
                  {editingClientProject?.id === selectedProject.id ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Titulo</label>
                        <input type="text" value={editClientForm.title} onChange={(e) => setEditClientForm({ ...editClientForm, title: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descricao</label>
                        <textarea value={editClientForm.description} onChange={(e) => setEditClientForm({ ...editClientForm, description: e.target.value })} rows={3} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Animacoes e interacoes</label>
                        <textarea value={editClientForm.animation_details} onChange={(e) => setEditClientForm({ ...editClientForm, animation_details: e.target.value })} rows={2} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cores e luzes</label>
                        <textarea value={editClientForm.lighting_details} onChange={(e) => setEditClientForm({ ...editClientForm, lighting_details: e.target.value })} rows={2} className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => void saveClientEdit()} disabled={isSubmitting || !editClientForm.title.trim()} className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl disabled:opacity-50">{isSubmitting ? "Salvando..." : "Salvar"}</button>
                        <button onClick={() => setEditingClientProject(null)} disabled={isSubmitting} className="px-4 py-2 border border-border font-bold text-xs rounded-xl hover:bg-muted">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-base">{selectedProject.title}</h3>
                      <div className="flex items-center gap-2">
                        {!isFinanceiro && selectedProject.status === 'analysis' && (
                          <>
                            <button onClick={() => startClientEdit(selectedProject)} className="text-[10px] font-bold text-primary hover:underline">Editar</button>
                            <button onClick={() => void deleteClientProject(selectedProject)} disabled={isSubmitting} className="text-[10px] font-bold text-destructive hover:underline">Excluir</button>
                          </>
                        )}
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider", getStatusBadgeClass(selectedProject.status))}>
                          {getStatusLabel(selectedProject.status)}
                        </span>
                      </div>
                    </div>
                    {selectedProject.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-2xl">{selectedProject.description}</p>
                    )}
                  </div>
                  )}

                  {/* Stepper Visual */}
                  <div className="relative flex items-center justify-between mt-8 max-w-xl mx-auto">
                    {/* Linha de progresso por trás */}
                    <div className="absolute left-0 right-0 h-1 bg-border rounded" />
                    <div
                      className="absolute left-0 h-1 bg-primary rounded transition-all duration-700"
                      style={{
                        width: selectedProject.status === 'analysis' ? '0%' : selectedProject.status === 'processing' ? '50%' : '100%'
                      }}
                    />

                    {/* Etapas do Stepper */}
                    {[
                      { key: 'analysis', label: 'Análise Técnica', step: 1 },
                      { key: 'processing', label: 'Em Processamento', step: 2 },
                      { key: 'completed', label: 'Finalizado', step: 3 },
                    ].map((stepItem, index) => {
                      const stepStatus = selectedProject.status;
                      const isCurrent = stepStatus === stepItem.key;
                      const isDone = 
                        (stepItem.key === 'analysis' && (stepStatus === 'processing' || stepStatus === 'completed')) ||
                        (stepItem.key === 'processing' && stepStatus === 'completed') || 
                        (stepItem.key === 'completed' && stepStatus === 'completed');

                      return (
                        <div key={index} className="relative z-10 flex flex-col items-center">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center border font-bold text-xs transition-all duration-300",
                            isDone 
                              ? "bg-emerald-500 border-transparent text-white" 
                              : isCurrent 
                                ? "bg-primary border-transparent text-primary-foreground scale-110 shadow-lg shadow-primary/20" 
                                : "bg-card border-border text-muted-foreground"
                          )}>
                            {isDone ? '✓' : stepItem.step}
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold mt-2 whitespace-nowrap",
                            isCurrent ? "text-foreground" : "text-muted-foreground/80"
                          )}>
                            {stepItem.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Entrega Estimada */}
                  <div className="bg-card border border-border/80 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Data de Entrega Estimada</span>
                      <span className="text-lg font-bold">
                        {selectedProject.estimated_delivery 
                          ? format(new Date(selectedProject.estimated_delivery + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : 'Aguardando Análise Técnica'}
                      </span>
                    </div>
                  </div>

                  {/* Notas Técnicas / Alerta de Suporte */}
                  {selectedProject.technical_notes && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">Observação Técnica / Dúvida Pendente</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {selectedProject.technical_notes}
                        </p>
                        <a
                          href="https://wa.me/5511999999999" // TODO: Mapear com telefone real do SAC
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-600 font-bold pt-1.5 hover:underline"
                        >
                          Falar com Suporte no WhatsApp →
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Arquivos do Projeto */}
                {projectFiles.length > 0 && (
                  <div className="bg-muted/10 border border-border/50 rounded-2xl p-5">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Arquivos de Entrada Enviados</h4>
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {projectFiles.filter(f => !f.is_result).map(file => (
                        <div key={file.id} className="bg-card border border-border/60 rounded-xl p-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-semibold truncate max-w-[140px]">{file.file_name}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-muted-foreground/60 border border-border/40 shrink-0">
                            {file.file_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 bg-muted/20 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center min-h-[220px]">
                <FolderOpen className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <h4 className="font-bold text-sm mb-1">Nenhum projeto em andamento</h4>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Envie o seu primeiro arquivo técnico ou geometria 3D na etapa de "Envio de Modelos" para que possamos iniciar a otimização.
                </p>
                <button
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:scale-[1.02] shadow-sm transition-transform"
                >
                  Criar Primeiro Projeto
                </button>
              </div>
            )}

            <div className="pt-6 border-t border-border flex justify-between">
              <button
                onClick={() => setActiveStep(2)}
                className="px-5 py-2.5 border border-border hover:bg-muted font-bold text-xs rounded-xl transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => setActiveStep(4)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:scale-[1.02] transition-transform"
              >
                Biblioteca de Downloads
                <ArrowRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 4: BIBLIOTECA DE DOWNLOADS */}
        {activeStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Biblioteca de Downloads</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Acesse aqui os arquivos convertidos e otimizados prontos para instalação no óculos de realidade virtual ou aumentada.
              </p>
            </div>

            {/* Listagem de Resultados */}
            {projects.some(p => p.status === 'completed') ? (
              <div className="space-y-6">
                {projects.filter(p => p.status === 'completed').map(proj => {
                  return (
                    <div key={proj.id} className="bg-muted/30 border border-border/50 rounded-2xl p-5 space-y-4">
                      <div className="flex justify-between items-center border-b border-border/60 pb-3">
                        <div>
                          <h4 className="font-bold text-base text-foreground">{proj.title}</h4>
                          <span className="text-[10px] text-muted-foreground">
                            Entregue em: {proj.updated_at ? format(new Date(proj.updated_at), "dd/MM/yyyy", { locale: ptBR }) : ''}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 uppercase">
                          Pronto
                        </span>
                      </div>

                      {/* Buscar arquivos de resultado deste projeto */}
                      <ResultFilesList projectId={proj.id} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-8 bg-muted/20 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center min-h-[220px]">
                <FileCheck className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <h4 className="font-bold text-sm mb-1">Nenhum arquivo convertido ainda</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Assim que nossa equipe concluir o processamento e a modelagem final, seus links de download de alta velocidade estarão centralizados nesta aba.
                </p>
              </div>
            )}

            <div className="pt-6 border-t border-border flex justify-between">
              <button
                onClick={() => setActiveStep(3)}
                className="px-5 py-2.5 border border-border hover:bg-muted font-bold text-xs rounded-xl transition-colors"
              >
                Voltar
              </button>
              {!isProjetista && (
                <button
                  onClick={() => setActiveStep(5)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:scale-[1.02] transition-transform"
                >
                  Acessar Setup Óculos
                  <ArrowRight className="w-4.5 h-4.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ETAPA 5: SETUP ÓCULOS */}
        {activeStep === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Instalação & Configuração de Óculos</h2>
              <p className="text-xs text-muted-foreground">
                Siga os passos abaixo para implantar o seu modelo 3D otimizado no dispositivo de Realidade Aumentada (AR) ou Virtual (VR).
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 pt-2">
              {/* Tutoriais de Dispositivo */}
              <div className="md:col-span-2 space-y-4">
                <div className="bg-muted/40 border border-border/50 rounded-2xl p-5 space-y-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary" />
                    Como Instalar (Passo a Passo Padrão)
                  </h3>
                  <ol className="text-xs text-muted-foreground space-y-2.5 list-decimal pl-4 leading-relaxed">
                    <li>Baixe e instale o software utilitário adequado para o seu óculos (disponível ao lado).</li>
                    <li>Conecte seu dispositivo VR/AR ao computador via cabo Link USB-C ou garanta que ambos estejam na mesma rede Wi-Fi local.</li>
                    <li>Abra o utilitário, selecione a opção "Side Load" ou "Instalar Pacote".</li>
                    <li>Selecione o arquivo baixado na <strong>Etapa 4 (Biblioteca de Downloads)</strong> e aguarde a transferência terminar.</li>
                    <li>No óculos, vá até as "Fontes Desconhecidas" ou "Aplicativos Externos" e inicie a demonstração da VX Industrial.</li>
                  </ol>
                </div>

                {/* Ajuda / Dúvidas */}
                <div className="bg-card border border-border/80 rounded-2xl p-5 flex items-start gap-3.5 shadow-sm">
                  <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider mb-1">Precisa de Ajuda Técnica?</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Se você encontrar alguma dificuldade na instalação, problemas de taxa de quadros (FPS) ou travamentos no dispositivo, acione diretamente nosso time técnico pós-vendas no SAC.
                    </p>
                    <a
                      href="https://wa.me/5511999999999"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-[10px] font-bold text-primary mt-3 hover:bg-primary/20 transition-all"
                    >
                      Conversar com o SAC VX Industrial
                    </a>
                  </div>
                </div>
              </div>

              {/* Biblioteca de Softwares da VX */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Softwares Disponíveis</span>
                
                {softwares.length > 0 ? (
                  <div className="space-y-3">
                    {softwares.map(soft => (
                      <div key={soft.id} className="bg-card border border-border/80 rounded-2xl p-4 space-y-3 shadow-sm hover:border-primary/25 transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs">{soft.title}</h4>
                            {soft.version && (
                              <span className="text-[9px] text-muted-foreground font-semibold px-1.5 py-0.5 rounded bg-muted border border-border/50 mt-1 inline-block">
                                Versão: {soft.version}
                              </span>
                            )}
                          </div>
                          <a
                            href={soft.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors shrink-0"
                            title="Baixar Software"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                        {soft.description && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{soft.description}</p>
                        )}
                        {soft.tutorial_url && (
                          <a
                            href={soft.tutorial_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary font-bold hover:underline block"
                          >
                            Ver Tutorial de Uso →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-6 bg-muted/20 border border-dashed border-border rounded-2xl text-xs text-muted-foreground">
                    Nenhum utilitário disponível no momento.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-border flex justify-between">
              <button
                onClick={() => setActiveStep(4)}
                className="px-5 py-2.5 border border-border hover:bg-muted font-bold text-xs rounded-xl transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  toast.success('Onboarding VX Industrial concluído com sucesso!');
                }}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md"
              >
                Concluir Onboarding
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente Interno para buscar arquivos de resultado
function ResultFilesList({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<VXProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('vx_project_files')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_result', true)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const resultFiles = await Promise.all(
          (data as VXProjectFile[]).map(async (file) => ({
            ...file,
            file_url: await createProjectDownloadUrl(file.file_url),
          }))
        );
        setFiles(resultFiles);
      }
      setLoading(false);
    };

    fetchFiles();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic p-2 bg-muted/40 rounded-xl">
        Nenhum arquivo final anexado para download. Por favor, aguarde o processamento terminar.
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
      {files.map(file => (
        <div key={file.id} className="bg-card border border-border/70 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs truncate block max-w-[120px]">{file.file_name}</span>
              {file.file_size && (
                <span className="text-[9px] text-muted-foreground/60">
                  {(file.file_size / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </div>
          </div>

          <a
            href={file.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg bg-secondary hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors shrink-0"
            title="Download de Alta Velocidade"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      ))}
    </div>
  );
}
