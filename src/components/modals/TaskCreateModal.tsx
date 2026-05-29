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
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const createTaskSchema = z.object({
  title: z.string().min(2, "Título obrigatório"),
  description: z.string().optional(),
  client_id: z.string().min(1, "Selecione o cliente"),
  module: z.enum(['general', 'onboarding', 'approvals', 'financial', 'documents', 'support']),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
  stage: z.string().optional(),
});

type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

interface TaskCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultModule?: 'general' | 'onboarding' | 'approvals' | 'financial' | 'documents' | 'support';
}

export function TaskCreateModal({
  open,
  onOpenChange,
  onSuccess,
  defaultModule = 'general',
}: TaskCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      status: "todo",
      priority: "medium",
      module: defaultModule,
    }
  });

  useEffect(() => {
    if (open) {
      reset({
        title: '',
        description: '',
        client_id: '',
        module: 'general',
        status: 'todo',
        priority: 'medium',
        due_date: '',
        assigned_to: '',
        stage: '',
      });
      fetchData();
    }
  }, [open, reset]);

  const fetchData = async () => {
    const [clientsRes, teamRes] = await Promise.all([
      supabase.from("clients").select("id, name").in('status', ['active', 'onboarding']),
      supabase.from("profiles").select("id, full_name").in("role", ["admin", "member"]),
    ]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (teamRes.data) setTeam(teamRes.data);
  };

  const clientId = watch("client_id");
  const moduleVal = watch("module");
  const priorityVal = watch("priority");
  const assignedTo = watch("assigned_to");
  const stageVal = watch("stage");

  const onSubmit = async (data: CreateTaskFormValues) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from('tasks').insert({
        title: data.title,
        description: data.description,
        client_id: data.client_id,
        module: data.module,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date || null,
        assigned_to: (data.assigned_to === 'unassigned' || !data.assigned_to) ? null : data.assigned_to,
        stage: (data.stage === 'none' || !data.stage) ? null : data.stage,
        created_by: user.id,
      });

      if (error) throw error;
      toast.success("Tarefa criada com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label>Título</Label>
            <Input {...register("title")} placeholder="Descreva a tarefa..." />
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label>Descrição</Label>
            <Textarea {...register("description")} placeholder="Detalhes adicionais..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid w-full items-center gap-1.5">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={(val) => setValue("client_id", val)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label>Módulo</Label>
              <Select value={moduleVal} onValueChange={(val) => setValue("module", val as CreateTaskFormValues['module'])}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="onboarding">Onboarding / Implantação</SelectItem>
                  <SelectItem value="approvals">Aprovações</SelectItem>
                  <SelectItem value="financial">Financeiro</SelectItem>
                  <SelectItem value="documents">Documentos</SelectItem>
                  <SelectItem value="support">Suporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid w-full items-center gap-1.5">
              <Label>Prioridade</Label>
              <Select value={priorityVal} onValueChange={(val) => setValue("priority", val as CreateTaskFormValues['priority'])}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label>Prazo (Opcional)</Label>
              <Input type="date" {...register("due_date")} />
            </div>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label>Responsável (Opcional)</Label>
            <Select value={assignedTo} onValueChange={(val) => setValue("assigned_to", val)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                 <SelectItem value="unassigned">Não atribuído</SelectItem>
                {team.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label>Etapa / Fase (Opcional)</Label>
            <Select value={stageVal} onValueChange={(val) => setValue("stage", val)}>
              <SelectTrigger><SelectValue placeholder="Selecione a fase..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Geral / Não Definido</SelectItem>
                <SelectItem value="onboarding_phase_1">Fase 1 — Setup Inicial</SelectItem>
                <SelectItem value="onboarding_phase_2">Fase 2 — Escalabilidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
