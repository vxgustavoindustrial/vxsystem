import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";
import { NotificationService } from "@/services/notification.service";
import { AutomationService } from "@/services/automation.service";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Grid, List, CheckCircle, XCircle, Clock, FileVideo, Expand, ExternalLink, Shield } from "lucide-react";

interface Creative {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  status: "pending" | "approved" | "rejected";
  feedback: string | null;
}

export function ClientApprovalsPage() {
  const { clientId, profile, role } = useAuth();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);

  // Armazena a sugestÃ£o digitada para cada card
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  const canManage = role === 'admin' || profile?.role === 'admin' || profile?.permissions?.approvals === 'manage' || !profile?.permissions?.approvals;

  useEffect(() => {
    if (clientId) fetchCreatives();
    
    // Marcar notificaÃ§Ãµes como lidas ao entrar na pÃ¡gina
    if (clientId) {
      NotificationService.markAsReadByType(clientId, 'approval');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const fetchCreatives = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("post_approvals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar os criativos pendentes");
      console.error(error);
    } else {
      setCreatives(data as Creative[]);
      // Popula o estado inicial de feedbacks com o que jÃ¡ tem no banco
      const initialFeedbacks: Record<string, string> = {};
      data?.forEach(c => {
        initialFeedbacks[c.id] = c.feedback || "";
      });
      setFeedbacks(initialFeedbacks);
    }
    setLoading(false);
  };

  const handleAction = async (id: string, newStatus: "approved" | "rejected") => {
    setProcessingId(id);
    const feedbackText = feedbacks[id] || (newStatus === 'rejected' ? "Sem sugestÃ£o detalhada" : null);
    
    try {
      const { data, error } = await supabase
        .from("post_approvals")
        .update({ status: newStatus, feedback: feedbackText })
        .eq("id", id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("NÃ£o foi possÃ­vel atualizar. Verifique suas permissÃµes.");
        return;
      }
      
      toast.success(newStatus === "approved" ? "Arte aprovada com sucesso!" : "AlteraÃ§Ãµes solicitadas com sucesso.");
      
      // Se for reprovado, cria tarefa automÃ¡tica para a equipe
      if (newStatus === 'rejected' && clientId && profile?.id) {
        await AutomationService.createTaskFromRejection(clientId, profile.id, {
          title: creatives.find(c => c.id === id)?.title || 'Arte sem tÃ­tulo',
          feedback: feedbackText || 'Sem feedback detalhado'
        });
      }

      setCreatives(prev => prev.map(c => 
        c.id === id ? { ...c, status: newStatus, feedback: feedbackText } : c
      ));

      // Se o modal estiver aberto com este criativo, sincroniza
      if (selectedCreative?.id === id) {
        setSelectedCreative({ ...selectedCreative, status: newStatus, feedback: feedbackText });
      }
    } catch (err) {
      console.error(err);
      toast.error("Houve um erro ao processar sua aÃ§Ã£o.");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = creatives.filter(c => c.status === "pending").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
        <PageHeader 
          title="Central de AprovaÃ§Ãµes" 
          description={pendingCount > 0 
            ? `VocÃª tem ${pendingCount} criativo(s) aguardando sua revisÃ£o.` 
            : "Acompanhe as entregas que precisam da sua autorizaÃ§Ã£o."} 
        />
        <div className="flex bg-muted p-1 rounded-md shrink-0">
          <button
            title="VisualizaÃ§Ã£o em Grade"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            title="VisualizaÃ§Ã£o em Lista"
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : creatives.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/30 border-border">
          <CheckCircle className="w-16 h-16 mx-auto text-emerald-500/50 mb-4" />
          <h4 className="text-xl font-medium text-foreground">Tudo Atualizado!</h4>
          <p className="text-muted-foreground mt-2">VocÃª nÃ£o possui criativos ou posts aguardando aprovaÃ§Ã£o no momento.</p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {creatives.map(creative => (
                <div key={creative.id} className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm flex flex-col">
                  {/* Arquivo / MÃ­dia */}
                  <div className="aspect-[4/3] bg-muted relative group overflow-hidden cursor-pointer" onClick={() => setSelectedCreative(creative)}>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                      <Expand className="w-8 h-8 text-white drop-shadow" />
                    </div>
                    {creative.file_type === 'image' ? (
                      <img src={creative.file_url} alt={creative.title} className="w-full h-full object-cover" />
                    ) : (
                      <video src={creative.file_url} className="w-full h-full object-cover" />
                    )}
                    {creative.status === 'pending' && (
                      <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full shadow-lg z-20">
                        Aguardando
                      </div>
                    )}
                  </div>

                  {/* InformaÃ§Ãµes */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-foreground line-clamp-1">{creative.title}</h3>
                    {creative.description && (
                      <p className="text-sm text-muted-foreground mt-2 bg-muted/50 p-3 rounded-lg border border-border italic line-clamp-3">
                        "{creative.description}"
                      </p>
                    )}

                    <div className="mt-4 pt-4 border-t space-y-4">
                      {creative.status === 'approved' && (
                        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-3 flex items-center justify-center gap-2 rounded-lg font-medium text-sm border border-emerald-500/20">
                          <CheckCircle className="w-5 h-5" />
                          Arte Aprovada
                        </div>
                      )}

                      {creative.status === 'rejected' && (
                        <div className="space-y-3">
                          <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-3 flex items-center justify-center gap-2 rounded-lg font-medium text-sm border border-amber-500/20">
                            <Clock className="w-5 h-5" />
                            Aguardando Ajustes da AgÃªncia
                          </div>
                          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border italic">
                            Sua sugestÃ£o: "{creative.feedback}"
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-muted-foreground hover:text-foreground text-[10px] uppercase font-bold"
                            onClick={() => setCreatives(prev => prev.map(c => c.id === creative.id ? { ...c, status: 'pending' } : c))}
                          >
                            Editar SugestÃ£o
                          </Button>
                        </div>
                      )}

                      {creative.status === 'pending' && (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Tenho uma sugestÃ£o / CorreÃ§Ã£o
                            </label>
                            <Textarea 
                              placeholder={canManage ? "Gostaria de mudar a cor, o texto da imagem..." : "VocÃª nÃ£o tem permissÃ£o para enviar sugestÃµes"}
                              className="text-sm resize-none h-20"
                              value={feedbacks[creative.id] || ""}
                              onChange={e => setFeedbacks({ ...feedbacks, [creative.id]: e.target.value })}
                              disabled={!canManage}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              className="w-full border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 font-medium"
                              onClick={() => handleAction(creative.id, "rejected")}
                              disabled={processingId === creative.id || !canManage}
                            >
                              {processingId === creative.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                              Reprovar
                            </Button>
                            <Button 
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                              onClick={() => handleAction(creative.id, "approved")}
                              disabled={processingId === creative.id || !canManage}
                            >
                              {processingId === creative.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                              Aprovar
                            </Button>
                          </div>
                          {!canManage && (
                            <p className="text-[10px] text-center text-muted-foreground mt-2 italic">
                              Seu acesso Ã© apenas para visualizaÃ§Ã£o.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-muted border-b border-border text-muted-foreground font-medium whitespace-nowrap">
                     <tr>
                       <th className="px-6 py-4">PrÃ©via</th>
                       <th className="px-6 py-4">Detalhes</th>
                       <th className="px-6 py-4 w-64">Sua SugestÃ£o</th>
                       <th className="px-6 py-4 text-center">AÃ§Ãµes</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y">
                     {creatives.map(creative => (
                       <tr key={creative.id} className="hover:bg-slate-50/50">
                         <td className="px-6 py-4 w-32 text-center">
                           <div 
                             className="w-24 h-24 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center relative shadow-sm cursor-pointer group mx-auto"
                             onClick={() => setSelectedCreative(creative)}
                           >
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                               <Expand className="w-6 h-6 text-white drop-shadow" />
                             </div>
                             {creative.file_type === 'image' ? (
                               <img src={creative.file_url} alt={creative.title} className="w-full h-full object-cover" />
                             ) : (
                               <div className="bg-muted w-full h-full flex items-center justify-center">
                                 <FileVideo className="w-8 h-8 text-muted-foreground" />
                               </div>
                             )}
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-2 mb-1">
                             <h4 className="font-bold text-foreground text-base">{creative.title}</h4>
                             {creative.status === 'pending' && <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Aguardando</span>}
                             {creative.status === 'approved' && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Aprovado</span>}
                             {creative.status === 'rejected' && <span className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Ajustes</span>}
                           </div>
                           <p className="text-sm text-muted-foreground line-clamp-2 max-w-sm">{creative.description || "Sem descriÃ§Ã£o"}</p>
                         </td>
                         <td className="px-6 py-4">
                           {creative.status === 'pending' ? (
                             <Textarea 
                               placeholder={canManage ? "Digite sua sugestÃ£o..." : "Apenas visualizaÃ§Ã£o"}
                               className="text-sm resize-none h-20"
                               value={feedbacks[creative.id] || ""}
                               onChange={e => setFeedbacks({ ...feedbacks, [creative.id]: e.target.value })}
                               disabled={!canManage}
                             />
                           ) : (
                             <div className="bg-muted/50 p-3 rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground italic">"{creative.feedback || "Sem comentÃ¡rio adicionado."}"</p>
                             </div>
                           )}
                         </td>
                         <td className="px-6 py-4">
                           {creative.status === 'pending' ? (
                             canManage ? (
                               <div className="flex flex-col gap-2 max-w-[140px] mx-auto">
                                 <Button 
                                   size="sm"
                                   className="bg-emerald-600 hover:bg-emerald-700 dark:text-white"
                                   onClick={() => handleAction(creative.id, "approved")}
                                   disabled={processingId === creative.id}
                                 >
                                   <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprovar
                                 </Button>
                                 <Button 
                                   size="sm"
                                   variant="outline"
                                   className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-200 dark:border-red-900/50"
                                   onClick={() => handleAction(creative.id, "rejected")}
                                   disabled={processingId === creative.id}
                                 >
                                   <XCircle className="w-3.5 h-3.5 mr-1" /> Reprovar
                                 </Button>
                               </div>
                             ) : (
                               <div className="flex flex-col items-center text-muted-foreground group" title="VocÃª nÃ£o tem permissÃ£o para realizar aÃ§Ãµes">
                                 <Shield className="w-6 h-6 mb-1 text-muted-foreground/30 group-hover:text-amber-500 transition-colors" />
                                 <span className="text-[10px] font-bold uppercase tracking-tight">VisualizaÃ§Ã£o</span>
                               </div>
                             )
                           ) : creative.status === 'approved' ? (
                             <div className="flex flex-col items-center gap-1 text-emerald-600">
                               <CheckCircle className="w-8 h-8" />
                               <span className="text-[10px] font-bold uppercase tracking-tight">Aprovado</span>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center gap-1 text-amber-500 dark:text-amber-400" title="Aguardando Ajustes">
                               <Clock className="w-8 h-8" />
                               <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-none">Aguardando<br/>Ajuste</span>
                             </div>
                           )}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          )}
        </>
      )}

      {/* Modal Expansion / VisualizaÃ§Ã£o */}
      <Dialog open={!!selectedCreative} onOpenChange={(open) => !open && setSelectedCreative(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-border gap-0">
          <DialogTitle className="sr-only">VisualizaÃ§Ã£o do Criativo</DialogTitle>
          <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
            {/* Esquerda: MÃ­dia View */}
            <div className="flex-1 bg-[#0f172a] flex items-center justify-center relative p-4 md:p-8 min-h-[400px]">
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
                {selectedCreative?.description ? (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border italic">
                    "{selectedCreative.description}"
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">Sem legenda ou descriÃ§Ã£o.</p>
                )}
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {selectedCreative?.status === 'approved' ? (
                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-500/20 text-center">
                    <CheckCircle className="w-8 h-8 mb-1" />
                    <div>
                      <span className="font-bold block text-lg">Arte Aprovada</span>
                      <span className="text-sm opacity-90 block mt-1">Este material estÃ¡ pronto para ser publicado!</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedCreative?.status === 'rejected' && (
                      <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-4 flex flex-col gap-1 rounded-xl border border-amber-500/20 text-sm mb-4 text-center">
                        <Clock className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        <span className="font-bold block">Aguardando AgÃªncia</span>
                        <span className="opacity-80 italic">"{selectedCreative.feedback}"</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 text-xs h-7 border-amber-500/20 bg-background text-foreground hover:bg-muted"
                          onClick={() => {
                            if (selectedCreative) {
                              setCreatives(prev => prev.map(c => c.id === selectedCreative.id ? { ...c, status: 'pending' } : c));
                              setSelectedCreative({ ...selectedCreative, status: 'pending' });
                            }
                          }}
                        >
                          Alterar ComentÃ¡rio
                        </Button>
                      </div>
                    )}

                    {selectedCreative?.status === 'pending' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-foreground">
                            Sua SugestÃ£o / CorreÃ§Ã£o
                          </label>
                          <Textarea 
                            placeholder={canManage ? "Ex: Mudar a cor do fundo, alterar o texto da chamada..." : "VocÃª nÃ£o tem permissÃ£o para enviar sugestÃµes"}
                            className="text-sm resize-none h-24"
                            value={selectedCreative ? feedbacks[selectedCreative.id] || "" : ""}
                            onChange={e => {
                              if (selectedCreative) {
                                setFeedbacks({ ...feedbacks, [selectedCreative.id]: e.target.value });
                              }
                            }}
                            disabled={!canManage}
                          />
                                                   <Button 
                            size="lg"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-500/10"
                            onClick={() => {
                              if (selectedCreative) {
                                handleAction(selectedCreative.id, "approved");
                              }
                            }}
                            disabled={processingId === selectedCreative?.id || !canManage}
                          >
                            {processingId === selectedCreative?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                            Sim, Aprovar
                          </Button>
                          <Button 
                            size="lg"
                            variant="outline" 
                            className="w-full border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                            onClick={() => {
                              if (selectedCreative) {
                                handleAction(selectedCreative.id, "rejected");
                              }
                            }}
                            disabled={processingId === selectedCreative?.id || !canManage}
                          >
                            {processingId === selectedCreative?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5 mr-2" />}
                            Recusar e Sugerir
                          </Button>
                          {!canManage && (
                            <p className="text-xs text-center text-muted-foreground italic bg-muted/50 p-2 rounded-lg border border-dashed border-border">
                              Apenas usuÃ¡rios com permissÃ£o de gerenciamento podem aprovar ou solicitar ajustes.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

