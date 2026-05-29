import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Loader2, Key, UserPlus, Copy, Trash2, Shield, Edit2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Permissions } from "@/types/auth.types";

interface ClientAccessTabProps {
  clientId: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  permissions?: Permissions;
}

export function ClientAccessTab({ clientId }: ClientAccessTabProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Permissions>({
    approvals: 'view',
    financial: 'view',
    documents: 'view',
    support: 'view',
    onboarding: 'view'
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPermissions, setEditPermissions] = useState<Permissions>({});

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("client_id", clientId);

    if (error) {
      toast.error("Erro ao carregar acessos.");
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const generateDefaultPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const pass = Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
    setPassword(pass);
  };

  const handleCreateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Chamada RPC para criar o usuário no Auth e o perfil no Banco simultaneamente
      const { error } = await supabase.functions.invoke("create-client-access", {
        body: {
          email: email.toLowerCase(),
          password,
          fullName,
          clientId,
          permissions
        }
      });

      if (error) throw error;

      toast.success("Acesso criado e usuário registrado com sucesso!");
      setIsModalOpen(false);
      resetForm();
      fetchProfiles();
      
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao criar acesso automatico.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setPassword("");
    setPermissions({
      approvals: 'view',
      financial: 'view',
      documents: 'view',
      support: 'view',
      onboarding: 'view'
    });
  };

  const openEditModal = (profile: Profile) => {
    setEditingProfile(profile);
    setEditFullName(profile.full_name || "");
    setEditPermissions(profile.permissions || {
      approvals: 'view',
      financial: 'view',
      documents: 'view',
      support: 'view',
      onboarding: 'view'
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    setSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editFullName,
          permissions: editPermissions
        })
        .eq("id", editingProfile.id);

      if (error) throw error;

      toast.success("Acesso atualizado com sucesso!");
      setIsEditModalOpen(false);
      fetchProfiles();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar acesso.");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePermission = (
    currentPermissions: Permissions, 
    setFn: React.Dispatch<React.SetStateAction<Permissions>>, 
    module: keyof Permissions
  ) => {
    const newVal = currentPermissions[module] === 'manage' ? 'view' : 'manage';
    setFn({ ...currentPermissions, [module]: newVal });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const handleToggleAccess = async (profile: Profile) => {
    const action = profile.is_active ? "desativar" : "reativar";
    if (!confirm(`Tem certeza que deseja ${action} este acesso?`)) return;
    
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !profile.is_active })
      .eq("id", profile.id);

    if (error) {
      toast.error("Erro ao atualizar acesso.");
    } else {
      toast.success(`Acesso ${profile.is_active ? "desativado" : "reativado"}.`);
      fetchProfiles();
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">Usuários com Acesso</h3>
        <Button onClick={() => setIsModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Acesso
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário vinculado a este cliente.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.full_name || "Sem nome"}
                    {!p.is_active && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Inativo</span>}
                  </TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.permissions?.approvals === 'manage' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Aprovar</span>
                      )}
                      {p.permissions?.approvals === 'view' && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">Ver Aprovações</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditModal(p)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive"
                        onClick={() => handleToggleAccess(p)}
                      >
                        {p.is_active ? <Trash2 className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Novo Acesso</DialogTitle>
            <DialogDescription>
              Vincule um novo usuário a esta empresa. O acesso será criado automaticamente no sistema.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateAccess} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="acc-name">Nome Completo</Label>
              <Input 
                id="acc-name" 
                placeholder="Ex: João Silva" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="acc-email">E-mail de Login</Label>
              <Input 
                id="acc-email" 
                type="email" 
                placeholder="cliente@email.com" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Senha Padrão para o Cliente</Label>
              <div className="flex gap-2">
                <Input 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Clique em Gerar Senha"
                />
                <Button type="button" variant="outline" onClick={generateDefaultPassword}>
                  <Key className="w-4 h-4" />
                </Button>
                {password && (
                  <Button type="button" variant="ghost" onClick={() => copyToClipboard(password)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Anote esta senha para passar ao cliente.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Permissões (Selecionar para "Gerenciar", desmarcado é "Apenas Ver")
              </Label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="p-approvals" 
                    checked={permissions.approvals === 'manage'} 
                    onCheckedChange={() => togglePermission(permissions, setPermissions, 'approvals')}
                  />
                  <Label htmlFor="p-approvals" className="text-sm font-normal cursor-pointer">Aprovações (Pode Aprovar)</Label>
                </div>
                {/* Outras permissões podem ser adicionadas aqui conforme necessário */}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Criando Acesso..." : "Criar Acesso Automático"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Acesso</DialogTitle>
            <DialogDescription>
              Atualize o nome ou as permissões deste usuário.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleUpdateAccess} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input 
                id="edit-name" 
                value={editFullName}
                onChange={e => setEditFullName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Permissões (Selecionar para "Gerenciar", desmarcado é "Apenas Ver")
              </Label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="edit-p-approvals" 
                    checked={editPermissions.approvals === 'manage'} 
                    onCheckedChange={() => togglePermission(editPermissions, setEditPermissions, 'approvals')}
                  />
                  <Label htmlFor="edit-p-approvals" className="text-sm font-normal cursor-pointer">Aprovações (Pode Aprovar)</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
