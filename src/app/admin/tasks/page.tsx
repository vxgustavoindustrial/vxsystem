import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClientFilterBar } from "@/components/calendar/ClientFilterBar";
import { TaskCreateModal } from "@/components/modals/TaskCreateModal";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskHistory } from "@/components/kanban/TaskHistory";
import { Tabs, TabsContent } from "@/components/ui/tabs";

export function AdminTasksPage() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'kanban';
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
          title="Gestão de Tarefas" 
          description="Acompanhe o andamento das demandas da equipe."
        />
        <div className="flex space-x-3 items-center">
          <ClientFilterBar value={clientIdFilter} onChange={setClientIdFilter} />
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsContent value="kanban" className="flex-1 overflow-x-auto pb-4 mt-0">
          <KanbanBoard clientIdFilter={clientIdFilter} key={`kanban-${refreshKey}`} />
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-auto pb-4 mt-0">
          <TaskHistory clientIdFilter={clientIdFilter} key={`history-${refreshKey}`} />
        </TabsContent>

        <TabsContent value="calendar" className="flex-1 overflow-auto pb-4 mt-0">
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-muted-foreground text-center py-12">Calendário de tarefas em desenvolvimento</p>
          </div>
        </TabsContent>
      </Tabs>

      <TaskCreateModal 
        open={isCreateModalOpen} 
        onOpenChange={setCreateModalOpen} 
        onSuccess={handleTaskCreated}
      />
    </div>
  );
}
