import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileSignature, Plus, Search, MapPin,
  Loader2, Trash2
} from "lucide-react";
import { format } from "date-fns";

type ClientOption = { id: string; name: string };

interface Contact {
  id: string; client_id: string | null; company_name: string;
  contact_name: string; email: string | null; phone: string | null;
  source: string; status: string; notes: string | null; created_at: string;
}

interface Visit {
  id: string; contact_id: string | null; client_id: string | null;
  scheduled_at: string; location: string | null; status: string;
  objective: string | null; outcome: string | null;
}

interface Proposal {
  id: string; client_id: string | null; contact_id: string | null;
  title: string; amount: number | null; status: string;
  valid_until: string | null; description: string | null; document_url: string | null;
}

const pipelineStages = [
  { id: "new", label: "Novo", icon: "🆕" },
  { id: "contacted", label: "Contatado", icon: "📞" },
  { id: "qualified", label: "Qualificado", icon: "🎯" },
  { id: "proposal", label: "Proposta", icon: "📄" },
  { id: "converted", label: "Convertido", icon: "✅" },
  { id: "lost", label: "Perdido", icon: "❌" },
];

const proposalStatusLabels: Record<string, string> = {
  draft: "Rascunho", sent: "Enviada", accepted: "Aceita",
  rejected: "Recusada", expired: "Expirada",
};

function useClients() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  useEffect(() => {
    supabase.from("clients").select("id, name").is("deleted_at", null).order("name").then(({ data }) => {
      setClients((data as ClientOption[] | null) || []);
    });
  }, []);
  return clients;
}

export function CrmKanbanPage() {
  const clients = useClients();
  const { user } = useAuthStore();

  // Filters
  const [clientFilter, setClientFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  // New contact form
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState({
    company_name: "", contact_name: "", email: "", phone: "",
    source: "site", notes: "", client_id: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [contactR, visitR, proposalR] = await Promise.all([
      supabase.from("sales_contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("sales_visits").select("*").order("scheduled_at", { ascending: false }),
      supabase.from("sales_proposals").select("*").order("created_at", { ascending: false }),
    ]);
    setContacts((contactR.data as Contact[] | null) || []);
    setVisits((visitR.data as Visit[] | null) || []);
    setProposals((proposalR.data as Proposal[] | null) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    if (clientFilter !== "all") {
      filtered = filtered.filter(c => c.client_id === clientFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.company_name.toLowerCase().includes(term) ||
        c.contact_name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [contacts, clientFilter, searchTerm]);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("sales_contacts").insert({
      ...form, client_id: form.client_id || null,
      email: form.email || null, phone: form.phone || null,
      notes: form.notes || null, created_by: user?.id || null,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao registrar contato.");
    toast.success("Contato registrado.");
    setForm({ company_name: "", contact_name: "", email: "", phone: "", source: "site", notes: "", client_id: "" });
    setShowNewForm(false);
    void load();
  };

  const updateContactStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("sales_contacts").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao atualizar etapa.");
    else { toast.success("Contato atualizado!"); void load(); }
  };

  const deleteContact = async (id: string) => {
    if (!window.confirm("Excluir este contato?")) return;
    const { error } = await supabase.from("sales_contacts").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else { toast.success("Contato excluído."); void load(); }
  };

  const getVisitForContact = (contactId: string) => visits.find(v => v.contact_id === contactId);
  const getProposalForContact = (contactId: string) => proposals.find(p => p.contact_id === contactId);

  const stats = useMemo(() => ({
    total: filteredContacts.length,
    novos: filteredContacts.filter(c => c.status === "new").length,
    contatados: filteredContacts.filter(c => c.status === "contacted").length,
    qualificados: filteredContacts.filter(c => c.status === "qualified").length,
    propostas: filteredContacts.filter(c => c.status === "proposal").length,
    convertidos: filteredContacts.filter(c => c.status === "converted").length,
    receita: proposals.filter(p => p.status === "accepted").reduce((s, p) => s + Number(p.amount || 0), 0),
  }), [filteredContacts, proposals]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">CRM</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Pipeline Comercial</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Gerencie todo o funil de vendas em um só lugar: contatos, visitas e propostas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowNewForm(v => !v)}>
            <Plus className="mr-2 h-4 w-4" />Novo Contato
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {pipelineStages.slice(0, 5).map(stage => {
          const count = stage.id === "new" ? stats.novos
            : stage.id === "contacted" ? stats.contatados
            : stage.id === "qualified" ? stats.qualificados
            : stage.id === "proposal" ? stats.propostas
            : stats.convertidos;
          return (
            <Card key={stage.id} className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{stage.label}</p>
                <p className="mt-1 text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Receita</p>
            <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
              {stats.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            className="pl-9 w-64"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">Todos os clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* New Contact Form */}
      {showNewForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Novo Contato</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitContact}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Contato</Label>
                  <Input required value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="site">Site</option><option value="instagram">Instagram</option>
                    <option value="linkedin">LinkedIn</option><option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option><option value="folder">Folder</option>
                    <option value="business_card">Cartão de visita</option><option value="other">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Cliente vinculado</Label>
                  <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Sem vínculo</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button disabled={saving}>
                  {saving ? "Salvando..." : "Registrar Contato"}
                </Button>
                <Button variant="ghost" onClick={() => setShowNewForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
        {pipelineStages.map(stage => {
          const stageContacts = filteredContacts.filter(c => c.status === stage.id);
          return (
            <div key={stage.id} className="min-w-[280px] w-[280px] shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  {stage.icon} {stage.label}
                </h3>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {stageContacts.length}
                </span>
              </div>
              <div className="space-y-3 min-h-[200px] bg-muted/20 rounded-xl border border-border/50 p-3">
                {stageContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum contato</p>
                ) : (
                  stageContacts.map(contact => {
                    const visit = getVisitForContact(contact.id);
                    const proposal = getProposalForContact(contact.id);
                    return (
                      <Card key={contact.id} className="border-border/60 hover:border-primary/40 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{contact.company_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{contact.contact_name}</p>
                            </div>
                            <button
                              onClick={() => deleteContact(contact.id)}
                              className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {contact.email && (
                            <p className="text-xs text-muted-foreground truncate mt-1">{contact.email}</p>
                          )}

                          {/* Stage selector */}
                          <select
                            value={contact.status}
                            onChange={e => updateContactStatus(contact.id, e.target.value)}
                            className="mt-2 w-full text-xs rounded-md border border-input bg-background px-2 py-1"
                          >
                            {pipelineStages.map(s => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>

                          {/* Visit info */}
                          {visit && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">
                                {visit.status === "completed" ? "Visita Realizada" : format(new Date(visit.scheduled_at), "dd/MM")}
                              </span>
                            </div>
                          )}

                          {/* Proposal info */}
                          {proposal && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
                              <FileSignature className="h-3 w-3" />
                              <span className="truncate">
                                {proposal.title} - {proposalStatusLabels[proposal.status] || proposal.status}
                              </span>
                            </div>
                          )}

                          {/* Quick actions for proposal stage */}
                          {contact.status === "proposal" && !proposal && (
                            <div className="mt-2">
                              <Button variant="outline" size="sm" className="w-full text-xs h-7" asChild>
                                <a href="/admin/proposal">
                                  <Plus className="h-3 w-3 mr-1" />Criar Proposta
                                </a>
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
