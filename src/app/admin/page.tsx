

import { ClientSummaryGrid } from '@/components/cards/ClientSummaryGrid';
import { TeamActivityFeed } from '@/components/cards/TeamActivityFeed';
import { PageHeader } from '@/components/ui/PageHeader';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard da Agência" 
        description="Visão geral e desempenho de todos os clientes." 
      />
      
      <ClientSummaryGrid />

      <div className="grid grid-cols-1 gap-6">
        <TeamActivityFeed />
      </div>
    </div>
  );
}
