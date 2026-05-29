import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClientFilterBar } from "@/components/calendar/ClientFilterBar";
import { DocumentLibrary } from "@/components/documents/DocumentLibrary";
import { DocumentUploadModal } from "@/components/modals/DocumentUploadModal";

export function AdminDocumentsPage() {
  const [clientIdFilter, setClientIdFilter] = useState("all");
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDocumentUploaded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <PageHeader 
          title="Documentos" 
          description="Armazenamento seguro de contratos, senhas via PDF, briefings e propostas."
        />
        <div className="flex space-x-3 items-center">
          <ClientFilterBar value={clientIdFilter} onChange={setClientIdFilter} />
          <Button onClick={() => setUploadModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Arquivo
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <DocumentLibrary clientIdFilter={clientIdFilter} key={refreshKey} />
      </div>

      <DocumentUploadModal 
        open={isUploadModalOpen} 
        onOpenChange={setUploadModalOpen} 
        onSuccess={handleDocumentUploaded}
      />
    </div>
  );
}
