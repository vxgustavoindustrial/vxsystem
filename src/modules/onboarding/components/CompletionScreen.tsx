import { PartyPopper, LayoutDashboard, FileText, MessageSquare, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface CompletionScreenProps {
  clientName: string;
}

export function CompletionScreen({ clientName }: CompletionScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-3xl scale-150 animate-pulse" />
        <div className="relative z-10 flex h-24 w-24 -rotate-6 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/30 transition-all hover:rotate-0">
          <PartyPopper className="h-12 w-12 text-white" />
        </div>
      </div>

      <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">
        Parabens, {clientName}!
      </h1>

      <p className="mb-8 max-w-xl text-lg text-muted-foreground">
        A sua ativacao foi concluida com sucesso. Agora voce pode acompanhar o onboarding,
        os documentos, o financeiro e o suporte em um so lugar.
      </p>

      <div className="mb-8 grid w-full grid-cols-2 gap-4">
        <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-3 bg-card border-border hover:bg-muted hover:border-border transition-all hover:-translate-y-1" onClick={() => navigate("/client")}>
          <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
          <span className="text-foreground">Dashboard</span>
        </Button>
        <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-3 bg-card border-border hover:bg-muted hover:border-border transition-all hover:-translate-y-1" onClick={() => navigate("/client/onboarding")}>
          <PartyPopper className="h-6 w-6 text-blue-500" />
          <span className="text-foreground">Onboarding</span>
        </Button>
        <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-3 bg-card border-border hover:bg-muted hover:border-border transition-all hover:-translate-y-1" onClick={() => navigate("/client/documents")}>
          <FileText className="h-6 w-6 text-blue-500" />
          <span className="text-foreground">Documentos</span>
        </Button>
        <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-3 bg-card border-border hover:bg-muted hover:border-border transition-all hover:-translate-y-1" onClick={() => navigate("/client/support")}>
          <MessageSquare className="h-6 w-6 text-purple-500" />
          <span className="text-foreground">Suporte</span>
        </Button>
      </div>

      <Button variant="outline" className="gap-2" onClick={() => navigate("/client/financial")}>
        <Wallet className="h-4 w-4" />
        Abrir Financeiro
      </Button>
    </div>
  );
}
