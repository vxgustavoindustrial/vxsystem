import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bell, MessageSquare, Rocket } from "lucide-react";

import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientProjectRoadmap } from "@/components/cards/ClientProjectRoadmap";
import { toast } from "sonner";

interface DashboardData {
  active_projects: number;
  completed_projects: number;
  open_tasks: number;
  open_tickets: number;
  unread_notifications: number;
  pending_invoices: number;
  pending_value: number;
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  href?: string;
  description?: string;
}) {
  const navigate = useNavigate();

  return (
    <Card
      className={`group relative overflow-hidden transition-all duration-200 ${href ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
      onClick={() => href && navigate(href)}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground truncate">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description && <p className="text-[10px] text-muted-foreground mt-1">{description}</p>}
        </div>
        {href && <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
      </CardContent>
    </Card>
  );
}

export function ClientDashboard() {
  const { clientId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      if (!clientId) return;

      try {
        setLoading(true);

        const promises = [
          supabase.from("vx_projects").select("id, status", { count: "exact", head: true }).eq("client_id", clientId),
          supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("client_id", clientId).in("status", ["open", "in_progress"]),
          supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
        ] as const;

        const [projectsRes, ticketsRes, notifsRes] = await Promise.all(promises);

        setData({
          active_projects: projectsRes.count || 0,
          completed_projects: 0,
          open_tasks: 0,
          open_tickets: ticketsRes.count || 0,
          unread_notifications: notifsRes.count || 0,
          pending_invoices: 0,
          pending_value: 0,
        });
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
        toast.error("Nao foi possivel carregar alguns dados do dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void fetchDashboard();
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Visao geral do seu projeto na VX." />
        <LoadingSkeleton type="card" rows={1} cols={4} />
        <LoadingSkeleton type="card" rows={1} cols={3} />
      </div>
    );
  }

  const stats = data || {
    active_projects: 0,
    completed_projects: 0,
    open_tasks: 0,
    open_tickets: 0,
    unread_notifications: 0,
    pending_invoices: 0,
    pending_value: 0,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Dashboard"
        description="Visao geral do seu projeto, suas etapas e seus proximos passos."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Projetos em Andamento"
          value={stats.active_projects}
          icon={Rocket}
          href="/client/onboarding"
          description="Fluxo industrial ativo"
        />
        <StatCard
          title="Chamados Abertos"
          value={stats.open_tickets}
          icon={MessageSquare}
          href="/client/support"
          description="Suporte em andamento"
        />
        <StatCard
          title="Notificacoes nao lidas"
          value={stats.unread_notifications}
          icon={Bell}
          href="/client/support"
          description="Atualizacoes do sistema"
        />
      </div>

      <ClientProjectRoadmap clientId={clientId || ""} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acoes Rapidas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="justify-start gap-2" asChild>
            <a href="/client/onboarding">
              <Rocket className="h-4 w-4" />
              Ver Onboarding
            </a>
          </Button>
          <Button variant="outline" className="justify-start gap-2" asChild>
            <a href="/client/support">
              <MessageSquare className="h-4 w-4" />
              Abrir Suporte
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
