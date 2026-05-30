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

interface MemberInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemberInviteModal({ open, onOpenChange }: MemberInviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);

  // NOTA: Como não estamos configurando Edge Functions agora,
  // na versão de produção real você enviaria o convite via:
  // supabase.auth.admin.inviteUserByEmail() — que exige chave de serviço.
  // Aqui apenas simulamos a ação ou fazemos um handle se não tiver a admin key.
  
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulação do envio de convite (Substitua por lógica real da API do Supabase).
    setTimeout(() => {
        toast.success(`Convite enviado com sucesso para ${email}!`);
        setLoading(false);
        onOpenChange(false);
        setEmail("");
    }, 1000);
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
            <Label>Email</Label>
            <Input 
              type="email" 
              required 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="exemplo@agencia.com" 
            />
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label>Cargo / Permissão Base</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro / Equipe</SelectItem>
                <SelectItem value="admin">Administrador Geral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
