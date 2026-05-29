import { useState, useEffect } from "react";
import { SupportService } from "@/modules/support/services/support.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Search, Clock, MessageCircle, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SupportTicketWithClient } from "@/modules/support/types";

export default function AgencySupportPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicketWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const data = await SupportService.getTickets();
      setTickets(data);
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.client?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aberto</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">Em Análise</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">Resolvido</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">Fechado</span>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader 
        title="Central de Atendimento" 
        description="Gerencie todos os chamados de suporte dos clientes."
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Buscar por assunto, cliente ou ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-24 bg-zinc-900/30 rounded-xl border border-zinc-800 border-dashed">
          <MessageCircle className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">Nenhum chamado aberto</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">Tudo limpo por aqui! Ninguém solicitou suporte ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredTickets.map(ticket => (
            <div 
              key={ticket.id}
              onClick={() => navigate(`/agency/support/${ticket.id}`)}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 hover:bg-zinc-800/80 cursor-pointer transition-all duration-200 gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-mono text-zinc-500">#{ticket.id.split('-')[0]}</span>
                  {getStatusBadge(ticket.status)}
                  {ticket.priority === 'high' && (
                    <span className="text-xs text-red-400 font-medium">Urgente</span>
                  )}
                </div>
                <h3 className="text-lg font-medium text-zinc-100">{ticket.subject}</h3>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <User className="w-3.5 h-3.5" />
                  <span>{ticket.client?.name || "Cliente Desconhecido"}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-zinc-500 whitespace-nowrap">
                <Clock className="w-4 h-4" />
                <span>Atualizado há {formatDistanceToNow(new Date(ticket.updated_at), { locale: ptBR })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
