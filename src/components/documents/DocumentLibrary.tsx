import * as React from "react";
import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";
import { DataTable } from "@/components/tables/DataTable";
import { type ColumnDef, type CellContext } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Eye, FileText, Trash2, Link as LinkIcon, FileSignature, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { openDocumentFile } from "@/services/privateFiles";

type DocumentItem = {
  id: string;
  title: string;
  file_type?: string;
  category: string;
  file_url: string;
  created_at: string;
  clients: { name: string };
};

const CATEGORY_LABELS: Record<string, string> = {
  contract: 'Contrato',
  draft: 'Minuta',
  brief: 'Briefing',
  report: 'Relatório',
  creative: 'Criativo',
  other: 'Outros'
};

export function DocumentLibrary({ clientIdFilter }: { clientIdFilter?: string }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'member';

  const fetchDocuments = React.useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("documents")
      .select(`
         id, title, file_type, category, file_url, created_at,
         clients ( name )
      `)
      .order('created_at', { ascending: false });

    if (clientIdFilter && clientIdFilter !== 'all') {
      query = query.eq('client_id', clientIdFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Erro ao carregar documentos");
    } else {
      const formattedData = ((data as unknown as DocumentItem[]) || []).map((doc) => ({
        ...doc,
        clients: Array.isArray(doc.clients) ? doc.clients[0] : doc.clients
      }));
      setDocuments(formattedData as DocumentItem[]);
    }
    setLoading(false);
  }, [clientIdFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchDocuments(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    
    setLoading(true);
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (!error) {
       toast.success("Documento excluído");
       fetchDocuments();
    } else {
       toast.error("Erro interno. Apenas admins.");
       setLoading(false);
    }
  };

  const handleOpen = async (url: string) => {
    try {
      await openDocumentFile(url);
    } catch {
      toast.error("Nao foi possivel abrir este documento.");
    }
  };

  const columns: ColumnDef<DocumentItem>[] = [
    {
      accessorKey: "title",
      header: "Arquivo",
      cell: ({ row }: CellContext<DocumentItem, unknown>) => {
        const doc = row.original;
        const isLink = doc.file_type === 'link';
        const isDraft = doc.category === 'draft';

        return (
          <div className="flex items-center space-x-3 max-w-[300px]">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isLink ? 'bg-indigo-500/10' : 'bg-orange-500/10'}`}>
               {isLink ? (
                 <LinkIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
               ) : (
                 isDraft ? <FileSignature className="w-4 h-4 text-orange-600 dark:text-orange-400" /> : <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
               )}
            </div>
            <div className="truncate font-medium text-foreground" title={doc.title}>
              {doc.title}
            </div>
          </div>
        );
      },
    },
    isAdmin ? {
      accessorKey: "clients.name",
      header: "Cliente",
      cell: ({ row }: CellContext<DocumentItem, unknown>) => <span className="text-muted-foreground">{row.original.clients?.name || 'Geral'}</span>
    } : {
      id: "client_name_hidden",
      header: "",
      cell: () => null,
      enableHiding: true
    },
    {
      accessorKey: "category",
      header: "Categoria",
      cell: ({ row }: CellContext<DocumentItem, unknown>) => (
        <span className="text-xs font-semibold px-2 py-1 bg-muted text-muted-foreground rounded-full border border-border/50">
          {CATEGORY_LABELS[row.original.category] || row.original.category}
        </span>
      )
    },
    {
      accessorKey: "created_at",
      header: "Data",
      cell: ({ row }: CellContext<DocumentItem, unknown>) => new Date(row.original.created_at).toLocaleDateString('pt-BR'),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }: CellContext<DocumentItem, unknown>) => {
        return (
          <div className="flex space-x-2 justify-end">
             <Button variant="outline" size="sm" onClick={() => void handleOpen(row.original.file_url)} title="Visualizar documento">
                   <Eye className="w-4 h-4 mr-2" /> Visualizar
             </Button>
             <Button variant="ghost" size="icon" onClick={() => void handleOpen(row.original.file_url)} title="Baixar arquivo">
                   <Download className="w-4 h-4" />
             </Button>
             {isAdmin && (
               <Button 
                variant="outline" 
                size="sm" 
                className="text-red-500 border-red-500/20 hover:bg-red-500/10 hover:text-red-600" 
                onClick={() => handleDelete(row.original.id)} 
                title="Excluir documento"
              >
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
               </Button>
             )}
          </div>
        )
      }
    }
  ];

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Buscando repositório...</div>
      ) : (
        <DataTable columns={columns} data={documents} />
      )}
    </div>
  );
}
