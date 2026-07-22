import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserCog, ReceiptText, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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
import type { ClientWithProfile } from "@/types/client.types";

type AssignedProfile = {
  id: string;
  full_name: string;
  email?: string | null;
};

type Subscription = {
  id: string;
  plan_name: string;
  status: string;
  monthly_amount: number;
  support_level: string;
  platform_seats: number;
  starts_on: string;
  renews_on_day: number | null;
};

const subscriptionStatusLabels: Record<string, { label: string; class: string }> = {
  active: { label: "Ativa", class: "bg-emerald-500/10 text-emerald-500" },
  past_due: { label: "Em atraso", class: "bg-amber-500/10 text-amber-500" },
  suspended: { label: "Suspensa", class: "bg-red-500/10 text-red-500" },
  cancelled: { label: "Cancelada", class: "bg-muted text-muted-foreground" },
};

function SubscriptionStatus({ status }: { status: string }) {
  const cfg = subscriptionStatusLabels[status] || { label: status, class: "bg-muted text-muted-foreground" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.class}`}>{cfg.label}</span>;
}

function SubscriptionIcon({ status }: { status: string }) {
  if (status === "active") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "past_due") return <AlertCircle className="h-5 w-5 text-amber-500" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}

export function AdminClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  const fetchClient = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const clientRow = data as ClientWithProfile;
      let profile: AssignedProfile | undefined;

      if (clientRow.assigned_to) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", clientRow.assigned_to)
          .maybeSingle();

        if (profileError) throw profileError;
        profile = profileData as AssignedProfile | undefined;
      }

      setClient({ ...clientRow, profiles: profile });
    } catch (error) {
      console.error("Erro ao encontrar cliente:", error);
      toast.error("Nao foi possivel carregar o cliente.");
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchSubscription = useCallback(async () => {
    if (!id) return;
    setLoadingSubscription(true);
    try {
      const { data, error } = await supabase
        .from("client_subscriptions")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data as Subscription | null);
    } catch (error) {
      console.error("Erro ao carregar assinatura:", error);
    } finally {
      setLoadingSubscription(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchClient();
    void fetchSubscription();
  }, [fetchClient, fetchSubscription]);

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
          <TabsTrigger value="access">
            <UserCog className="mr-2 h-4 w-4" />
            Acessos
          </TabsTrigger>
          <TabsTrigger value="acquisition">
            <ReceiptText className="mr-2 h-4 w-4" />
            Aquisição
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
                      {key === "financial" ? "Financeiro" : key === "documents" ? "Documentos" : key === "support" ? "Suporte" : key}
                    </span>
                  ))
                ) : (
                  <span className="text-sm italic text-muted-foreground">Nenhum modulo ativo.</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="access" className="pt-4">
          <ClientAccessTab clientId={id || ""} />
        </TabsContent>

        <TabsContent value="acquisition" className="space-y-4 pt-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-4 text-lg font-semibold">Plano / Assinatura</h3>
            {loadingSubscription ? (
              <LoadingSkeleton className="h-32 w-full" />
            ) : subscription ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <SubscriptionIcon status={subscription.status} />
                  <div>
                    <p className="text-xl font-bold">{subscription.plan_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {Number(subscription.monthly_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      /mes
                    </p>
                  </div>
                  <div className="ml-auto">
                    <SubscriptionStatus status={subscription.status} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">SAC</p>
                    <p className="mt-1 text-sm font-medium capitalize">{subscription.support_level}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Licencas</p>
                    <p className="mt-1 text-sm font-medium">{subscription.platform_seats}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Vencimento</p>
                    <p className="mt-1 text-sm font-medium">Dia {subscription.renews_on_day || "-"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ativo desde {new Date(subscription.starts_on).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum plano contratado.</p>
            )}
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
