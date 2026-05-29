import { useState } from "react";
import { MonthlyCalendarView } from "@/components/calendar/MonthlyCalendarView";
import { ClientFilterBar } from "@/components/calendar/ClientFilterBar";
import { PageHeader } from "@/components/ui/PageHeader";

export function AdminCalendarPage() {
  const [clientIdFilter, setClientIdFilter] = useState("all");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <PageHeader 
          title="Calendário Geral" 
          description="Acompanhe posts, reuniões e tarefas de todos os clientes."
        />
        <ClientFilterBar value={clientIdFilter} onChange={setClientIdFilter} />
      </div>

      <MonthlyCalendarView clientIdFilter={clientIdFilter} />
    </div>
  );
}
