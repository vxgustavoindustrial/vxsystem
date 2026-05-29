import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, Link as LinkIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FinancialCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FinancialCreateModal({ open, onOpenChange, onSuccess }: FinancialCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  
  // Form State
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<'labor' | 'ads' | 'software' | 'other'>('labor');
  const [dueDate, setDueDate] = useState("");
  const [sourceType, setSourceType] = useState<"file" | "link">("file");
  const [externalLink, setExternalLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchClients();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setClientId("");
    setTitle("");
    setDescription("");
    setAmount("");
    setCategory("labor");
    setDueDate("");
    setSourceType("file");
    setExternalLink("");
    setFile(null);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("id, name").is('deleted_at', null);
    if (data) setClients(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return toast.error("Selecione um cliente.");
    if (!title) return toast.error("Insira um título.");
    if (!amount) return toast.error("Insira o valor.");
    if (!dueDate) return toast.error("Insira a data de vencimento.");
    
    if (sourceType === "file" && !file) return toast.error("Selecione um arquivo.");
    if (sourceType === "link" && !externalLink) return toast.error("Insira o link externo.");

    setLoading(true);
    
    try {
      let finalFileUrl = externalLink;

      // 1. Handle File Upload if needed
      if (sourceType === "file" && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${clientId}/${Date.now()}.${fileExt}`;
        const filePath = `financial/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents') // Corrected bucket name
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        finalFileUrl = filePath;
      }

      // 2. Save to financial_invoices
      const { error: dbError } = await supabase.from('financial_invoices').insert({
        client_id: clientId,
        title,
        description,
        amount: parseFloat(amount),
        category,
        due_date: dueDate,
        file_url: finalFileUrl,
        status: 'pending'
      });

      if (dbError) throw dbError;

      toast.success("Fatura/Boleto criado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar fatura.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Fatura / Boleto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid w-full items-center gap-1.5">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(val: 'labor' | 'ads' | 'software' | 'other') => setCategory(val)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">Mão de Obra</SelectItem>
                  <SelectItem value="ads">Tráfego / Anúncios</SelectItem>
                  <SelectItem value="software">Software / Ferramentas</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="title">Título do Boleto</Label>
            <Input 
              id="title" 
              placeholder="Ex: Nota Fiscal Serviço Março/24" 
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input 
                id="amount" 
                type="number" 
                step="0.01" 
                placeholder="0,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input 
                id="dueDate" 
                type="date" 
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea 
              id="description" 
              placeholder="Detalhes adicionais..." 
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Fonte do Arquivo</Label>
            <Tabs value={sourceType} onValueChange={(v: string) => setSourceType(v as "file" | "link")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">Arquivo Local</TabsTrigger>
                <TabsTrigger value="link">Link Externo</TabsTrigger>
              </TabsList>
              
              <TabsContent value="file" className="pt-2">
                <div 
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600 font-medium">
                    {file ? file.name : "Clique para subir o boleto"}
                  </p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  aria-label="Subir arquivo de boleto"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </TabsContent>

              <TabsContent value="link" className="pt-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="https://nextcloud.caen.com/link-do-boleto" 
                      className="pl-8"
                      value={externalLink}
                      onChange={e => setExternalLink(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Criar Fatura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
