import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, CreditCard, FileSignature, Monitor, ShieldCheck, AlertTriangle, UploadCloud } from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingVXSteps } from "@/modules/onboarding/components/OnboardingVXSteps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

type Contract = {
  id: string;
  title: string;
  contract_type: "service" | "nda" | "platform";
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  document_url: string | null;
};
type Subscription = {
  id: string;
  plan_name: string;
  status: string;
  monthly_amount: number;
  support_level: string;
  platform_seats: number;
  starts_on: string;
};

const contractNames = { service: "Prestacao de servico", nda: "Confidencialidade", platform: "Plataforma VX" };

export function ClientAccessPage() {
  const { clientId, profile, clientRole, isLoading: isAuthLoading } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      if (!isAuthLoading) setLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      const [contractsResult, planResult] = await Promise.all([
        supabase.from("service_contracts").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("client_subscriptions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setContracts((contractsResult.data as Contract[] | null) || []);
      setSubscription((planResult.data as Subscription | null) || null);
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clientId, isAuthLoading]);

  if (!isAuthLoading && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground min-h-[400px] border border-dashed rounded-3xl bg-card mt-6 animate-in fade-in">
        <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
        <h4 className="font-bold text-xl mb-2 text-foreground">Perfil de Cliente Incompleto</h4>
        <p className="text-sm text-center max-w-md">
          Sua conta de usuário ainda não foi associada a uma empresa (Cliente). 
          Por favor, entre em contato com o administrador ou suporte para realizar a vinculação e liberar o seu acesso à área VX.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card p-7">
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Etapa 1</p>
          <h1 className="mt-3 text-3xl font-bold">Sua Area VX</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesso seguro aos seus contratos, plano, projetos industriais e comunicacoes com a equipe VX.</p>
        </div>
      </header>
      {loading ? <LoadingSkeleton className="h-72 w-full" /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Monitor className="h-5 w-5 text-primary" /> Conta ativa</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="font-semibold">{profile?.full_name || "Usuario VX"}</p><p className="text-muted-foreground">{profile?.email}</p><div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-emerald-500"><BadgeCheck className="h-4 w-4" /> Acesso autenticado</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5 text-primary" /> Plano contratado</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
            {subscription ? <><p className="text-xl font-bold">{subscription.plan_name}</p><p className="text-muted-foreground">{Number(subscription.monthly_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mes</p><p>SAC: {subscription.support_level} - {subscription.platform_seats} licenca(s)</p></> : <p className="text-muted-foreground">Plano ainda nao disponibilizado.</p>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" /> Protecao</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Seus arquivos ficam restritos ao seu projeto.</p><p className="text-muted-foreground">Downloads finais sao liberados somente apos a conclusao tecnica.</p>{clientRole !== 'financeiro' && <Button asChild className="mt-2 w-full"><Link to="/client/upload"><UploadCloud className="mr-2 h-4 w-4" /> Enviar projeto <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}</CardContent></Card>
        </div>
      )}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileSignature className="h-5 w-5 text-primary" /> Documentos liberados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {contracts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum contrato assinado disponivel na sua area.</p> : contracts.map((contract) => (
            <div key={contract.id} className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
              <div><p className="font-semibold">{contract.title}</p><p className="text-sm text-muted-foreground">{contractNames[contract.contract_type]} - {contract.status}</p></div>
              {contract.document_url && <a className="text-sm font-medium text-primary hover:underline" href={contract.document_url} rel="noreferrer" target="_blank">Visualizar</a>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectStage({ step }: { step: number }) {
  const { clientId, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSkeleton className="h-80 w-full" />;
  
  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground min-h-[400px] border border-dashed rounded-3xl bg-card mt-6 animate-in fade-in">
        <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
        <h4 className="font-bold text-xl mb-2 text-foreground">Perfil de Cliente Incompleto</h4>
        <p className="text-sm text-center max-w-md">
          Sua conta de usuário ainda não foi associada a uma empresa (Cliente). 
          Por favor, entre em contato com o administrador ou suporte para realizar a vinculação e liberar o seu acesso à área VX.
        </p>
      </div>
    );
  }
  
  return <OnboardingVXSteps clientId={clientId} initialStep={step} />;
}

export function ClientUploadPage() {
  return <ProjectStage step={2} />;
}
export function ClientProcessingPage() {
  return <ProjectStage step={3} />;
}
export function ClientLibraryPage() {
  return <ProjectStage step={4} />;
}
export function ClientInstallationPage() {
  return <ProjectStage step={5} />;
}
