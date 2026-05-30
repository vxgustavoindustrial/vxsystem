import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Loader2, MessageSquare, Rocket, UserCog, Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientEditModal } from "@/components/modals/ClientEditModal";
import { ClientAccessTab } from "@/components/team/ClientAccessTab";
import { DocumentLibrary } from "@/components/documents/DocumentLibrary";
import { OnboardingRoadmap } from "@/modules/onboarding/components/OnboardingRoadmap";
import { AutomationService } from "@/services/automation.service";
import type { ClientWithProfile } from "@/types/client.types";
import type { Task } from "@/types/general.types";

type AssignedProfile = {
  id: string;
  full_name: string;
  email?: string | null;
};

export function AdminClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [client, setClient] = useState<ClientWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);
  const [onboardingTasks, setOnboardingTasks] = useState<Task[]>([]);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [syncingFlow, setSyncingFlow] = useState(false);

  const fetchClient = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        throw error;
      }

      const clientRow = data as ClientWithProfile;
      let profile: AssignedProfile | undefined;

      if (clientRow.assigned_to) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", clientRow.assigned_to)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        profile = profileData as AssignedProfile | undefined;
      }

      setClient({
        ...clientRow,
        profiles: profile,
      });
    } catch (error) {
      console.error("Erro ao encontrar cliente:", error);
      toast.error("Nao foi possivel carregar o cliente.");
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchOnboardingTasks = useCallback(async () => {
    if (!id) return;

    setLoadingOnboarding(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("client_id", id)
        .ilike("stage", "onboarding_%")
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      setOnboardingTasks((data as Task[]) || []);
    } catch (error) {
      console.error("Erro ao carregar onboarding:", error);
      toast.error("Nao foi possivel carregar o onboarding.");
    } finally {
      setLoadingOnboarding(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchClient();
    void fetchOnboardingTasks();
  }, [fetchClient, fetchOnboardingTasks]);

  const handleSyncFlow = async () => {
    if (!id || !user?.id) return;

    setSyncingFlow(true);
    try {
      const { data: flows, error } = await supabase
        .from("flows")
        .select("id")
        .ilike("name", "%Onboarding%")
        .eq("is_active", true)
        .limit(1);

      if (error) {
        throw error;
      }

      if (flows && flows.length > 0) {
        await AutomationService.executeFlow(flows[0].id, id, user.id);
      } else {
        await AutomationService.initializeOnboarding(id, user.id);
      }

      await fetchOnboardingTasks();
      toast.success("Fluxo de onboarding sincronizado.");
    } catch (error) {
      console.error("Erro ao sincronizar fluxo:", error);
      toast.error("Nao foi possivel sincronizar o fluxo.");
    } finally {
      setSyncingFlow(false);
    }
  };

  const handleImpersonate = () => {
    if (!id) return;

    useAuthStore.getState().setImpersonatedClientId(id);
    navigate("/client");
    toast.success(`Visualizando portal de ${client?.name}`);
  };

  if (loading) {
    return <LoadingSkeleton className="h-[500px] w-full" />;
  }

  if (!client) {
    return <div>Cliente nao encontrado</div>;
  }

  const activeModules = Object.entries(client.modules_enabled || {}).filter(([, enabled]) => enabled);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <PageHeader title={client.name} description={client.email} />
          <StatusBadge status={client.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleImpersonate}>
            Acessar Portal
          </Button>
          <Button onClick={() => setEditModalOpen(true)}>Editar Cliente</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap justify-start">
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="onboarding">
            <Rocket className="mr-2 h-4 w-4" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="access">
            <UserCog className="mr-2 h-4 w-4" />
            Acessos
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="financial">
            <Wallet className="mr-2 h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="support">
            <MessageSquare className="mr-2 h-4 w-4" />
            Suporte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <h3 className="mb-4 text-lg font-semibold">Dados Cadastrais</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="block text-sm text-muted-foreground">Razao Social</span>
                  <span>{client.legal_name || "-"}</span>
                </div>
                <div>
                  <span className="block text-sm text-muted-foreground">CNPJ</span>
                  <span>{client.cnpj || "-"}</span>
                </div>
                <div>
                  <span className="block text-sm text-muted-foreground">Telefone</span>
                  <span>{client.phone || "-"}</span>
                </div>
                <div>
                  <span className="block text-sm text-muted-foreground">Responsavel</span>
                  <span>{client.profiles?.full_name || "Nao atribuido"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <h3 className="mb-4 text-lg font-semibold">Modulos Ativos</h3>
              <div className="flex flex-wrap gap-2">
                {activeModules.length > 0 ? (
                  activeModules.map(([key]) => (
                    <span
                      key={key}
                      className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary"
                    >
                      {key === "approvals"
                        ? "Aprovacoes"
                        : key === "financial"
                          ? "Financeiro"
                          : key === "documents"
                            ? "Documentos"
                            : key === "support"
                              ? "Suporte"
                              : key}
                    </span>
                  ))
                ) : (
                  <span className="text-sm italic text-muted-foreground">Nenhum modulo ativo.</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSyncFlow} disabled={syncingFlow}>
              {syncingFlow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Sincronizar fluxo
            </Button>
            <Button variant="outline" onClick={fetchOnboardingTasks}>
              Atualizar progresso
            </Button>
          </div>

          {loadingOnboarding ? (
            <LoadingSkeleton className="h-[420px] w-full" />
          ) : onboardingTasks.length > 0 ? (
            <OnboardingRoadmap tasks={onboardingTasks} readOnly />
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              Nenhuma etapa de onboarding encontrada para este cliente.
            </div>
          )}
        </TabsContent>

        <TabsContent value="access" className="pt-4">
          <ClientAccessTab clientId={id || ""} />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <DocumentLibrary clientIdFilter={id || ""} />
        </TabsContent>

        <TabsContent value="financial" className="pt-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-2 text-lg font-semibold">Financeiro do Cliente</h3>
            <p className="text-sm text-muted-foreground">
              As faturas e assinaturas deste cliente ficam centralizadas no modulo financeiro geral.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/agency/financial")}>
              Abrir Financeiro Geral
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="support" className="pt-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-2 text-lg font-semibold">Suporte</h3>
            <p className="text-sm text-muted-foreground">
              O historico de tickets deste cliente pode ser acompanhado no modulo de suporte.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate(`/agency/support?clientId=${client.id}`)}>
              Ver Tickets
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <ClientEditModal
        client={client}
        open={isEditModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={fetchClient}
      />
    </div>
  );
}
