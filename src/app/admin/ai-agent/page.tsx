import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/services/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Bot, MessageCircle, Loader2, Plus, RefreshCw, 
  Trash2, Rocket, ListFilter, Search, Copy, Check
} from "lucide-react";
import { toast } from "sonner";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_name: string;
  status: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  whatsapp_instance_id: string | null;
  whatsapp_group_id: string | null;
  ai_summary_enabled: boolean;
}

interface WhatsAppGroup {
  id: string;
  subject?: string;
  name?: string;
}

export default function AIAgentPage() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'instances';
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [newInstanceName, setNewInstanceName] = useState("");

  // Group Selection States
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [copiedJid, setCopiedJid] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: instData } = await supabase.from("whatsapp_instances").select("*").order("created_at", { ascending: false });
      const { data: clientData } = await supabase.from("clients").select("id, name, whatsapp_instance_id, whatsapp_group_id, ai_summary_enabled").order("name", { ascending: true });

      setInstances(instData || []);
      setClients(clientData || []);
    } catch (err) {
      toast.error("Erro ao carregar dados.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error("Dê um nome para a instância.");
      return;
    }
    setCreatingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-manager", {
        body: { action: "create-global-instance", name: newInstanceName }
      });
      
      if (error) {
        console.error("Erro na Edge Function:", error);
        toast.error(`Erro: ${error.message || "Erro na Edge Function"}`);
        return;
      }

      if (data?.success === false) {
        console.error("Erro processado pela Edge Function:", data.error);
        toast.error(`Erro: ${data.error || "Erro desconhecido"}`);
        setCreatingInstance(false);
        return;
      }
      
      toast.success("Instância criada! Escaneie o QR Code.");
      setQrCode(data.base64 || null);
      setPollingId(data.instanceId);
      setNewInstanceName("");
      fetchData();
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message || "Tente novamente"}`);
      console.error(err);
    } finally {
      setCreatingInstance(false);
    }
  };

  const checkStatus = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("evolution-manager", {
        body: { action: "check-global-status", instanceId: id }
      });
      if (error) throw error;
      if (data.status === "open") {
        toast.success("WhatsApp Conectado!");
        setPollingId(null);
        setQrCode(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  }, [fetchData]);

  useEffect(() => {
    let interval: any;
    if (pollingId) {
      interval = setInterval(() => checkStatus(pollingId), 5000);
    }
    return () => clearInterval(interval);
  }, [pollingId, checkStatus]);

  const handleLogout = async (id: string) => {
    if (!confirm("Deseja desconectar e remover esta instância?")) return;
    try {
      const { error } = await supabase.functions.invoke("evolution-manager", {
        body: { action: "logout-global", instanceId: id }
      });
      if (error) throw error;
      toast.success("Instância removida.");
      fetchData();
    } catch (err) {
      toast.error("Erro ao remover.");
      console.error(err);
    }
  };

  const updateClientConfig = async (clientId: string, updates: Partial<Client>) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", clientId);
      if (error) throw error;
      toast.success("Configuração atualizada.");
      setClients(clients.map(c => c.id === clientId ? { ...c, ...updates } : c));
    } catch (err) {
      toast.error("Erro ao salvar.");
      console.error(err);
    }
  };

  const handleManualTrigger = async () => {
    try {
      const { error } = await supabase.functions.invoke("whatsapp-ai-summary", {
        body: {}
      });
      if (error) throw error;
      toast.success("Disparo de resumos iniciado!");
    } catch (err) {
      toast.error("Erro ao disparar.");
      console.error(err);
    }
  };

  const openGroupPicker = async (instanceId: string) => {
    setIsGroupModalOpen(true);
    setLoadingGroups(true);
    setGroups([]);
    setCopiedJid(null);

    try {
      const { data, error } = await supabase.functions.invoke("evolution-manager", {
        body: { action: "fetch-groups", instanceId }
      });

      if (error) throw error;
      
      if (data?.success === false) {
        toast.error(`${data.error || "Erro desconhecido ao carregar grupos"}`);
        setIsGroupModalOpen(false);
        return;
      }

      // Normalizar: v2 costuma mandar { groups: [] }
      const groupsArray = Array.isArray(data) ? data : (data?.groups || []);
      setGroups(groupsArray);
    } catch {
      toast.error("Erro ao carregar grupos. Verifique se o WhatsApp está conectado.");
      setIsGroupModalOpen(false);
    } finally {
      setLoadingGroups(false);
    }
  };

  const copyToClipboard = (jid: string) => {
    navigator.clipboard.writeText(jid);
    setCopiedJid(jid);
    toast.success("JID copiado!");
    setTimeout(() => setCopiedJid(null), 2000);
  };

  const groupsList = (Array.isArray(groups) ? groups : []) as WhatsAppGroup[];
  const filteredGroups = groupsList.filter((g: WhatsAppGroup) => 
    (g.subject || g.name || "").toLowerCase().includes(groupSearch.toLowerCase()) || 
    (g.id || "").includes(groupSearch)
  );

  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="w-8 h-8 text-blue-500" />
        <PageHeader 
            title="Agente IA de Onboarding" 
            description="Gerencie seus números de WhatsApp e as automações de cada cliente." 
        />
      </div>

      <Tabs value={activeTab} className="w-full">

        <TabsContent value="instances" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 border border-border rounded-xl p-6 bg-card shadow-sm h-fit">
              <h3 className="font-semibold mb-4">Nova Instância</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Amigável</Label>
                  <Input 
                    placeholder="Ex: Celular Principal Agência" 
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateInstance}
                  disabled={creatingInstance || !!qrCode}
                >
                  {creatingInstance ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Gerar QR Code
                </Button>
                
                {qrCode && (
                  <div className="mt-6 p-4 border border-border rounded-lg bg-muted/50 flex flex-col items-center">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-full aspect-square mb-4 shadow-sm" />
                    <p className="text-xs text-center text-muted-foreground animate-pulse">Aguardando leitura do WhatsApp...</p>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setQrCode(null); setPollingId(null); }}>Cancelar</Button>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <h3 className="font-semibold px-1 flex items-center gap-2">
                Suas Instâncias Conectadas
                <Button variant="ghost" size="icon" onClick={fetchData} className="h-6 w-6">
                  <RefreshCw className="w-3 h-3 text-muted-foreground" />
                </Button>
              </h3>
              
              <div className="grid gap-4">
                {(instances || []).length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/30">
                    <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Nenhuma instância cadastrada ainda.</p>
                  </div>
                ) : (
                  (instances || []).map((inst) => (
                    <div key={inst.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${inst.status === 'open' ? 'bg-green-500' : 'bg-muted'} animate-pulse`} />
                        <div>
                          <p className="font-medium text-sm text-foreground">{inst.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{inst.instance_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={inst.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                          {inst.status === 'open' ? 'Conectado' : 'Aguardando'}
                        </Badge>
                        
                        {inst.status === 'open' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openGroupPicker(inst.id)}
                            className="h-8 text-xs flex items-center gap-2"
                          >
                            <ListFilter className="w-3 h-3" />
                            Grupos
                          </Button>
                        )}

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleLogout(inst.id)}
                          className="text-muted-foreground hover:text-red-500 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="clients" className="pt-4">
          <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Instância de Envio</TableHead>
                  <TableHead>JID do Grupo</TableHead>
                  <TableHead className="text-center">Resumo Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(clients || []).map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <Select 
                        value={client.whatsapp_instance_id || "none"}
                        onValueChange={(val) => updateClientConfig(client.id, { whatsapp_instance_id: val === "none" ? null : val })}
                      >
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                          <SelectValue placeholder="Selecione um número" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {(instances || []).filter(i => i.status === 'open').map(inst => (
                            <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input 
                        className="h-8 text-xs w-[250px]" 
                        placeholder="Ex: 12036302456789@g.us"
                        value={client.whatsapp_group_id || ""}
                        onBlur={(e) => updateClientConfig(client.id, { whatsapp_group_id: e.target.value })}
                        onChange={(e) => {
                          const newClients = clients.map(c => c.id === client.id ? { ...c, whatsapp_group_id: e.target.value } : c);
                          setClients(newClients);
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch 
                          checked={client.ai_summary_enabled}
                          onCheckedChange={(checked) => updateClientConfig(client.id, { ai_summary_enabled: checked })}
                          className="scale-75"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={handleManualTrigger} className="h-8 flex items-center gap-2 text-muted-foreground hover:text-primary">
                        <Rocket className="w-3 h-3" />
                        Testar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Listagem de Grupos */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent className="max-w-[500px] h-[600px] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Grupos da Instância</DialogTitle>
            <DialogDescription>Encontre o grupo e copie o JID para configurar no cliente.</DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar por nome do grupo..." 
                className="pl-9"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6 text-sm">
            {loadingGroups ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs">Buscando grupos na Evolution API...</p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">Nenhum grupo encontrado.</p>
              </div>
            ) : (
              <div className="grid gap-2 text-foreground">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex flex-col p-3 border border-border rounded-lg bg-muted/50 hover:bg-muted transition-all gap-1"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-foreground line-clamp-1">{group.subject || "Sem Nome"}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-primary hover:text-primary/80"
                        onClick={() => copyToClipboard(group.id)}
                      >
                        {copiedJid === group.id ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        Copiar JID
                      </Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono break-all">{group.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
