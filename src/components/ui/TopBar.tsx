import { useState, useEffect, Fragment } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSidebarStore } from "../../store/sidebarStore";
import { useNotificationStore } from "../../store/notificationStore";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../services/supabase";
import { Bell, Menu, User, LogOut, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "./dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  const { toggle } = useSidebarStore();
  const { role } = useAuth();
  const { profile } = useAuthStore();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [activeClient, setActiveClient] = useState("all");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (role === "client" && profile?.client_id) {
      const cleanup = useNotificationStore.getState().initialize(profile.client_id);
      return cleanup;
    }
    if ((role === "admin" || role === "member") && profile?.id) {
      const cleanup = useNotificationStore.getState().initialize(profile.id, "user");
      return cleanup;
    }
  }, [role, profile?.client_id, profile?.id]);

  useEffect(() => {
    const fetchClients = async () => {
      if (role === "admin") {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name")
          .is("deleted_at", null);
        if (error) {
          console.error("Erro ao buscar clientes para TopBar:", error);
        } else {
          setClients(data || []);
        }
      }
    };
    fetchClients();
  }, [role]);

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

  const pathNames = location.pathname.split("/").filter(x => x);
  
  const breadcrumbMap: Record<string, string> = {
    admin: "VX",
    client: "Cliente",
    clients: "Clientes",
    calendar: "CalendÃ¡rio",
    tasks: "Tarefas",
    flows: "Fluxos",
    team: "Equipe",
  reports: "RelatÃ³rios",
  onboarding: "Onboarding",
  support: "Suporte",
  financial: "Financeiro",
  documents: "Documentos",
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 border-border">
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className="text-muted-foreground hover:text-foreground md:hidden"
          title="Alternar Menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <nav className="hidden md:flex items-center space-x-1 text-sm font-medium text-muted-foreground">
          {pathNames.map((value, index) => {
            const isLast = index === pathNames.length - 1;
            const title = breadcrumbMap[value] || value;
            const url = `/${pathNames.slice(0, index + 1).join("/")}`;
            
            return (
              <Fragment key={value}>
                {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
                {isLast ? (
                  <span className="text-foreground font-semibold truncate">
                    {title.charAt(0).toUpperCase() + title.slice(1)}
                  </span>
                ) : (
                  <Link 
                    to={url} 
                    className="hover:text-primary transition-colors truncate"
                  >
                    {title.charAt(0).toUpperCase() + title.slice(1)}
                  </Link>
                )}
              </Fragment>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {role === "admin" && (
          <div className="hidden sm:block w-48">
            <Select value={activeClient} onValueChange={setActiveClient}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">VisÃ£o Geral (Todos)</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {role === "client" && (
          <div className="hidden sm:block text-sm font-medium text-foreground mr-2">
            {profile?.full_name || "Conta Cliente"}
          </div>
        )}
        
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-card border-border">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>NotificaÃ§Ãµes</span>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-primary">
                  Marcar todas lidas
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.slice(0, 5).map((notif) => (
                  <DropdownMenuItem 
                    key={notif.id} 
                    className={cn("flex flex-col items-start p-3 gap-1 cursor-pointer hover:bg-secondary", !notif.read_at && "bg-secondary/50")}
                    onSelect={() => {
                      if (notif.link) navigate(notif.link);
                      if (!notif.read_at) markAsRead(notif.id);
                    }}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={cn("text-xs font-semibold", !notif.read_at && "text-primary")}>
                        {notif.title}
                      </span>
                      {!notif.read_at && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    {notif.body && <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>}
                    <span className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhuma notificaÃ§Ã£o no momento
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || ""} alt={profile?.full_name || ""} />
                <AvatarFallback className="bg-primary/10 text-primary uppercase">
                  {profile?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{profile?.full_name}</p>
                <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Meu Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair da conta</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

