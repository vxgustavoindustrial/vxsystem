import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClientFilterBar } from "@/components/calendar/ClientFilterBar";
import { TaskCreateModal } from "@/components/modals/TaskCreateModal";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export function AgencyGeneralPage() {
  const [clientIdFilter, setClientIdFilter] = useState("all");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTaskCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <PageHeader 
          title="Atividades Complementares" 
          description="Gestão de tarefas gerais e apoio operacional."
        />
        <div className="flex space-x-3 items-center">
          <ClientFilterBar value={clientIdFilter} onChange={setClientIdFilter} />
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <KanbanBoard clientIdFilter={clientIdFilter} moduleFilter="general" key={refreshKey} />
      </div>

      <TaskCreateModal 
        open={isCreateModalOpen} 
        onOpenChange={setCreateModalOpen} 
        onSuccess={handleTaskCreated}
        defaultModule="general"
      />
    </div>
  );
}
