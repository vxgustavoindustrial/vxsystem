import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  FileSignature,
  MapPin,
  Phone,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClientOption = { id: string; name: string };
type Contact = {
  id: string;
  client_id: string | null;
  company_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
  created_at: string;
};
type Visit = {
  id: string;
  contact_id: string | null;
  client_id: string | null;
  scheduled_at: string;
  location: string | null;
  status: string;
  objective: string | null;
  outcome: string | null;
};
type Proposal = {
  id: string;
  client_id: string | null;
  contact_id: string | null;
  title: string;
  amount: number | null;
  status: string;
  valid_until: string | null;
  description: string | null;
  document_url: string | null;
};
type Contract = {
  id: string;
  client_id: string;
  contract_type: ContractType;
  title: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  document_url: string | null;
  clients?: ClientOption | null;
};
type Subscription = {
  id: string;
  client_id: string;
  plan_name: string;
  status: string;
  monthly_amount: number;
  support_level: string;
  platform_seats: number;
  starts_on: string;
  renews_on_day: number | null;
  clients?: ClientOption | null;
};
export type ContractType = "service" | "nda" | "platform";

const contactStatuses = ["new", "contacted", "qualified", "proposal", "converted", "lost"];
const contactStatusLabels: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  proposal: "Proposta",
  converted: "Convertido",
  lost: "Perdido",
};
const contractStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  signed: "Assinado",
  active: "Ativo",
  expired: "Expirado",
  terminated: "Encerrado",
};
const proposalStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
};

function useClients() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.from("clients").select("id, name").is("deleted_at", null).order("name");
      setClients((data as ClientOption[] | null) || []);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return clients;
}

function PageShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Operacao VX</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-7 w-7" />
        </div>
      </header>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${props.className || ""}`}
    />
  );
}

function StatusPill({ value, labels }: { value: string; labels: Record<string, string> }) {
  const positive = ["active", "signed", "accepted", "converted", "completed"].includes(value);
  const caution = ["sent", "proposal", "qualified", "scheduled", "past_due"].includes(value);
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        positive
          ? "bg-emerald-500/10 text-emerald-500"
          : caution
            ? "bg-amber-500/10 text-amber-500"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {labels[value] || value}
    </span>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{message}</div>;
}

export function AdminContactPage() {
  const clients = useClients();
  const { user } = useAuthStore();
  const [items, setItems] = useState<Contact[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    source: "site",
    notes: "",
    client_id: "",
  });

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("sales_contacts").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Nao foi possivel carregar os contatos.");
    else setItems((data as Contact[] | null) || []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("sales_contacts").insert({
      ...form,
      client_id: form.client_id || null,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
      created_by: user?.id || null,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao registrar contato.");
    toast.success("Contato registrado.");
    setForm({ company_name: "", contact_name: "", email: "", phone: "", source: "site", notes: "", client_id: "" });
    void load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("sales_contacts").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao atualizar etapa.");
    else void load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este contato comercial?")) return;
    const { error } = await supabase.from("sales_contacts").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir contato.");
    else void load();
  };

  return (
    <PageShell title="Contatos Comerciais" description="Cadastre leads recebidos e conduza cada oportunidade ate a proposta." icon={Phone}>
      <div className="grid gap-6 xl:grid-cols-[370px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-lg">Novo contato</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <Field label="Empresa"><Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
              <Field label="Contato responsavel"><Input required value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              </div>
              <Field label="Origem">
                <NativeSelect value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  <option value="site">Site</option><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option>
                  <option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="folder">Folder</option>
                  <option value="business_card">Cartao de visita</option><option value="other">Outro</option>
                </NativeSelect>
              </Field>
              <Field label="Cliente vinculado (opcional)">
                <NativeSelect value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Sem vinculo ainda</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Observacoes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <Button className="w-full" disabled={saving}><Plus className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Registrar contato"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Pipeline de contatos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? <Empty message="Nenhum contato registrado." /> : items.map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.company_name}</p>
                  <p className="text-sm text-muted-foreground">{item.contact_name} {item.email ? `- ${item.email}` : ""}</p>
                </div>
                <NativeSelect className="lg:w-40" value={item.status} onChange={(e) => void updateStatus(item.id, e.target.value)}>
                  {contactStatuses.map((status) => <option key={status} value={status}>{contactStatusLabels[status]}</option>)}
                </NativeSelect>
                <StatusPill value={item.status} labels={contactStatusLabels} />
                <Button variant="ghost" size="icon" onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

export function AdminVisitPage() {
  const clients = useClients();
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [items, setItems] = useState<Visit[]>([]);
  const [form, setForm] = useState({ contact_id: "", client_id: "", scheduled_at: "", location: "", objective: "" });

  const load = useCallback(async () => {
    const [visitResult, contactsResult] = await Promise.all([
      supabase.from("sales_visits").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("sales_contacts").select("*").order("company_name"),
    ]);
    if (visitResult.error) toast.error("Nao foi possivel carregar visitas.");
    setItems((visitResult.data as Visit[] | null) || []);
    setContacts((contactsResult.data as Contact[] | null) || []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("sales_visits").insert({
      ...form,
      contact_id: form.contact_id || null,
      client_id: form.client_id || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      created_by: user?.id || null,
    });
    if (error) return toast.error("Erro ao agendar visita.");
    toast.success("Visita agendada.");
    setForm({ contact_id: "", client_id: "", scheduled_at: "", location: "", objective: "" });
    void load();
  };

  const updateStatus = async (item: Visit, status: string) => {
    const outcome = status === "completed" && !item.outcome ? window.prompt("Resultado da visita (opcional):") : item.outcome;
    const { error } = await supabase.from("sales_visits").update({ status, outcome }).eq("id", item.id);
    if (error) toast.error("Erro ao atualizar visita.");
    else void load();
  };

  return (
    <PageShell title="Visitas" description="Agende reunioes e registre o resultado comercial de cada visita." icon={MapPin}>
      <div className="grid gap-6 xl:grid-cols-[370px_1fr]">
        <Card><CardHeader><CardTitle className="text-lg">Agendar visita</CardTitle></CardHeader><CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Contato"><NativeSelect value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}><option value="">Selecionar</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.company_name} - {c.contact_name}</option>)}</NativeSelect></Field>
            <Field label="Cliente (se ja cadastrado)"><NativeSelect value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">Sem vinculo</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
            <Field label="Data e horario"><Input required type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></Field>
            <Field label="Local ou link"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Objetivo"><Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></Field>
            <Button className="w-full"><CalendarClock className="mr-2 h-4 w-4" />Agendar</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Agenda comercial</CardTitle></CardHeader><CardContent className="space-y-3">
          {items.length === 0 ? <Empty message="Nenhuma visita agendada." /> : items.map((item) => (
            <article key={item.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <p className="font-semibold">{new Date(item.scheduled_at).toLocaleString("pt-BR")}</p>
                  <p className="text-sm text-muted-foreground">{item.location || "Local nao informado"}</p>
                </div>
                <NativeSelect className="md:w-44" value={item.status} onChange={(e) => void updateStatus(item, e.target.value)}>
                  <option value="scheduled">Agendada</option><option value="completed">Realizada</option><option value="rescheduled">Reagendada</option><option value="cancelled">Cancelada</option>
                </NativeSelect>
              </div>
              {item.objective && <p className="mt-3 text-sm">{item.objective}</p>}
              {item.outcome && <p className="mt-2 rounded-lg bg-muted p-3 text-sm">Resultado: {item.outcome}</p>}
            </article>
          ))}
        </CardContent></Card>
      </div>
    </PageShell>
  );
}

export function AdminProposalPage() {
  const clients = useClients();
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [items, setItems] = useState<Proposal[]>([]);
  const [form, setForm] = useState({ title: "", client_id: "", contact_id: "", amount: "", valid_until: "", description: "", document_url: "" });
  const load = useCallback(async () => {
    const [proposals, contactResult] = await Promise.all([
      supabase.from("sales_proposals").select("*").order("created_at", { ascending: false }),
      supabase.from("sales_contacts").select("*").order("company_name"),
    ]);
    setItems((proposals.data as Proposal[] | null) || []);
    setContacts((contactResult.data as Contact[] | null) || []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("sales_proposals").insert({
      title: form.title,
      client_id: form.client_id || null,
      contact_id: form.contact_id || null,
      amount: form.amount ? Number(form.amount) : null,
      valid_until: form.valid_until || null,
      description: form.description || null,
      document_url: form.document_url || null,
      created_by: user?.id || null,
    });
    if (error) return toast.error("Erro ao criar proposta.");
    toast.success("Proposta criada.");
    setForm({ title: "", client_id: "", contact_id: "", amount: "", valid_until: "", description: "", document_url: "" });
    void load();
  };
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("sales_proposals").update({ status, accepted_at: status === "accepted" ? new Date().toISOString() : null }).eq("id", id);
    if (error) toast.error("Erro ao atualizar proposta.");
    else void load();
  };
  return (
    <PageShell title="Propostas" description="Prepare propostas, envie ao cliente e registre a decisao comercial." icon={FileSignature}>
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <Card><CardHeader><CardTitle className="text-lg">Nova proposta</CardTitle></CardHeader><CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Field label="Titulo"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Contato"><NativeSelect value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}><option value="">Sem contato</option>{contacts.map((c) => <option value={c.id} key={c.id}>{c.company_name}</option>)}</NativeSelect></Field>
            <Field label="Cliente"><NativeSelect value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">Ainda nao convertido</option>{clients.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</NativeSelect></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (R$)"><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Valida ate"><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></Field>
            </div>
            <Field label="Link do documento"><Input type="url" value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} /></Field>
            <Field label="Escopo"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Button className="w-full"><Plus className="mr-2 h-4 w-4" />Criar proposta</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Propostas registradas</CardTitle></CardHeader><CardContent className="space-y-3">
          {items.length === 0 ? <Empty message="Nenhuma proposta registrada." /> : items.map((proposal) => (
            <article key={proposal.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div><p className="font-semibold">{proposal.title}</p><p className="text-sm text-muted-foreground">{proposal.amount == null ? "Valor a definir" : proposal.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
                <div className="flex items-center gap-2">
                  <StatusPill value={proposal.status} labels={proposalStatusLabels} />
                  <NativeSelect className="w-36" value={proposal.status} onChange={(e) => void setStatus(proposal.id, e.target.value)}>
                    {Object.entries(proposalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </NativeSelect>
                </div>
              </div>
              {proposal.document_url && <a className="mt-3 inline-flex text-sm text-primary hover:underline" href={proposal.document_url} rel="noreferrer" target="_blank">Abrir documento</a>}
            </article>
          ))}
        </CardContent></Card>
      </div>
    </PageShell>
  );
}

const contractCopy: Record<ContractType, { title: string; description: string }> = {
  service: { title: "Contratos de Servico", description: "Formalize escopo, vigencia e liberacao operacional dos projetos VX." },
  nda: { title: "Confidencialidade", description: "Controle assinaturas do NDA antes de receber arquivos industriais." },
  platform: { title: "Aquisicao da Plataforma", description: "Gerencie contratos de licenca e liberacao do ambiente VX." },
};

export function ContractManagementPage({ type }: { type: ContractType }) {
  const clients = useClients();
  const { user } = useAuthStore();
  const profile = useAuthStore((s) => s.profile);
  const vxRole = profile?.vx_role ?? null;
  const isVxAdmin = vxRole === 'admin' || vxRole === null;
  const isVxFinanceiro = vxRole === 'financeiro';
  const [items, setItems] = useState<Contract[]>([]);
  const [form, setForm] = useState({ client_id: "", title: "", status: "draft", starts_on: "", ends_on: "", document_url: "" });
  const copy = contractCopy[type];
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("service_contracts").select("*, clients ( id, name )").eq("contract_type", type).order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar contratos.");
    else setItems((data as Contract[] | null) || []);
  }, [type]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("service_contracts").insert({
      ...form,
      contract_type: type,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      document_url: form.document_url || null,
      signed_at: form.status === "signed" || form.status === "active" ? new Date().toISOString() : null,
      created_by: user?.id || null,
    });
    if (error) return toast.error("Erro ao salvar contrato.");
    toast.success("Contrato salvo.");
    setForm({ client_id: "", title: "", status: "draft", starts_on: "", ends_on: "", document_url: "" });
    void load();
  };
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("service_contracts").update({
      status,
      signed_at: status === "signed" || status === "active" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) toast.error("Erro ao atualizar contrato.");
    else void load();
  };
  return (
    <PageShell title={copy.title} description={copy.description} icon={BriefcaseBusiness}>
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <Card><CardHeader><CardTitle className="text-lg">Novo registro</CardTitle></CardHeader><CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Field label="Cliente"><NativeSelect required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">Selecionar cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
            <Field label="Titulo"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Status"><NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(contractStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Inicio"><Input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></Field><Field label="Termino"><Input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></Field></div>
            <Field label="Documento assinado / link"><Input type="url" value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} /></Field>
            <Button className="w-full"><Plus className="mr-2 h-4 w-4" />Salvar registro</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Historico</CardTitle></CardHeader><CardContent className="space-y-3">
          {items.length === 0 ? <Empty message="Nenhum registro nesta categoria." /> : items.map((contract) => (
            <article key={contract.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center">
              <div className="flex-1"><p className="font-semibold">{contract.title}</p><p className="text-sm text-muted-foreground">{contract.clients?.name || "Cliente"} {contract.starts_on ? `- Inicio ${new Date(contract.starts_on).toLocaleDateString("pt-BR")}` : ""}</p></div>
              {contract.document_url && !isVxFinanceiro && <a className="text-sm text-primary hover:underline" href={contract.document_url} target="_blank" rel="noreferrer">Documento</a>}
              {isVxFinanceiro && contract.document_url && <span className="text-xs text-muted-foreground">Anexado</span>}
              {isVxAdmin && (
                <NativeSelect className="md:w-36" value={contract.status} onChange={(e) => void updateStatus(contract.id, e.target.value)}>{Object.entries(contractStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
              )}
              <StatusPill value={contract.status} labels={contractStatusLabels} />
            </article>
          ))}
        </CardContent></Card>
      </div>
    </PageShell>
  );
}

export function AdminContractsPage() {
  return <ContractPortfolioPage />;
}
export function AdminServicesPage() {
  return <ContractManagementPage type="service" />;
}
export function AdminNdaPage() {
  return <ContractManagementPage type="nda" />;
}
export function AdminPlatformPage() {
  return <ContractManagementPage type="platform" />;
}

function ContractPortfolioPage() {
  const [items, setItems] = useState<Contract[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.from("service_contracts").select("*, clients ( id, name )").order("created_at", { ascending: false });
      if (error) toast.error("Erro ao carregar central de contratos.");
      else setItems((data as Contract[] | null) || []);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const cards: Array<{ type: ContractType; title: string; href: string }> = [
    { type: "service", title: "Prestacao de Servico", href: "/admin/services" },
    { type: "nda", title: "Confidencialidade", href: "/admin/nda" },
    { type: "platform", title: "Licenca da Plataforma", href: "/admin/platform" },
  ];
  return (
    <PageShell title="Central de Contratos" description="Acompanhe todos os documentos comerciais e abra o editor especifico de cada categoria." icon={FileSignature}>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const contracts = items.filter((item) => item.contract_type === card.type);
          return (
            <Link key={card.type} to={card.href} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40">
              <p className="font-semibold">{card.title}</p>
              <p className="mt-3 text-3xl font-bold">{contracts.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">{contracts.filter((item) => ["signed", "active"].includes(item.status)).length} vigente(s)</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm text-primary">Gerenciar <ArrowRight className="h-4 w-4" /></span>
            </Link>
          );
        })}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Documentos recentes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? <Empty message="Nenhum contrato cadastrado." /> : items.slice(0, 10).map((item) => (
            <div key={item.id} className="flex flex-col justify-between gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
              <div><p className="font-semibold">{item.title}</p><p className="text-sm text-muted-foreground">{item.clients?.name || "Cliente"} - {contractCopy[item.contract_type].title}</p></div>
              <StatusPill value={item.status} labels={contractStatusLabels} />
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}

export function AdminMonthlyPage() {
  const clients = useClients();
  const { user } = useAuthStore();
  const [items, setItems] = useState<Subscription[]>([]);
  const [form, setForm] = useState({ client_id: "", plan_name: "", monthly_amount: "", support_level: "standard", platform_seats: "1", starts_on: "", renews_on_day: "5" });
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("client_subscriptions").select("*, clients ( id, name )").order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar assinaturas.");
    else setItems((data as Subscription[] | null) || []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("client_subscriptions").insert({
      client_id: form.client_id,
      plan_name: form.plan_name,
      monthly_amount: Number(form.monthly_amount),
      support_level: form.support_level,
      platform_seats: Number(form.platform_seats),
      starts_on: form.starts_on || new Date().toISOString().slice(0, 10),
      renews_on_day: Number(form.renews_on_day),
      created_by: user?.id || null,
    });
    if (error) return toast.error("Cliente ja possui assinatura vigente ou houve erro ao salvar.");
    toast.success("Assinatura ativada.");
    setForm({ client_id: "", plan_name: "", monthly_amount: "", support_level: "standard", platform_seats: "1", starts_on: "", renews_on_day: "5" });
    void load();
  };
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("client_subscriptions").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao atualizar assinatura.");
    else void load();
  };
  return (
    <PageShell title="Mensalidades e Planos" description="Ative planos recorrentes, cobertura de suporte e licencas por cliente." icon={ReceiptText}>
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <Card><CardHeader><CardTitle className="text-lg">Nova assinatura</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}>
          <Field label="Cliente"><NativeSelect required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}><option value="">Selecionar</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
          <Field label="Plano"><Input required value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} placeholder="Industrial Pro" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Mensalidade"><Input required type="number" min="0" step="0.01" value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })} /></Field><Field label="Licencas"><Input required type="number" min="1" value={form.platform_seats} onChange={(e) => setForm({ ...form, platform_seats: e.target.value })} /></Field></div>
          <Field label="Nivel de SAC"><NativeSelect value={form.support_level} onChange={(e) => setForm({ ...form, support_level: e.target.value })}><option value="standard">Padrao</option><option value="priority">Prioritario</option><option value="dedicated">Dedicado</option></NativeSelect></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Inicio"><Input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></Field><Field label="Dia vencimento"><Input type="number" min="1" max="28" value={form.renews_on_day} onChange={(e) => setForm({ ...form, renews_on_day: e.target.value })} /></Field></div>
          <Button className="w-full">Ativar assinatura</Button>
        </form></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Planos contratados</CardTitle></CardHeader><CardContent className="space-y-3">
          {items.length === 0 ? <Empty message="Nenhum plano cadastrado." /> : items.map((item) => (
            <article key={item.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center">
              <div className="flex-1"><p className="font-semibold">{item.clients?.name || "Cliente"} - {item.plan_name}</p><p className="text-sm text-muted-foreground">{Number(item.monthly_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mes - SAC {item.support_level} - {item.platform_seats} licenca(s)</p></div>
              <NativeSelect className="md:w-40" value={item.status} onChange={(e) => void updateStatus(item.id, e.target.value)}><option value="active">Ativa</option><option value="past_due">Em atraso</option><option value="suspended">Suspensa</option><option value="cancelled">Cancelada</option></NativeSelect>
            </article>
          ))}
        </CardContent></Card>
      </div>
    </PageShell>
  );
}

export function AdminCommercialPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const [contactResult, visitResult, proposalResult] = await Promise.all([
        supabase.from("sales_contacts").select("*"),
        supabase.from("sales_visits").select("*"),
        supabase.from("sales_proposals").select("*"),
      ]);
      setContacts((contactResult.data as Contact[] | null) || []);
      setVisits((visitResult.data as Visit[] | null) || []);
      setProposals((proposalResult.data as Proposal[] | null) || []);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const value = useMemo(() => proposals.filter((p) => p.status === "accepted").reduce((sum, p) => sum + Number(p.amount || 0), 0), [proposals]);
  const cards = [
    { title: "Novos contatos", number: contacts.filter((c) => c.status === "new").length, href: "/admin/contact" },
    { title: "Visitas agendadas", number: visits.filter((v) => v.status === "scheduled").length, href: "/admin/visit" },
    { title: "Propostas abertas", number: proposals.filter((p) => ["draft", "sent"].includes(p.status)).length, href: "/admin/proposal" },
    { title: "Receita aceita", number: value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), href: "/admin/proposal" },
  ];
  return (
    <PageShell title="ADM Comercial" description="Visao unica do funil Contato, Visita, Proposta e fechamento." icon={BriefcaseBusiness}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <Link key={card.title} to={card.href} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"><p className="text-sm text-muted-foreground">{card.title}</p><p className="mt-3 text-3xl font-bold">{card.number}</p><span className="mt-4 inline-flex items-center gap-2 text-sm text-primary">Abrir modulo <ArrowRight className="h-4 w-4" /></span></Link>)}
      </div>
      <Card><CardHeader><CardTitle className="text-lg">Funil atualizado</CardTitle></CardHeader><CardContent>
        <div className="grid gap-3 md:grid-cols-5">
          {contactStatuses.slice(0, 5).map((status) => <div key={status} className="rounded-xl bg-muted/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{contactStatusLabels[status]}</p><p className="mt-2 text-3xl font-bold">{contacts.filter((contact) => contact.status === status).length}</p></div>)}
        </div>
      </CardContent></Card>
    </PageShell>
  );
}
