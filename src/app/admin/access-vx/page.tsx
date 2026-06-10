import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  vx_role: string | null;
  avatar_url: string | null;
};

const vxRoleDescriptions: Record<string, string> = {
  admin: "Acesso master: remove contratos, boletos, gerencia tudo",
  programador: "Acesso às empresas. Envia somente arquivos APK",
  financeiro: "Apenas upload de boletos e contratos (sem download)",
};

export function VxAccessManagementPage() {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .not("role", "eq", "client")
      .order("full_name", { ascending: true });
    if (data) setMembers(data as TeamMember[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchMembers(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchMembers]);

  const handleVxRoleChange = async (memberId: string, newRole: string) => {
    setUpdatingId(memberId);
    const { error } = await supabase
      .from("profiles")
      .update({ vx_role: newRole === "null" ? null : newRole })
      .eq("id", memberId);
    setUpdatingId(null);
    if (error) return toast.error("Erro ao atualizar nivel de acesso.");
    toast.success("Nivel de acesso atualizado.");
    void fetchMembers();
  };

  const isSelf = (id: string) => id === user?.id;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">VX Industrial</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Niveis de Acesso VX</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Gerencie os niveis de acesso interno da equipe: <strong>Admin</strong> (total),{" "}
            <strong>Programador</strong> (empresas + APK), <strong>Financeiro</strong> (boletos/contratos).
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Shield className="h-7 w-7" />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Membros da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : members.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum membro encontrado.
            </p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={member.avatar_url || ""} alt={member.full_name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {member.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{member.full_name}</span>
                        {isSelf(member.id) && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Voce</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:shrink-0">
                    <div className="text-right">
                      {member.vx_role && (
                        <p className="text-[11px] text-muted-foreground">
                          {vxRoleDescriptions[member.vx_role]}
                        </p>
                      )}
                    </div>
                    <Select
                      value={member.vx_role ?? "null"}
                      onValueChange={(v) => handleVxRoleChange(member.id, v)}
                      disabled={updatingId === member.id}
                    >
                      <SelectTrigger className="w-[200px] h-9 text-xs">
                        <SelectValue placeholder="Selecionar nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">Sem acesso VX</SelectItem>
                        <SelectItem value="admin">Admin (acesso total)</SelectItem>
                        <SelectItem value="programador">Programador (empresas + APK)</SelectItem>
                        <SelectItem value="financeiro">Financeiro (boletos/contratos)</SelectItem>
                      </SelectContent>
                    </Select>
                    {updatingId === member.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
