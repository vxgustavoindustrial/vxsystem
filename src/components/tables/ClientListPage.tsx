import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/services/supabase";
import { DataTable } from "@/components/tables/DataTable";
import { type ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { ClientCreateModal } from "@/components/modals/ClientCreateModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { type ClientWithProfile } from "@/types/client.types";

type AssignedProfile = {
  id: string;
  full_name: string;
  email?: string | null;
};

export function ClientListPage() {
  const [data, setData] = useState<ClientWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [financials, setFinancials] = useState<Record<string, number>>({});

  const fetchClients = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("clients")
        .select("id, name, email, status, modules_enabled, assigned_to")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }

      const { data: clients, error } = await query;

      if (error) {
        throw error;
      }

      const clientRows = (clients || []) as ClientWithProfile[];
      const assignedIds = Array.from(
        new Set(
          clientRows
            .map((client) => client.assigned_to)
            .filter((id): id is string => Boolean(id))
        )
      );

      let assignedProfiles: AssignedProfile[] = [];

      if (assignedIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assignedIds);

        if (profilesError) {
          throw profilesError;
        }

        assignedProfiles = (profilesData || []) as AssignedProfile[];
      }

      const profileMap = new Map(assignedProfiles.map((profile) => [profile.id, profile]));
      const formatted = clientRows.map((client) => ({
        ...client,
        profiles: client.assigned_to ? profileMap.get(client.assigned_to) : undefined,
      }));

      const clientIds = clientRows.map((client) => client.id);
      const summary: Record<string, number> = {};

      if (clientIds.length > 0) {
        const { data: finData, error: finError } = await supabase
          .from("financial_invoices")
          .select("client_id, amount")
          .in("client_id", clientIds)
          .eq("status", "pending");

        if (finError) {
          throw finError;
        }

        (finData || []).forEach((invoice) => {
          summary[invoice.client_id] = (summary[invoice.client_id] || 0) + Number(invoice.amount || 0);
        });
      }

      setData(formatted);
      setFinancials(summary);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao buscar clientes.");
      setData([]);
      setFinancials({});
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const columns = useMemo<ColumnDef<ClientWithProfile>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nome da Empresa",
      },
      {
        accessorKey: "email",
        header: "Email",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "modules_enabled",
        header: "Modulos",
        cell: ({ row }) => {
          const mods = row.original.modules_enabled;
          if (!mods) return "-";

          const parts: string[] = [];
          if (mods.approvals) parts.push("Aprovacoes");
          if (mods.financial) parts.push("Financeiro");
          if (mods.documents) parts.push("Documentos");
          if (mods.support) parts.push("Suporte");
          return parts.join(", ");
        },
      },
      {
        accessorKey: "assigned_to",
        header: "Responsavel",
        cell: ({ row }) => row.original.profiles?.full_name || "Nao atribuido",
      },
      {
        id: "balance",
        header: "Pendente",
        cell: ({ row }) => {
          const amount = financials[row.original.id] || 0;
          return (
            <span className={amount > 0 ? "font-bold text-amber-600" : "text-green-600"}>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)}
            </span>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/clients/${row.original.id}`}>Ver Detalhes</Link>
          </Button>
        ),
      },
    ],
    [financials]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Gestao de Clientes"
          description="Acompanhe o status, modulos e detalhes dos clientes."
        />
        <Button onClick={() => setCreateModalOpen(true)}>Novo Cliente</Button>
      </div>

      <div className="mb-4 flex gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? <LoadingSkeleton className="h-[400px] w-full" /> : <DataTable columns={columns} data={data} />}

      <ClientCreateModal
        open={isCreateModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={fetchClients}
      />
    </div>
  );
}
