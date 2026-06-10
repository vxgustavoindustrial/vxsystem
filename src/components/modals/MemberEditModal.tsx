import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";
import { Loader2 } from "lucide-react";

interface MemberEditModalProps {
  member: { id: string; full_name: string; email: string; vx_role?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MemberEditModal({ member, open, onOpenChange, onSuccess }: MemberEditModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [vxRole, setVxRole] = useState("null");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setName(member.full_name);
      setEmail(member.email);
      setVxRole(member.vx_role ?? "null");
    }
  }, [member]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setLoading(true);

    const { error } = await supabase.rpc("update_team_member", {
      member_id: member.id,
      new_name: name.trim(),
      new_email: email.trim()
    });

    if (!error) {
      await supabase.from("profiles").update({ vx_role: vxRole === "null" ? null : vxRole }).eq("id", member.id);
    }

    setLoading(false);
    if (error) return toast.error(error.message || "Erro ao atualizar membro.");
    toast.success("Membro atualizado.");
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Membro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label>Nome</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label>Email</Label>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label>Nível de Acesso VX</Label>
            <Select value={vxRole} onValueChange={setVxRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Sem acesso VX</SelectItem>
                <SelectItem value="admin">Admin (acesso total)</SelectItem>
                <SelectItem value="programador">Programador (empresas + APK)</SelectItem>
                <SelectItem value="financeiro">Financeiro (boletos/contratos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
