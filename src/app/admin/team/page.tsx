import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TeamMemberList } from "@/components/team/TeamMemberList";
import { MemberInviteModal } from "@/components/modals/MemberInviteModal";

export function AdminTeamPage() {
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <PageHeader 
          title="Gestão de Equipe" 
          description="Controle os acessos, cargos e clientes designados para sua equipe."
        />
        <Button onClick={() => setInviteModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      <TeamMemberList />
      
      <MemberInviteModal 
        open={isInviteModalOpen} 
        onOpenChange={setInviteModalOpen}
      />
    </div>
  );
}
