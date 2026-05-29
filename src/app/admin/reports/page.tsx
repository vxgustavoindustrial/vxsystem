import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { FileBarChart2 } from "lucide-react";
import { ClientFilterBar } from "@/components/calendar/ClientFilterBar";
import { ReportGeneratorModal } from "@/components/modals/ReportGeneratorModal";

export function AgencyReportsPage() {
  const [clientIdFilter, setClientIdFilter] = useState("all");
  const [isGeneratorModalOpen, setGeneratorModalOpen] = useState(false);

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <PageHeader 
          title="Relatórios de Desempenho" 
          description="Gere e organize todos os reportes mensais de resultados dos seus clientes."
        />
        <div className="flex space-x-3 items-center">
          <ClientFilterBar value={clientIdFilter} onChange={setClientIdFilter} />
          <Button onClick={() => setGeneratorModalOpen(true)}>
            <FileBarChart2 className="mr-2 h-4 w-4" />
            Gerar Relatório
          </Button>
        </div>
      </div>

      <div className="flex-1 pb-4 flex items-center justify-center">
         <div className="text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg p-12 max-w-lg">
             <FileBarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <h3 className="text-lg font-semibold text-slate-700">Central de Relatórios</h3>
             <p className="text-sm text-slate-500 mt-2">
                Os relatórios da agência ainda não foram configurados em produção para gerar PDFs reais pelo Puppeteer e Edge Functions. Ao clicar em gerar, um processo simulado é ativado.
             </p>
         </div>
      </div>

      <ReportGeneratorModal 
        open={isGeneratorModalOpen} 
        onOpenChange={setGeneratorModalOpen} 
        onSuccess={() => console.log('Relatório Gerado!')}
      />
    </div>
  );
}
