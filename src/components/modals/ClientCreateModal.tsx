import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { supabase } from "@/services/supabase";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const createClientSchema = z.object({
  name: z.string().min(2, "Nome fantasia deve ter pelo menos 2 caracteres."),
  legal_name: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email("Email invalido."),
  phone: z.string().optional(),
  assigned_to: z.string().optional(),
  approvals: z.boolean().optional(),
  financial: z.boolean().optional(),
  documents: z.boolean().optional(),
  support: z.boolean().optional(),
});

type CreateClientFormValues = z.infer<typeof createClientSchema>;

interface ClientCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ClientCreateModal({ open, onOpenChange, onSuccess }: ClientCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState<{ id: string; full_name: string }[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      email: "",
      assigned_to: "",
      approvals: false,
      financial: false,
      documents: false,
      support: false,
    },
  });

  useEffect(() => {
    if (!open) return;

    const fetchAdmins = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["admin", "member"]);

      if (error) {
        console.error(error);
        return;
      }

      setAdmins((data || []) as { id: string; full_name: string }[]);
    };

    reset();
    void fetchAdmins();
  }, [open, reset]);

  const approvals = watch("approvals");
  const financial = watch("financial");
  const documents = watch("documents");
  const support = watch("support");
  const assigned_to = watch("assigned_to");

  const onSubmit = async (data: CreateClientFormValues) => {
    setLoading(true);

    try {
      const { error } = await supabase.from("clients").insert({
        name: data.name,
        legal_name: data.legal_name,
        cnpj: data.cnpj,
        email: data.email,
        phone: data.phone,
        status: "onboarding",
        assigned_to: data.assigned_to || null,
        modules_enabled: {
          approvals: !!data.approvals,
          financial: !!data.financial,
          documents: !!data.documents,
          support: !!data.support,
        },
        onboarding_step: 0,
        onboarding_completed: false,
      });

      if (error) {
        throw error;
      }

      toast.success("Cliente criado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Erro ao criar cliente";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="name">Nome Fantasia *</Label>
            <Input id="name" placeholder="Ex: VX Industrial" {...register("name")} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" placeholder="contato@vx.com.br" {...register("email")} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="legal_name">Razao Social</Label>
              <Input id="legal_name" {...register("legal_name")} />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" {...register("cnpj")} />
            </div>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="assigned_to">Responsavel (Admin)</Label>
            <Select key={`assigned-to-${open}`} value={assigned_to} onValueChange={(value) => setValue("assigned_to", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um membro..." />
              </SelectTrigger>
              <SelectContent>
                {admins.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2">
            <Label>Modulos Ativos</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="approvals" checked={approvals} onCheckedChange={(value) => setValue("approvals", value as boolean)} />
                <label htmlFor="approvals" className="text-sm font-medium leading-none">
                  Aprovacoes
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="financial" checked={financial} onCheckedChange={(value) => setValue("financial", value as boolean)} />
                <label htmlFor="financial" className="text-sm font-medium leading-none">
                  Financeiro
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="documents" checked={documents} onCheckedChange={(value) => setValue("documents", value as boolean)} />
                <label htmlFor="documents" className="text-sm font-medium leading-none">
                  Documentos
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="support" checked={support} onCheckedChange={(value) => setValue("support", value as boolean)} />
                <label htmlFor="support" className="text-sm font-medium leading-none">
                  Suporte
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
