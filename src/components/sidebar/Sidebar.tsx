import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebarStore } from "../../store/sidebarStore";
import { useAuth } from "../../hooks/useAuth";
import { SidebarGroup } from "./SidebarGroup";
import { SidebarItem } from "./SidebarItem";
import { cn } from "../../lib/utils";
import {
  LayoutDashboard, Briefcase, FileText, 
  CreditCard, Lock, ShoppingCart, Upload, Cpu, Library, 
  Glasses, Headphones, LogOut, Hexagon, Users,
  CalendarDays, ClipboardList, FolderOpen, Milestone,
  Radio, Shield
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuthStore } from "../../store/authStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role, isVxAdmin, isVxProgramador, isVxFinanceiro, isProjetista } = useAuth();
  const { profile, activeClient } = useAuthStore();
  const { isMobile } = useSidebarStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Erro ao fazer logout:', e);
    } finally {
      useAuthStore.getState().clear();
      navigate("/login", { replace: true });
    }
  };

  // on desktop, visually hide labels unless hovered, but on mobile always show labels inside the Sheet
  const textClasses = isMobile ? "block" : "hidden group-hover:block transition-all duration-200";


  const showAll = isVxAdmin;
  const showFinancial = showAll || isVxFinanceiro;
  const showOperations = showAll || isVxProgramador;

  const adminItems = (
    <>
      <SidebarGroup label="Principal">
        <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/admin" onNavigate={onNavigate} />
        {(showAll || isVxProgramador) && (
          <SidebarItem icon={Users} label="Clientes" href="/admin/clients" onNavigate={onNavigate} />
        )}
        {showAll && (
          <SidebarItem icon={Users} label="Equipe" href="/admin/team" onNavigate={onNavigate} />
        )}
      </SidebarGroup>
      {showAll && (
        <SidebarGroup label="CRM">
          <SidebarItem icon={Radio} label="CRM" href="/admin/crm" onNavigate={onNavigate} />
        </SidebarGroup>
      )}
      {showFinancial && (
        <SidebarGroup label="Financeiro">
          <SidebarItem icon={CreditCard} label="Financeiro" href="/admin/financeiro" onNavigate={onNavigate} />
          <SidebarItem icon={FileText} label="Contratos" href="/admin/contracts" onNavigate={onNavigate} />
          <SidebarItem icon={Briefcase} label="Prest. Serv." href="/admin/services" onNavigate={onNavigate} />
          <SidebarItem icon={Lock} label="Confidencialidade" href="/admin/nda" onNavigate={onNavigate} />
          <SidebarItem icon={ShoppingCart} label="Aquisição Plat." href="/admin/platform" onNavigate={onNavigate} />
        </SidebarGroup>
      )}
      {showOperations && (
        <SidebarGroup label="Operacao do Cliente">
          <SidebarItem icon={Upload} label="Uploads Recebidos" href="/admin/uploads" onNavigate={onNavigate} />
          <SidebarItem icon={Cpu} label="Processamento" href="/admin/processing" onNavigate={onNavigate} />
          <SidebarItem icon={Library} label="Biblioteca" href="/admin/library" onNavigate={onNavigate} />
          <SidebarItem icon={Glasses} label="Instalação" href="/admin/installation" onNavigate={onNavigate} />
        </SidebarGroup>
      )}
      {showAll && (
        <SidebarGroup label="Atendimento">
          <SidebarItem icon={Headphones} label="SAC" href="/admin/support" onNavigate={onNavigate} />
          <SidebarItem icon={FolderOpen} label="Documentos" href="/admin/documents" onNavigate={onNavigate} />
        </SidebarGroup>
      )}
      {showAll && (
        <SidebarGroup label="Execucao">
          <SidebarItem icon={ClipboardList} label="Tarefas" href="/admin/tasks" onNavigate={onNavigate} />
          <SidebarItem icon={CalendarDays} label="Calendario" href="/admin/calendar" onNavigate={onNavigate} />
        </SidebarGroup>
      )}
      {showAll && (
        <SidebarGroup label="Administrativo">
          <SidebarItem icon={Shield} label="Niveis de Acesso" href="/admin/access-vx" onNavigate={onNavigate} />
        </SidebarGroup>
      )}
    </>
  );

  const clientItems = (
    <>
      <SidebarGroup label="Principal">
        <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/client" onNavigate={onNavigate} />
        <SidebarItem icon={Milestone} label="Jornada VX" href="/client/onboarding" onNavigate={onNavigate} />
      </SidebarGroup>
      {isProjetista && (
        <SidebarGroup label="Operacao do Cliente">
          <SidebarItem icon={Upload} label="Uploads" href="/client/upload" onNavigate={onNavigate} />
          <SidebarItem icon={Cpu} label="Processamento" href="/client/processing" onNavigate={onNavigate} />
          <SidebarItem icon={Library} label="Biblioteca" href="/client/library" onNavigate={onNavigate} />
          <SidebarItem icon={Glasses} label="Instalação" href="/client/installation" onNavigate={onNavigate} />
        </SidebarGroup>
      )}
      <SidebarGroup label="Suporte">
        <SidebarItem icon={Headphones} label="SAC" href="/client/support" onNavigate={onNavigate} />
        {!isProjetista && <SidebarItem icon={CreditCard} label="Financeiro" href="/client/financial" onNavigate={onNavigate} />}
        {!isProjetista && <SidebarItem icon={FolderOpen} label="Documentos" href="/client/documents" onNavigate={onNavigate} />}
      </SidebarGroup>
      {(activeClient?.modules_enabled?.approvals) && (
        <SidebarGroup label="Servicos Contratados">
          {activeClient.modules_enabled.approvals && <SidebarItem icon={FileText} label="Aprovacoes" href="/client/approvals" onNavigate={onNavigate} />}
        </SidebarGroup>
      )}
    </>
  );

  return (
    <>
      <div className="flex h-16 items-center border-b px-4 border-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <Hexagon className="h-8 w-8 shrink-0 text-primary" />
          <span className={cn("text-xl font-bold whitespace-nowrap", textClasses)}>VX</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {(role === "admin" || role === "member") ? adminItems : clientItems}
      </nav>

      <div className="border-t p-3 border-border">
        <div className={cn("flex flex-col sm:flex-row items-center", "justify-center group-hover:justify-between")}>
          <div className="flex items-center overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
              <span className="font-semibold text-foreground">
                {profile?.full_name?.charAt(0) || "U"}
              </span>
            </div>
            <div className={cn("ml-3 truncate", textClasses)}>
              <p className="truncate text-sm font-medium">{profile?.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{(role === "admin" || role === "member") ? "VX" : "Cliente"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={cn("rounded-md p-2 text-muted-foreground hover:bg-secondary shrink-0", 
              isMobile ? "ml-auto" : "mt-2 group-hover:mt-0 group-hover:ml-auto w-full group-hover:w-auto flex justify-center group-hover:justify-start"
            )}
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const { isExpanded, isMobile, expand, collapse, setIsMobile } = useSidebarStore();

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) collapse();
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [setIsMobile, collapse]);

  // Mobile: Sheet drawer
  if (isMobile) {
    return (
      <Sheet open={isExpanded} onOpenChange={(open) => (open ? expand() : collapse())}>
        <SheetContent side="left" className="w-64 p-0 flex flex-col bg-card border-r border-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu de NavegaÃ§Ã£o</SheetTitle>
          </SheetHeader>
          <SidebarContent onNavigate={() => collapse()} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar with CSS group hover expand
  // Note we removed `onMouseEnter` because we will rely purely on CSS hover.
  return (
    <aside
      className={cn(
        "group fixed inset-y-0 left-0 z-50 hidden md:flex flex-col border-r bg-card transition-all duration-300 ease-in-out border-border",
        "w-16 hover:w-60"
      )}
    >
      <SidebarContent />
    </aside>
  );
}

