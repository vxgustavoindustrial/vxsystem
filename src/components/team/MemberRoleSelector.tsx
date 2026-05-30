import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { useState } from "react";

interface MemberRoleSelectorProps {
  member: { id: string; role: string; full_name: string };
  onUpdate: () => void;
}

export function MemberRoleSelector({ member, onUpdate }: MemberRoleSelectorProps) {
  const [updating, setUpdating] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', member.id);

    if (error) {
      toast.error("Erro ao atualizar papel.");
      console.error(error);
    } else {
      toast.success(`Cargo de ${member.full_name} atualizado para ${newRole}`);
      onUpdate();
    }
    setUpdating(false);
  };

  return (
    <Select 
      value={member.role} 
      onValueChange={handleRoleChange} 
      disabled={updating}
    >
      <SelectTrigger className="w-[140px] h-8 text-xs font-semibold">
        <SelectValue placeholder="Selecione..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">Membro / Equipe</SelectItem>
        <SelectItem value="admin">Administrador</SelectItem>
      </SelectContent>
    </Select>
  );
}
