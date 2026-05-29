import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "../components/sidebar/Sidebar";
import { TopBar } from "../components/ui/TopBar";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { XCircle } from "lucide-react";
import { supabase } from "../services/supabase";

export function ClientLayout() {
  const { impersonatedClientId, setImpersonatedClientId, setActiveClient, profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchImpersonatedClient = async () => {
      if (impersonatedClientId) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('id', impersonatedClientId)
          .single();
        if (data) setActiveClient(data);
      } else if (profile?.client) {
        setActiveClient(profile.client);
      }
    };
    fetchImpersonatedClient();
  }, [impersonatedClientId, profile, setActiveClient]);

  const handleStopImpersonating = () => {
    const id = impersonatedClientId;
    setImpersonatedClientId(null);
    setActiveClient(profile?.client || null);
    navigate(`/admin/clients/${id}`);
  };
  
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background flex-col">
      {impersonatedClientId && (
        <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between z-50 shadow-md">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="bg-amber-700/50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">Modo Visualização</span>
            <span>Você está visualizando o portal como cliente.</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleStopImpersonating}
            className="text-white hover:bg-amber-700 h-8 gap-2"
          >
            <XCircle className="w-4 h-4" />
            Sair da Visualização
          </Button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 transition-all duration-300 ease-in-out w-full md:ml-16 overflow-hidden bg-background">
          <TopBar />
          <main className="flex-1 overflow-y-auto w-full p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
