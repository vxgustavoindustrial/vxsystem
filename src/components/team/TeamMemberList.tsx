import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { DataTable } from "@/components/tables/DataTable";
import { type ColumnDef } from "@tanstack/react-table";
import { MemberRoleSelector } from "./MemberRoleSelector";
import { MemberEditModal } from "@/components/modals/MemberEditModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type TeamMember = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string;
  created_at: string;
};

export function TeamMemberList() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .not("role", "eq", "client")
      .order('created_at', { ascending: false });

    if (data) {
      setMembers(data as TeamMember[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (isMounted) fetchMembers();
    };
    void load();
    return () => { isMounted = false; };
  }, [fetchMembers]);

  const handleDelete = async (member: TeamMember) => {
    if (!window.confirm(`Tem certeza que deseja excluir ${member.full_name}? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(member.id);
    const { error } = await supabase.from("profiles").delete().eq("id", member.id);
    setDeletingId(null);
    if (error) return toast.error("Erro ao excluir membro.");
    toast.success("Membro excluído.");
    fetchMembers();
  };

  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: "full_name",
      header: "Membro",
      cell: ({ row }) => {
        const url = row.original.avatar_url;
        const fallback = row.original.full_name?.charAt(0) || "?";
        return (
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8 shrink-0">
               <AvatarImage src={url} alt={row.original.full_name} />
               <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                 {fallback}
               </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-foreground">{row.original.full_name}</div>
              <div className="text-xs text-muted-foreground">{row.original.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Cargo / Permissão",
      cell: ({ row }) => {
        return <MemberRoleSelector member={row.original} onUpdate={fetchMembers} />;
      },
    },
    {
      accessorKey: "created_at",
      header: "Entrou em",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString('pt-BR'),
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const member = row.original;
        const isDeleting = deletingId === member.id;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setEditMember(member); setEditModalOpen(true); }}
              title="Editar membro"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(member)}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Excluir membro"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando membros...</div>
      ) : (
        <DataTable columns={columns} data={members} />
      )}
      <MemberEditModal
        member={editMember}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={fetchMembers}
      />
    </div>
  );
}
