import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Cpu, Download, FileUp, Glasses, Loader2, Monitor, PackageCheck, Plus, Users, Archive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/authStore";
import { ClientAccessTab } from "@/components/team/ClientAccessTab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClientOption = { id: string; name: string; email?: string; status?: string };
type ProjectFile = {
  id: string;
  project_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  is_result: boolean;
  created_at: string;
};
type Project = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  animation_details: string | null;
  lighting_details: string | null;
  status: "analysis" | "processing" | "completed";
  estimated_delivery: string | null;
  technical_notes: string | null;
  created_at: string;
  updated_at: string;
  clients?: ClientOption | null;
  vx_project_files?: ProjectFile[];
};
type Software = {
  id: string;
  title: string;
  description: string | null;
  version: string | null;
  file_url: string;
  tutorial_url: string | null;
};

const PROJECTS_BUCKET = "vx-projects";
const statusLabels = { analysis: "Em analise", processing: "Em processamento", completed: "Finalizado" };

function Shell({ title, description, icon: Icon, children }: { title: string; description: string; icon: React.ElementType; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Pos-venda VX</p>
          <h1 className="mt-2 text-3xl font-bold">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-7 w-7" /></div>
      </header>
      {children}
    </div>
  );
}

function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-10 rounded-md border border-input bg-background px-3 text-sm ${className}`} />;
}

function Status({ status }: { status: Project["status"] }) {
  const theme = status === "completed" ? "bg-emerald-500/10 text-emerald-500" : status === "processing" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme}`}>{statusLabels[status]}</span>;
}

export function AdminClientAccessPage() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.from("clients").select("id, name, email, status").is("deleted_at", null).order("name");
      if (error) return toast.error("Erro ao carregar clientes.");
      const available = (data as ClientOption[] | null) || [];
      setClients(available);
      setSelectedId((current) => current || available[0]?.id || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selected = clients.find((client) => client.id === selectedId);
  return (
    <Shell title="Acesso do Cliente" description="Crie usuarios da area segura e defina permissoes sem armazenar senhas no cadastro comercial." icon={Monitor}>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div className="w-full max-w-md space-y-2">
              <Label>Cliente</Label>
              <Select className="w-full" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </Select>
            </div>
            {selected && <div className="text-sm text-muted-foreground">{selected.email || "Sem e-mail cadastrado"} - {selected.status || "ativo"}</div>}
          </div>
          {selectedId ? <ClientAccessTab clientId={selectedId} /> : <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Cadastre um cliente para liberar acessos.</p>}
        </CardContent>
      </Card>
    </Shell>
  );
}

function fileKind(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "step") return "step";
  if (extension === "png") return "png";
  if (extension === "jpeg" || extension === "jpg") return "jpeg";
  return "pdf";
}

async function downloadProjectFile(file: ProjectFile) {
  const { data, error } = await supabase.storage.from(PROJECTS_BUCKET).createSignedUrl(file.file_url, 60 * 60);
  if (error) return toast.error("Nao foi possivel liberar o download.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

async function downloadProjectZip(project: Project, onReload?: () => void) {
  const files = (project.vx_project_files || []).filter((file) => !file.is_result);
  if (!files.length) return toast.error("Nenhum arquivo para baixar.");

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) return toast.error("Sessao expirada. Faca login novamente.");

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/zip-files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      bucket: PROJECTS_BUCKET,
      files: files.map((f) => ({ name: f.file_name, path: f.file_url })),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    return toast.error(err?.error || "Erro ao gerar zip.");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const zipName = project.title
    ? `${project.title.replace(/[^a-zA-Z0-9]/g, "_")}_files.zip`
    : `vx_files_${Date.now()}.zip`;
  link.download = zipName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  if (project.status === "analysis") {
    const { error } = await supabase.from("vx_projects").update({ status: "processing" }).eq("id", project.id);
    if (!error) {
      toast.success("Projeto avancado para processamento.");
      onReload?.();
    }
  }
}

export function AdminProjectOperationsPage({ view }: { view: "uploads" | "processing" | "library" }) {
  const profile = useAuthStore((s) => s.profile);
  const vxRole = profile?.vx_role ?? null;
  const isVxAdmin = vxRole === 'admin' || vxRole === null;
  const isVxProgramador = vxRole === 'programador';
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", animation_details: "", lighting_details: "" });
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vx_projects")
      .select("*, clients ( id, name ), vx_project_files ( * )")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar projetos VX.");
    else {
      const loaded = (data as Project[] | null) || [];
      setProjects(loaded);
      setSelectedId((current) => current || loaded[0]?.id || "");
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const selected = projects.find((project) => project.id === selectedId);
  const title = view === "uploads" ? "Uploads Recebidos" : view === "processing" ? "Processamento de Dados" : "Biblioteca de Entregas";
  const description = view === "uploads"
    ? "Valide briefings e arquivos recebidos dos clientes."
    : view === "processing"
      ? "Defina prazos, registre notas tecnicas e avance o status do projeto."
      : "Publique o arquivo final e disponibilize o download seguro ao cliente.";
  const Icon = view === "uploads" ? FileUp : view === "processing" ? Cpu : PackageCheck;

  const updateProject = async (changes: Partial<Project>) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("vx_projects").update(changes).eq("id", selected.id);
    setSaving(false);
    if (error) toast.error("Erro ao atualizar projeto.");
    else {
      toast.success("Projeto atualizado.");
      void load();
    }
  };

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`Excluir o projeto "${project.title}"? Esta acao nao pode ser desfeita.`)) return;
    setSaving(true);
    const files = project.vx_project_files || [];
    for (const file of files) {
      await supabase.storage.from(PROJECTS_BUCKET).remove([file.file_url]);
    }
    await supabase.from("vx_project_files").delete().eq("project_id", project.id);
    const { error } = await supabase.from("vx_projects").delete().eq("id", project.id);
    setSaving(false);
    if (error) return toast.error("Erro ao excluir projeto.");
    toast.success("Projeto excluido.");
    void load();
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    setEditForm({
      title: project.title,
      description: project.description || "",
      animation_details: project.animation_details || "",
      lighting_details: project.lighting_details || "",
    });
  };

  const saveEdit = async () => {
    if (!editingProject) return;
    setSaving(true);
    const { error } = await supabase.from("vx_projects").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      animation_details: editForm.animation_details.trim() || null,
      lighting_details: editForm.lighting_details.trim() || null,
    }).eq("id", editingProject.id);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar edicao.");
    toast.success("Projeto atualizado.");
    setEditingProject(null);
    void load();
  };

  const publishResult = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !resultFile) return;
    const extension = resultFile.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = isVxProgramador ? ["apk"] : ["step", "pdf", "jpg", "jpeg", "png"];
    const allowedMessage = isVxProgramador ? "Use arquivos APK para a entrega." : "Use arquivos STEP, PDF, JPEG ou PNG para a entrega.";
    if (!allowedExtensions.includes(extension)) {
      return toast.error(allowedMessage);
    }
    setSaving(true);
    const path = `${selected.client_id}/${selected.id}/result-${crypto.randomUUID()}.${extension}`;

    const { data: uploadUrl, error: signedError } = await supabase.storage
      .from(PROJECTS_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (signedError || !uploadUrl?.signedUrl) {
      setSaving(false);
      return toast.error(`Erro ao iniciar upload: ${signedError?.message || "URL nao gerada"}`);
    }

    // Upload directly via PUT to the signed URL (bypasses Supabase SDK FormData)
    const uploadRes = await fetch(uploadUrl.signedUrl, {
      method: "PUT",
      body: resultFile.stream(),
      duplex: "half",
      headers: {
        "Content-Type": resultFile.type || "application/octet-stream",
        "x-upsert": "true",
      },
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      setSaving(false);
      return toast.error(`Erro ao enviar entrega (HTTP ${uploadRes.status}): ${errText || uploadRes.statusText}`);
    }
    const result = await supabase.from("vx_project_files").insert({
      project_id: selected.id,
      file_url: path,
      file_name: resultFile.name,
      file_type: fileKind(resultFile.name),
      file_size: resultFile.size,
      is_result: true,
    });
    if (!result.error) await supabase.from("vx_projects").update({ status: "completed" }).eq("id", selected.id);
    setSaving(false);
    if (result.error) return toast.error("Erro ao publicar entrega.");
    toast.success("Entrega publicada na biblioteca do cliente.");
    setResultFile(null);
    void load();
  };

  return (
    <Shell title={title} description={description} icon={Icon}>
      {loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : projects.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Ainda nao existem projetos enviados por clientes.</CardContent></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[310px_1fr]">
          <Card><CardHeader><CardTitle className="text-base">Projetos</CardTitle></CardHeader><CardContent className="space-y-2">
            {projects.map((project) => (
              <button key={project.id} type="button" onClick={() => setSelectedId(project.id)} className={`w-full rounded-xl border p-3 text-left transition ${project.id === selectedId ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="truncate font-semibold">{project.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{project.clients?.name || "Cliente"}</p>
                <div className="mt-2"><Status status={project.status} /></div>
              </button>
            ))}
          </CardContent></Card>
          {selected && (
            <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selected.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{selected.clients?.name}</p></div><div className="flex items-center gap-2"><Status status={selected.status} />{isVxAdmin && <><Button variant="ghost" size="sm" onClick={() => startEdit(selected)} disabled={saving}>Editar</Button><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void deleteProject(selected)} disabled={saving}>Excluir</Button></>}</div></div></CardHeader><CardContent className="space-y-6">
              {view === "uploads" && (
                <div className="space-y-5">
                  {editingProject?.id === selected.id ? (
                    <div className="space-y-4">
                      <div className="space-y-2"><Label>Titulo</Label><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Descricao</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Animacoes e interacoes</Label><Textarea value={editForm.animation_details} onChange={(e) => setEditForm({ ...editForm, animation_details: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Cores e luzes</Label><Textarea value={editForm.lighting_details} onChange={(e) => setEditForm({ ...editForm, lighting_details: e.target.value })} /></div>
                      <div className="flex gap-2">
                        <Button onClick={() => void saveEdit()} disabled={saving || !editForm.title.trim()}>{saving ? "Salvando..." : "Salvar"}</Button>
                        <Button variant="outline" onClick={() => setEditingProject(null)} disabled={saving}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Info title="Descricao" value={selected.description} />
                      <Info title="Animacoes e interacoes" value={selected.animation_details} />
                      <Info title="Cores e luzes" value={selected.lighting_details} />
                      <Info title="Criado em" value={new Date(selected.created_at).toLocaleString("pt-BR")} />
                    </div>
                  )}
                  <Files files={(selected.vx_project_files || []).filter((file) => !file.is_result)} allowDownload />
                  <div className="flex gap-2">
                    {(selected.vx_project_files || []).filter((file) => !file.is_result).length > 0 && (
                      <Button variant="outline" onClick={() => void downloadProjectZip(selected, load)} disabled={saving}>
                        <Archive className="mr-2 h-4 w-4" />Baixar tudo (.zip)
                      </Button>
                    )}
                    {isVxAdmin && <Button onClick={() => void updateProject({ status: "processing" })} disabled={selected.status !== "analysis" || saving}>Enviar para processamento</Button>}
                  </div>
                </div>
              )}
              {view === "processing" && (
                isVxAdmin
                  ? <ProcessingEditor key={`${selected.id}-${selected.updated_at || selected.status}`} selected={selected} saving={saving} onSave={updateProject} />
                  : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Apenas administradores podem alterar o processamento.</p>
              )}
              {view === "library" && (
                <div className="space-y-6">
                  <Files files={(selected.vx_project_files || []).filter((file) => file.is_result)} allowDownload />
                  <form className="space-y-4 rounded-xl border border-border bg-muted/20 p-5" onSubmit={publishResult}>
                    <h3 className="font-semibold">Publicar nova entrega</h3>
                    <p className="text-sm text-muted-foreground">Ao publicar, o projeto passa para finalizado e o cliente recebe acesso ao arquivo na propria biblioteca.</p>
                    <Input type="file" accept={isVxProgramador ? ".apk" : ".step,.pdf,.jpg,.jpeg,.png,.apk"} onChange={(event) => setResultFile(event.target.files?.[0] || null)} required />
                    <Button disabled={saving || !resultFile}><Plus className="mr-2 h-4 w-4" />{saving ? "Publicando..." : "Publicar entrega final"}</Button>
                  </form>
                </div>
              )}
            </CardContent></Card>
          )}
        </div>
      )}
    </Shell>
  );
}

function Info({ title, value }: { title: string; value: string | null }) {
  return <div className="rounded-xl bg-muted/40 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-2 text-sm">{value || "Nao informado"}</p></div>;
}

function Files({ files, allowDownload = false }: { files: ProjectFile[]; allowDownload?: boolean }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Arquivos {allowDownload ? "entregues" : "recebidos"}</h3>
      {files.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhum arquivo nesta etapa.</p> : files.map((file) => (
        <div key={file.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
          <span className="truncate">{file.file_name}</span>
          {allowDownload && <Button variant="ghost" size="sm" onClick={() => void downloadProjectFile(file)}><Download className="mr-2 h-4 w-4" />Baixar</Button>}
        </div>
      ))}
    </div>
  );
}

function ProcessingEditor({ selected, saving, onSave }: { selected: Project; saving: boolean; onSave: (changes: Partial<Project>) => Promise<void> }) {
  const [status, setStatus] = useState<Project["status"]>(selected.status);
  const [delivery, setDelivery] = useState(selected.estimated_delivery || "");
  const [notes, setNotes] = useState(selected.technical_notes || "");
  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void onSave({ status, estimated_delivery: delivery || null, technical_notes: notes || null }); }}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Status</Label><Select className="w-full" value={status} onChange={(event) => setStatus(event.target.value as Project["status"])}><option value="analysis">Em analise</option><option value="processing">Em processamento</option><option value="completed">Finalizado</option></Select></div>
        <div className="space-y-2"><Label>Previsao de entrega</Label><Input type="date" value={delivery} onChange={(event) => setDelivery(event.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>Atualizacao tecnica para o cliente</Label><Textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informe andamento, ajustes solicitados ou alteracao de prazo." /></div>
      <Button disabled={saving}>{saving ? "Salvando..." : "Salvar acompanhamento"}</Button>
      <Link to="/admin/library" className="ml-3 inline-flex text-sm text-primary hover:underline">Publicar entrega quando finalizado</Link>
    </form>
  );
}

export function AdminUploadsPage() {
  return <AdminProjectOperationsPage view="uploads" />;
}
export function AdminProcessingPage() {
  return <AdminProjectOperationsPage view="processing" />;
}
export function AdminLibraryPage() {
  return <AdminProjectOperationsPage view="library" />;
}

export function AdminInstallationPage() {
  const [items, setItems] = useState<Software[]>([]);
  const [form, setForm] = useState({ title: "", description: "", version: "", file_url: "", tutorial_url: "" });
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("vx_software_downloads").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar instaladores.");
    else setItems((data as Software[] | null) || []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("vx_software_downloads").insert({
      ...form,
      description: form.description || null,
      version: form.version || null,
      tutorial_url: form.tutorial_url || null,
    });
    if (error) return toast.error("Erro ao disponibilizar software.");
    toast.success("Software disponibilizado para os clientes.");
    setForm({ title: "", description: "", version: "", file_url: "", tutorial_url: "" });
    void load();
  };
  return (
    <Shell title="Instalacao no Oculos" description="Disponibilize software e tutoriais utilizados na etapa final da experiencia VX." icon={Glasses}>
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <Card><CardHeader><CardTitle className="text-lg">Novo software</CardTitle></CardHeader><CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2"><Label>Nome</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Versao</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
            <div className="space-y-2"><Label>Link do instalador</Label><Input type="url" required value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} /></div>
            <div className="space-y-2"><Label>Link do tutorial</Label><Input type="url" value={form.tutorial_url} onChange={(e) => setForm({ ...form, tutorial_url: e.target.value })} /></div>
            <div className="space-y-2"><Label>Orientacoes</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Button className="w-full">Disponibilizar</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Materiais publicados</CardTitle></CardHeader><CardContent className="space-y-3">
          {items.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum instalador publicado.</p> : items.map((software) => (
            <article key={software.id} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{software.title}</p><p className="text-sm text-muted-foreground">{software.version || "Versao atual"}</p></div><Users className="h-5 w-5 text-primary" /></div>
              <p className="my-3 text-sm">{software.description}</p>
              <div className="flex gap-4 text-sm"><a href={software.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Instalador</a>{software.tutorial_url && <a href={software.tutorial_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Tutorial</a>}</div>
            </article>
          ))}
        </CardContent></Card>
      </div>
    </Shell>
  );
}
