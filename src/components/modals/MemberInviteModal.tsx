import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/services/supabase";
import { Key, Copy, Loader2 } from "lucide-react";
interface MemberInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MemberInviteModal({ open, onOpenChange, onSuccess }: MemberInviteModalProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");
  const [vxRole, setVxRole] = useState("null");
  const [loading, setLoading] = useState(false);

  const generateDefaultPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const pass = Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
    setPassword(pass);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.functions.invoke("create-team-member", {
      body: {
        email: email.toLowerCase(),
        password,
        fullName: fullName.trim(),
        role,
        vxRole: vxRole === "null" ? null : vxRole,
      },
    });

    setLoading(false);
    if (error) return toast.error(error.message || "Erro ao criar membro.");
    toast.success(`Membro ${fullName} criado com sucesso!`);
    onOpenChange(false);
    setEmail("");
    setFullName("");
    setPassword("");
    setVxRole("null");
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Convidar Membro</DialogTitle>
          <DialogDescription>
             Envie um link de acesso para a equipe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label>Nome Completo</Label>
            <Input 
              required 
              value={fullName} 
              onChange={e => setFullName(e.target.value)} 
              placeholder="Ex: Joao Silva" 
            />
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label>Email</Label>
            <Input 
              type="email" 
              required 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="exemplo@vx.com.br" 
            />
          </div>

          <div className="space-y-2">
            <Label>Senha</Label>
            <div className="flex gap-2">
              <Input 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Clique em Gerar Senha"
              />
              <Button type="button" variant="outline" onClick={generateDefaultPassword}>
                <Key className="w-4 h-4" />
              </Button>
              {password && (
                <Button type="button" variant="ghost" onClick={() => { navigator.clipboard.writeText(password); toast.success("Copiado!"); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label>Cargo</Label>
            <Select key={`invite-role-${open}`} value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro / Equipe</SelectItem>
                <SelectItem value="admin">Administrador Geral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label>Nivel de Acesso VX</Label>
            <Select key={`invite-vxrole-${open}`} value={vxRole} onValueChange={setVxRole}>
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
              {loading ? "Criando..." : "Criar Membro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
