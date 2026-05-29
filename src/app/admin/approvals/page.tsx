import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Loader2, Plus, Image as ImageIcon, FileVideo, CheckCircle, XCircle, Clock, Grid, List, MessageSquare, Trash2, Expand, ExternalLink, Pencil, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { NotificationService } from "@/services/notification.service";

interface Creative {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_path: string;
  file_type: string;
  status: "pending" | "approved" | "rejected";
  feedback: string | null;
  created_at: string;
  clients?: { name: string };
}

export function AgencyApprovalsPage() {
  const { user } = useAuthStore();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [clientsOptions, setClientsOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingCreative, setEditingCreative] = useState<Creative | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCreatives();
    fetchClients();
  }, []);

  const fetchCreatives = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("post_approvals")
      .select(`*, clients (name)`)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar criativos");
      console.error(error);
    } else {
      setCreatives(data as Creative[]);
    }
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('id, name').in('status', ['active', 'onboarding']);
    if (!error && data) {
      setClientsOptions(data);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !user || !selectedClientId) {
      toast.error("Preencha cliente e tÃ­tulo.");
      return;
    }

    if (!editingCreative && !file) {
      toast.error("Selecione um arquivo para o novo envio.");
      return;
    }

    setUploading(true);
    try {
      let finalFileUrl = editingCreative?.file_url || "";
      let finalFilePath = editingCreative?.file_path || "";
      let finalFileType = editingCreative?.file_type || "";

      // Se houver arquivo novo, faz upload e deleta o antigo se estiver editando
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedClientId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('creative_assets')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('creative_assets')
          .getPublicUrl(fileName);

        // Deletar arquivo antigo do storage se estiver editando
        if (editingCreative?.file_path) {
          await supabase.storage.from('creative_assets').remove([editingCreative.file_path]);
        }

        finalFileUrl = publicUrlData.publicUrl;
        finalFilePath = fileName;
        finalFileType = file.type.startsWith('image/') ? 'image' : 
                        file.type.startsWith('video/') ? 'video' : 'document';
      }

      if (editingCreative) {
        // UPDATE
        const { error: dbError } = await supabase
          .from('post_approvals')
          .update({
            client_id: selectedClientId,
            title,
            description,
            file_url: finalFileUrl,
            file_type: finalFileType,
            file_path: finalFilePath,
            status: 'pending', // Volta para pendente no update
            feedback: null,    // Limpa feedback antigo
          })
          .eq('id', editingCreative.id);

        if (dbError) throw dbError;

        // NotificaÃ§Ã£o de atualizaÃ§Ã£o
        await NotificationService.createNotification({
          clientId: selectedClientId,
          type: 'approval',
          title: 'Criativo Atualizado',
          body: `A agÃªncia atualizou o material: "${title}". Confira a nova versÃ£o!`,
          link: '/client/approvals'
        });

        toast.success("Criativo atualizado e reenviado para aprovaÃ§Ã£o!");
      } else {
        // INSERT (NOVO)
        const { error: dbError } = await supabase
          .from('post_approvals')
          .insert({
            client_id: selectedClientId,
            title,
            description,
            file_url: finalFileUrl,
            file_type: finalFileType,
            file_path: finalFilePath,
            created_by: user.id,
          });

        if (dbError) throw dbError;

        await NotificationService.createNotification({
          clientId: selectedClientId,
          type: 'approval',
          title: 'Novo Criativo para AprovaÃ§Ã£o',
          body: `A agÃªncia enviou um novo material: "${title}". Confira agora!`,
          link: '/client/approvals'
        });

        toast.success("Novo criativo enviado com sucesso!");
      }

      setOpenModal(false);
      setFile(null);
      setTitle("");
      setDescription("");
      setSelectedClientId("");
      setEditingCreative(null);
      fetchCreatives();
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar: " + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (creative: Creative) => {
    setEditingCreative(creative);
    setSelectedClientId(creative.client_id);
    setTitle(creative.title);
    setDescription(creative.description || "");
    setFile(null); // Arquivo Ã© opcional na ediÃ§Ã£o
    setOpenModal(true);
  };

  const handleDelete = async (creativeId: string, filePath: string) => {
    if (!confirm("Tem certeza que deseja excluir esta arte? Isso apagarÃ¡ tambÃ©m o arquivo armazenado.")) return;

    try {
      // Deletar da tabela
      const { error: dbError } = await supabase.from('post_approvals').delete().eq('id', creativeId);
      if (dbError) throw dbError;

      // Tentar deletar do storage (sem quebrar caso nÃ£o encontre)
      if (filePath) {
        await supabase.storage.from('creative_assets').remove([filePath]);
      }

      toast.success("Criativo excluÃ­do com sucesso!");
      setCreatives(prev => prev.filter(c => c.id !== creativeId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleQuickUpdate = async (file: File) => {
    if (!selectedCreative) return;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedCreative.client_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('creative_assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('creative_assets')
        .getPublicUrl(fileName);

      // Deletar arquivo antigo
      if (selectedCreative.file_path) {
        await supabase.storage.from('creative_assets').remove([selectedCreative.file_path]);
      }

      const finalFileType = file.type.startsWith('image/') ? 'image' : 
                          file.type.startsWith('video/') ? 'video' : 'document';

      const { error: dbError } = await supabase
        .from('post_approvals')
        .update({
          file_url: publicUrlData.publicUrl,
          file_type: finalFileType,
          file_path: fileName,
          status: 'pending',
          feedback: null,
        })
        .eq('id', selectedCreative.id);

      if (dbError) throw dbError;

      await NotificationService.createNotification({
        clientId: selectedCreative.client_id,
        type: 'approval',
        title: 'Criativo Atualizado',
        body: `A agÃªncia atualizou o material: "${selectedCreative.title}". Confira agora!`,
        link: '/client/approvals'
      });

      toast.success("Nova versÃ£o enviada com sucesso!");
      fetchCreatives();
      setSelectedCreative(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao subir nova versÃ£o.");
    } finally {
      setUploading(false);
    }
  };


  const statusMap = {
    pending: { label: "Pendente", icon: Clock, color: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
    approved: { label: "Aprovado", icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
    rejected: { label: "Reprovado", icon: XCircle, color: "text-red-600 dark:text-red-400 bg-red-500/10" },
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start sm:flex-row flex-col gap-4">
        <PageHeader 
          title="Central de AprovaÃ§Ãµes (AgÃªncia)" 
          description="Gerencie todas as artes enviadas e pendentes de aprovaÃ§Ã£o dos clientes." 
        />
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex bg-muted p-1 rounded-md">
            <button
              title="VisualizaÃ§Ã£o em Grade"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              title="VisualizaÃ§Ã£o em Lista"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Dialog open={openModal} onOpenChange={(open) => {
            setOpenModal(open);
            if (!open) {
              setEditingCreative(null);
              setTitle("");
              setDescription("");
              setSelectedClientId("");
              setFile(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" /> Novo Envio</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCreative ? 'Editar Criativo' : 'Enviar Criativo para AprovaÃ§Ã£o'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>TÃ­tulo do Post / Criativo</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: Post Carrossel Dia das MÃ£es" />
                </div>
                <div className="space-y-2">
                  <Label>DescriÃ§Ã£o / Copy (Opcional)</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Texto da legenda ou instruÃ§Ãµes..." />
                </div>
                <div className="space-y-2">
                  <Label>Arquivo {editingCreative ? '(Opcional se nÃ£o quiser trocar)' : '(Imagem ou VÃ­deo)'}</Label>
                  <Input 
                    type="file" 
                    accept="image/*,video/*" 
                    onChange={e => setFile(e.target.files?.[0] || null)} 
                    required={!editingCreative} 
                  />
                </div>
                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editingCreative ? 'Salvar AlteraÃ§Ãµes' : 'Confirmar Envio'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : creatives.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
          <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <h4 className="text-lg font-medium text-foreground">Nenhum criativo enviado</h4>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">FaÃ§a o upload do primeiro material para envio aos clientes.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {creatives.map(creative => {
            const StatusIcon = statusMap[creative.status].icon;
            return (
              <div key={creative.id} className="border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow transition-shadow flex flex-col relative group">
                {/* Lixeira pra delete rapido */}
                <button 
                  title="Excluir"
                  onClick={() => handleDelete(creative.id, creative.file_path)}
                  className="absolute top-2 left-2 z-10 w-7 h-7 bg-background/90 shadow-md text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* BotÃ£o Editar flutuante */}
                <button 
                  title="Editar / Substituir"
                  onClick={() => openEditModal(creative)}
                  className="absolute top-2 left-10 z-10 w-7 h-7 bg-background/90 shadow-md text-muted-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted hover:text-primary"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <div 
                  className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden group/media cursor-pointer"
                  onClick={() => setSelectedCreative(creative)}
                >
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 flex items-center justify-center transition-opacity z-10">
                    <Expand className="w-8 h-8 text-white drop-shadow" />
                  </div>
                  {creative.file_type === 'image' ? (
                    <img src={creative.file_url} alt={creative.title} className="w-full h-full object-cover" />
                  ) : (
                    <video src={creative.file_url} className="w-full h-full object-cover" />
                  )}
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 shadow-sm ${statusMap[creative.status].color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusMap[creative.status].label}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">{creative.clients?.name || 'Cliente Removido'}</span>
                  <h4 className="font-semibold text-foreground line-clamp-1">{creative.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{creative.description || "Sem descriÃ§Ã£o"}</p>
                  
                  {creative.feedback && (
                    <div className="mt-3 p-2 bg-muted/50 rounded border border-border/50 flex gap-2 w-full">
                      <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground/50 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Feedback do Cliente:</span>
                        <p className="text-xs text-muted-foreground italic">{creative.feedback}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted border-b border-border text-muted-foreground font-medium whitespace-nowrap">
              <tr>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">TÃ­tulo / DescriÃ§Ã£o</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Feedback</th>
                <th className="px-4 py-3 text-right">AÃ§Ã£o</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {creatives.map(creative => {
                const StatusIcon = statusMap[creative.status].icon;
                return (
                  <tr key={creative.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 w-16">
                      <div 
                        className="w-12 h-12 bg-muted rounded overflow-hidden flex items-center justify-center relative cursor-pointer group"
                        onClick={() => setSelectedCreative(creative)}
                      >
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                          <Expand className="w-4 h-4 text-white drop-shadow" />
                        </div>
                        {creative.file_type === 'image' ? (
                          <img src={creative.file_url} alt={creative.title} className="w-full h-full object-cover" />
                        ) : (
                          <FileVideo className="w-5 h-5 text-muted-foreground/50" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground truncate max-w-[150px]">
                      {creative.clients?.name || '---'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{creative.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{creative.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex px-2 py-1 rounded-full text-[10px] uppercase font-bold items-center gap-1 ${statusMap[creative.status].color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusMap[creative.status].label}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                       <p className="text-xs text-muted-foreground italic line-clamp-2">{creative.feedback || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                        <button 
                          title="Excluir arte"
                          onClick={() => handleDelete(creative.id, creative.file_path)}
                          className="p-1.5 rounded text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-500 transition-colors inline-block"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          title="Editar arte"
                          onClick={() => openEditModal(creative)}
                          className="p-1.5 rounded text-muted-foreground/50 hover:bg-primary/10 hover:text-primary transition-colors inline-block ml-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Expansion / VisualizaÃ§Ã£o */}
      <Dialog open={!!selectedCreative} onOpenChange={(open) => !open && setSelectedCreative(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background gap-0 border-border">
          <DialogTitle className="sr-only">VisualizaÃ§Ã£o do Criativo</DialogTitle>
          <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
            {/* Esquerda: MÃ­dia View */}
            <div className="flex-1 bg-zinc-950 flex items-center justify-center relative p-4 md:p-8 min-h-[400px]">
              {selectedCreative?.file_type === 'image' ? (
                <img 
                  src={selectedCreative.file_url} 
                  alt={selectedCreative.title} 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
                />
              ) : (
                <video 
                  src={selectedCreative?.file_url} 
                  controls 
                  autoPlay
                  className="max-w-full max-h-[80vh] w-full rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
                />
              )}

              {/* BotÃ£o flutuante para abrir original */}
              <a 
                href={selectedCreative?.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-2 rounded-full transition-all shadow-xl"
                title="Ver arquivo original"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
            
            {/* Direita: InteraÃ§Ãµes e Infos */}
            <div className="w-full md:w-[380px] bg-card flex flex-col border-l border-border">
              <div className="p-6 border-b border-border">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-bold text-xl text-foreground">{selectedCreative?.title}</h3>
                </div>
                <div className="mb-4">
                  <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Cliente: {selectedCreative?.clients?.name || 'Desconhecido'}</span>
                </div>
                {selectedCreative?.description ? (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border/50 italic">
                    "{selectedCreative.description}"
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">Sem legenda ou descriÃ§Ã£o.</p>
                )}
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Status Atual:</h4>
                  {selectedCreative && (
                    <div className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold items-center gap-1.5 ${statusMap[selectedCreative.status].color}`}>
                      {React.createElement(statusMap[selectedCreative.status].icon, { className: "w-4 h-4" })}
                      {statusMap[selectedCreative.status].label}
                    </div>
                  )}
                </div>

                {selectedCreative?.feedback && (
                  <div className="space-y-2 mb-6">
                    <label className="text-sm font-semibold text-foreground">
                      ComentÃ¡rio / SugestÃ£o do Cliente
                    </label>
                    <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
                      <p className="text-sm text-muted-foreground italic">{selectedCreative.feedback}</p>
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-border mt-auto space-y-3">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,video/*"
                    title="Selecionar arquivo para nova versÃ£o"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleQuickUpdate(file);
                    }}
                  />
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Enviar Nova VersÃ£o (Substituir)
                  </Button>
                  {selectedCreative?.status !== 'pending' && (
                    <Button 
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white border-none"
                      onClick={async () => {
                        if (!selectedCreative) return;
                        const { error } = await supabase
                          .from('post_approvals')
                          .update({ status: 'pending', feedback: null })
                          .eq('id', selectedCreative.id);
                        
                        if (!error) {
                          toast.success("Status resetado para Pendente!");
                          fetchCreatives();
                          setSelectedCreative(null);
                        }
                      }}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Solicitar Nova RevisÃ£o
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                    onClick={() => {
                      if (selectedCreative) {
                        handleDelete(selectedCreative.id, selectedCreative.file_path);
                        setSelectedCreative(null);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir Criativo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

