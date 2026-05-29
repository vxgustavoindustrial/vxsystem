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
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, Link as LinkIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface DocumentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DocumentUploadModal({ open, onOpenChange, onSuccess }: DocumentUploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [docType, setDocType] = useState('contract');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [title, setTitle] = useState("");
  const [uploadType, setUploadType] = useState<'file' | 'link'>('file');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchClients();
      setClientId("");
      setDocType("contract");
      setFile(null);
      setExternalUrl("");
      setTitle("");
      setUploadType("file");
    }
  }, [open]);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("id, name");
    if (data) setClients(data as { id: string; name: string }[]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (uploadType === 'file' && !file) return toast.error("Selecione um arquivo primeiro.");
    if (uploadType === 'link' && (!externalUrl || !title)) return toast.error("Preencha o título e o link.");
    if (!clientId) return toast.error("Selecione qual cliente pertence o documento.");

    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let finalUrl = externalUrl;
      const finalTitle = title || file?.name || "Sem título";
      let finalFileType = 'link';

      if (uploadType === 'file' && file) {
        // 1. Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${clientId}/${Date.now()}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        finalUrl = filePath;
        finalFileType = fileExt === 'pdf' ? 'pdf' : (['doc', 'docx'].includes(fileExt || '') ? 'doc' : 'other');
      }

      // 3. Save to database
      const { error: dbError } = await supabase.from('documents').insert({
        client_id: clientId,
        title: finalTitle,
        category: docType,
        file_url: finalUrl,
        file_type: finalFileType,
        uploaded_by: user.id
      });

      if (dbError) throw dbError;

      toast.success("Documento salvo com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Falha ao salvar";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Novo Documento</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="file" value={uploadType} onValueChange={(v) => setUploadType(v as 'file' | 'link')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="file">Subir Arquivo</TabsTrigger>
            <TabsTrigger value="link">Link Externo</TabsTrigger>
          </TabsList>

          <form onSubmit={handleUpload} className="space-y-4">
            <TabsContent value="file" className="mt-0">
               <div 
                 role="button"
                 tabIndex={0}
                 aria-label="Área de upload de arquivo"
                 className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                 onClick={() => fileInputRef.current?.click()}
                 onKeyDown={handleKeyDown}
               >
                   <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
                   <p className="text-sm text-slate-600 font-medium">
                     {file ? file.name : "Clique aqui para subir PDF, Word, etc"}
                   </p>
                   {file && <p className="text-xs text-primary mt-1">{(file.size / 1024).toFixed(2)} KB</p>}
               </div>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 aria-label="Selecionar arquivo"
                 title="Selecionar arquivo"
                 onChange={e => setFile(e.target.files?.[0] || null)}
               />
            </TabsContent>

            <TabsContent value="link" className="mt-0 space-y-4">
               <div className="grid w-full items-center gap-1.5">
                 <Label>Título do Documento</Label>
                 <Input 
                   placeholder="Ex: Contrato assinado (Drive)" 
                   value={title}
                   onChange={e => setTitle(e.target.value)}
                 />
               </div>
               <div className="grid w-full items-center gap-1.5">
                 <Label>URL do Link (Google Drive, etc)</Label>
                 <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      className="pl-9"
                      placeholder="https://drive.google.com/..." 
                      value={externalUrl}
                      onChange={e => setExternalUrl(e.target.value)}
                    />
                 </div>
               </div>
            </TabsContent>

            <div className="grid grid-cols-2 gap-4 pt-2">
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
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract">Contrato</SelectItem>
                    <SelectItem value="draft">Minuta de Contrato</SelectItem>
                    <SelectItem value="brief">Briefing</SelectItem>
                    <SelectItem value="report">Relatório</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar Documento"}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
