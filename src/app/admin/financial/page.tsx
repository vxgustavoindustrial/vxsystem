import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/services/supabase";
import { DataTable } from "@/components/tables/DataTable";
import { type ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Search, 
  Plus, 
  ExternalLink, 
  FileText, 
  MessageSquare, 
  StickyNote,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { FinancialCreateModal } from "@/components/modals/FinancialCreateModal";
import { type FinancialInvoice } from "@/types/general.types";
import { format } from "date-fns";
import { openDocumentFile } from "@/services/privateFiles";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

export function AdminFinancialPage() {
  const [data, setData] = useState<(FinancialInvoice & { clients: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from("financial_invoices")
      .select(`
        *,
        clients!financial_invoices_client_id_fkey ( name )
      `)
      .order('due_date', { ascending: false });

    const { data: invoices, error } = await query;

    if (error) {
      toast.error("Erro ao buscar faturas.");
      console.error(error);
    } else {
      setData(invoices || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchInvoices();
    };
    loadData();
  }, [fetchInvoices]);

  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter(item => 
      item.title?.toLowerCase().includes(search.toLowerCase()) || 
      item.clients?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const columns = useMemo<ColumnDef<FinancialInvoice & { clients: { name: string } | null }>[]>(() => [
    {
      accessorKey: "title",
      header: "Título",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.title || "Sem título"}</span>
            {row.original.status === 'disputed' && (
              <AlertTriangle className="h-4 w-4 text-orange-500 animate-pulse" />
            )}
          </div>
          <span className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</span>
        </div>
      )
    },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) => row.original.clients?.name || "Não atribuído",
    },
    {
      accessorKey: "amount",
      header: "Valor",
      cell: ({ row }) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.original.amount);
      }
    },
    {
      accessorKey: "due_date",
      header: "Vencimento",
      cell: ({ row }) => format(new Date(row.original.due_date), "dd/MM/yyyy"),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "feedback",
      header: "Feedback Cliente",
      cell: ({ row }) => {
        const { client_notes, dispute_message } = row.original;
        if (!client_notes && !dispute_message) return <span className="text-muted-foreground text-xs italic">Sem feedback</span>;

        return (
          <div className="flex gap-2">
            <TooltipProvider>
              {client_notes && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md cursor-help">
                      <StickyNote className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs font-semibold mb-1">Notas do Cliente:</p>
                    <p className="max-w-xs text-sm">{client_notes}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {dispute_message && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1.5 bg-orange-50 text-orange-600 rounded-md cursor-help">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs font-semibold mb-1 text-orange-600">Questionamento:</p>
                    <p className="max-w-xs text-sm">{dispute_message}</p>
                    {row.original.dispute_at && (
                      <p className="text-[10px] mt-2 opacity-70">
                        Enviado em: {format(new Date(row.original.dispute_at), "dd/MM HH:mm")}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        );
      }
    },
    {
      id: "file",
      header: "Arquivo",
      cell: ({ row }) => {
        const url = row.original.file_url;
        if (!url) return "-";
        return (
          <Button variant="ghost" size="icon" onClick={async () => {
            try {
              await openDocumentFile(url);
            } catch {
              toast.error("Nao foi possivel abrir o arquivo.");
            }
          }} title="Abrir Arquivo/Link">
              {url.includes('http') ? <ExternalLink className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </Button>
        );
      }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const handleMarkAsPaid = async () => {
          const { error } = await supabase
            .from('financial_invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', row.original.id);
          
          if (error) {
            toast.error("Erro ao atualizar pagamento.");
          } else {
            toast.success("Pagamento confirmado!");
            fetchInvoices();
          }
        };

        const handleResolveDispute = async () => {
          const { error } = await supabase
            .from('financial_invoices')
            .update({ status: 'pending' }) // Volta para pendente após resolver
            .eq('id', row.original.id);
          
          if (error) {
            toast.error("Erro ao resolver disputa.");
          } else {
            toast.success("Disputa resolvida!");
            fetchInvoices();
          }
        };

        const handleDelete = async () => {
          console.group('Financeiro: Exclusão de Fatura');
          console.log('Documento alvo ID:', row.original.id);
          console.log('Dados da linha:', row.original);
          
          if (!window.confirm("Tem certeza que deseja excluir esta fatura permanentemente?")) {
            console.log('Exclusão cancelada pelo usuário.');
            console.groupEnd();
            return;
          }
          
          try {
            const { error, count } = await supabase
              .from('financial_invoices')
              .delete()
              .eq('id', row.original.id);
            
            if (error) {
              console.error('Erro retornado pelo Supabase:', error);
              toast.error(`Erro ao excluir: ${error.message || 'Erro desconhecido'}`);
            } else {
              console.log('Operação de exclusão concluída. Linhas afetadas (se count ativado):', count);
              toast.success("Fatura excluída com sucesso!");
              fetchInvoices();
            }
          } catch (err) {
            console.error('Exceção capturada na exclusão:', err);
            toast.error("Ocorreu um erro inesperado ao tentar excluir.");
          } finally {
            console.groupEnd();
          }
        };

        return (
          <div className="flex gap-2">
            {row.original.status !== 'paid' && (
              <Button variant="outline" size="sm" onClick={handleMarkAsPaid}>
                Pago
              </Button>
            )}
            {row.original.status === 'disputed' && (
              <Button variant="secondary" size="sm" onClick={handleResolveDispute}>
                Resolver
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ], [fetchInvoices]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <PageHeader 
          title="Gestão Financeira" 
          description="Acompanhamento de faturas, boletos e investimentos em anúncios."
        />
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Boleto
        </Button>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por título ou cliente..." 
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton className="h-[400px] w-full" />
      ) : (
        <DataTable columns={columns} data={filteredData} />
      )}

      <FinancialCreateModal 
        open={isCreateModalOpen} 
        onOpenChange={setCreateModalOpen} 
        onSuccess={fetchInvoices} 
      />
    </div>
  );
}
