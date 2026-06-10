import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

const createEventSchema = z.object({
  title: z.string().min(2, "Título obrigatório"),
  event_date: z.string(),
  event_type: z.enum(['post', 'story', 'live', 'meeting', 'tarefa']),
  platform: z.string().optional(),
  client_id: z.string().min(1, "Selecione o cliente"),
  color: z.string().optional(),
  module: z.enum(['general', 'onboarding', 'financial', 'documents', 'support']).optional(),
  description: z.string().optional(),
});

type CreateEventFormValues = z.infer<typeof createEventSchema>;

export type CalendarEventItem = {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  color?: string;
  client_id: string;
  platform?: string;
  module?: string;
  description?: string;
};

interface EventCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  initialEvent?: CalendarEventItem | null;
  onSuccess: () => void;
}

export function EventCreateModal({
  open,
  onOpenChange,
  initialDate,
  initialEvent,
  onSuccess,
}: EventCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const isEdit = !!initialEvent;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      color: "#3b82f6",
      event_type: "post",
    }
  });

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from("clients").select("id, name");
    if (data) setClients(data);
  }, []);

  useEffect(() => {
    if (open) {
      if (initialEvent) {
          // No tittle check if it has [T] prefix (task) and cleaning it if needed
          const displayTitle = initialEvent.title.startsWith('[T] ') 
            ? initialEvent.title.replace('[T] ', '') 
            : initialEvent.title;

          reset({
            title: displayTitle,
            event_date: initialEvent.event_date,
            event_type: initialEvent.event_type as 'post' | 'story' | 'live' | 'meeting' | 'tarefa',
            platform: initialEvent.platform || '',
            color: initialEvent.color || '#3b82f6',
            client_id: initialEvent.client_id,
            module: (initialEvent.module as 'general' | 'onboarding' | 'financial' | 'documents' | 'support') || 'general',
            description: initialEvent.description || '',
          });
      } else {
          reset({
            title: '',
            event_date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            event_type: 'post',
            platform: '',
            color: '#3b82f6',
            module: 'general',
            description: '',
          });
      }
      fetchClients();
    }
  }, [open, initialDate, initialEvent, reset, fetchClients]);

  const clientId = watch("client_id");
  const eventType = watch("event_type");

  const onSubmit = async (data: CreateEventFormValues) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (data.event_type === 'tarefa') {
        const taskPayload = {
          title: data.title,
          client_id: data.client_id,
          module: data.module || 'general',
          due_date: data.event_date,
          description: data.description,
        };

        if (isEdit) {
           const { error } = await supabase.from('tasks')
             .update(taskPayload)
             .eq('id', initialEvent!.id);
           if (error) throw error;
        } else {
           const { error } = await supabase.from('tasks').insert({
             ...taskPayload,
             status: 'todo',
             priority: 'medium',
             created_by: user.id
           });
           if (error) throw error;
        }
      } else {
        const socialPayload = {
          title: data.title,
          client_id: data.client_id,
          event_date: data.event_date,
          event_type: data.event_type,
          platform: data.platform,
          color: data.color,
        };

        if (isEdit) {
           const { error } = await supabase.from('social_calendar_events')
             .update(socialPayload)
             .eq('id', initialEvent!.id);
           if (error) throw error;
        } else {
           const { error } = await supabase.from('social_calendar_events').insert(socialPayload);
           if (error) throw error;
        }
      }

      toast.success(isEdit ? "Evento atualizado!" : "Evento criado!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar evento";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
     if (!initialEvent) return;
     if (!confirm("Excluir este evento permanentemente?")) return;

     setDeleting(true);
     try {
        const table = initialEvent.event_type === 'tarefa' ? 'tasks' : 'social_calendar_events';
        const { error } = await supabase.from(table).delete().eq('id', initialEvent.id);
        if (error) throw error;
        
        toast.success("Evento removido");
        onSuccess();
        onOpenChange(false);
     } catch (err) {
        console.error("Erro ao remover:", err);
        toast.error("Erro ao remover evento");
     } finally {
        setDeleting(false);
     }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label>Título</Label>
            <Input {...register("title")} placeholder="Ex: Post de Vendas..." />
            {errors.title && <span className="text-xs text-red-500">{errors.title.message}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid w-full items-center gap-1.5">
              <Label>Data</Label>
              <Input type="date" {...register("event_date")} />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label>Tipo de Evento</Label>
              <Select 
                value={eventType} 
                onValueChange={(val: 'post' | 'story' | 'live' | 'meeting' | 'tarefa') => setValue("event_type", val)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="tarefa">Tarefa do Board</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label>Cliente</Label>
            <Select 
              value={clientId} 
              onValueChange={(val) => setValue("client_id", val)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.client_id && <span className="text-xs text-red-500">{errors.client_id.message}</span>}
          </div>

          {eventType === 'tarefa' ? (
            <div className="grid w-full items-center gap-1.5">
              <Label>Módulo da Tarefa</Label>
              <Select 
                value={watch("module") || "general"} 
                onValueChange={(val: "general" | "onboarding" | "financial" | "documents" | "support") => setValue("module", val)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o módulo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="onboarding">Onboarding / Implantação</SelectItem>
                  <SelectItem value="financial">Financeiro</SelectItem>
                  <SelectItem value="documents">Documentos</SelectItem>
                  <SelectItem value="support">Suporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
               <div className="grid w-full items-center gap-1.5">
                  <Label>Plataforma</Label>
                  <Input {...register("platform")} placeholder="Instagram, FB..." />
               </div>
               <div className="grid w-full items-center gap-1.5">
                  <Label>Cor Padrão</Label>
                  <Input type="color" {...register("color")} className="p-1 h-9" />
               </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
            {isEdit ? (
                <Button type="button" variant="ghost" className="text-red-500 hover:text-red-600 px-2" onClick={handleDelete} disabled={deleting}>
                   <Trash2 className="w-4 h-4 mr-2" /> 
                   Excluir
                </Button>
            ) : <div />}
            <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{isEdit ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
