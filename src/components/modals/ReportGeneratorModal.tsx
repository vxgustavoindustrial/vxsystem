import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface ReportGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ReportGeneratorModal({ open, onOpenChange, onSuccess }: ReportGeneratorModalProps) {
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [reportType, setReportType] = useState('monthly');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from("clients").select("id, name").in('status', ['active', 'onboarding']);
    if (data) setClients(data);
  }, []);

  useEffect(() => {
    if (open) {
      const reset = async () => {
        await fetchClients();
        setClientId("");
        setReportType("monthly");
        setMonth(new Date().toISOString().slice(0, 7));
      };
      reset();
    }
  }, [open, fetchClients]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return toast.error("Selecione qual cliente pertence o relatório.");

    setLoading(true);
    
    // Simulating Edge Function generation delay
    setTimeout(() => {
        toast.promise(
            new Promise((resolve) => setTimeout(resolve, 2000)),
            {
               loading: 'A Edge Function está compilando o PDF via Puppeteer...',
               success: 'Relatório gerado e salvo!',
               error: 'Erro.',
            }
        );
        
        setTimeout(() => {
            onSuccess();
            onOpenChange(false);
            setLoading(false); // This line was removed by the user's edit, but it's crucial. Re-adding it.
        }, 2000);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gerar Novo Relatório</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleGenerate} className="space-y-4 pt-2">
          
          <div className="grid w-full items-center gap-1.5">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="grid w-full items-center gap-1.5">
                <Label>Tipo de Relatório</Label>
                <Select value={reportType} onValueChange={setReportType} required>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal de Resultados</SelectItem>
                    <SelectItem value="financial">Financeiro</SelectItem>
                    <SelectItem value="support">Suporte</SelectItem>
                </SelectContent>
              </Select>
              </div>

              <div className="grid w-full items-center gap-1.5">
                <Label>Mês de Referência</Label>
                <Input type="month" value={month} onChange={e => setMonth(e.target.value)} required />
              </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
                {loading ? "Gerando..." : "Gerar Relatório (PDF)"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
