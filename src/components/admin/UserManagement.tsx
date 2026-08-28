import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2, Pencil, AlertTriangle, Merge, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserRole } from '@/hooks/useUserRole';
import { userRoleSchema } from '@/lib/validation';
import { mapDatabaseError, logError } from '@/lib/error-handling';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { PlanUsageCard } from './PlanUsageCard';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { invokeOrionFunction } from '@/lib/orion-functions';

interface NewUserForm {
  full_name: string;
  email: string;
  department: string;
  role: 'customer' | 'technician' | 'admin';
}

interface EditUserForm {
  id: string;
  full_name: string;
  email: string;
  department: string;
  role: 'customer' | 'technician' | 'admin';
  password: string;
  company_id: string;
  status: string;
}

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  department: string | null;
  company_id: string;
  role: string;
  company_name: string;
  status: string;
}

// Conta-fantasma criada pelo agente no primeiro chamado aberto pela bandeja
// (ver handler/auth_handlers.go, machineLogin) — nunca tem senha/login real.
// Regra do usuário: ao mesclar, o destino deve ser sempre a conta com login.
const isGhostAccount = (email: string) => /^machine-[^@]+@orion\.internal$/i.test(email);

export const UserManagement = () => {
  const { toast } = useToast();
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [mergingSourceUser, setMergingSourceUser] = useState<UserData | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const [formData, setFormData] = useState<NewUserForm>({
    full_name: '',
    email: '',
    department: '',
    role: 'customer',
  });
  const [editFormData, setEditFormData] = useState<EditUserForm>({
    id: '',
    full_name: '',
    email: '',
    department: '',
    role: 'customer',
    password: '',
    company_id: '',
    status: 'active',
  });

  // Buscar todas as empresas para o select de edição
  const { data: allCompanies } = useCompanies();

  // Buscar company_id do admin atual
  const { data: currentUserProfile } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', session?.user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  // Buscar departamentos da empresa
  const { data: departments } = useQuery({
    queryKey: ['departments', currentUserProfile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('company_id', currentUserProfile?.company_id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!currentUserProfile?.company_id,
  });

  const { data: users, isLoading, isError, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const [profilesRes, companiesRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, department, company_id')
          .order('full_name'),
        supabase
          .from('companies')
          .select('id, name'),
        supabase
          .from('user_roles')
          .select('user_id, role'),
      ]);

      if (profilesRes.error) {
        console.error('[UserManagement] Erro ao carregar perfis:', profilesRes.error);
        throw profilesRes.error;
      }

      const profiles = profilesRes.data || [];
      const companies = companiesRes.data || [];
      const roles = rolesRes.data || [];

      const companyMap = new Map((companies || []).map(c => [c.id, c.name]));
      
      const roleMap = new Map<string, string>();
      const roleHierarchy: Record<string, number> = {
        developer: 4,
        admin: 3,
        technician: 2,
        customer: 1,
      };

      (roles || []).forEach(r => {
        if (!r.user_id) return;
        const currentRank = roleHierarchy[roleMap.get(r.user_id) || ''] || 0;
        const newRank = roleHierarchy[r.role] || 0;
        if (newRank >= currentRank) {
          roleMap.set(r.user_id, r.role);
        }
      });

      return profiles.map(profile => ({
        ...profile,
        status: 'active',
        role: roleMap.get(profile.id) || 'customer',
        company_name: profile.company_id ? (companyMap.get(profile.company_id) || 'Sem empresa') : 'Sem empresa'
      })) as UserData[];
    },
    staleTime: 10_000,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const validationResult = userRoleSchema.safeParse(newRole);
      
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      const { error } = await supabase
        .from('user_roles')
        .update({ role: validationResult.data })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const labels: Record<string, string> = {
        'customer': 'Colaborador',
        'technician': 'Técnico',
        'admin': 'Gestor'
      };
      const roleLabel = labels[variables.newRole] || variables.newRole;

      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: 'Sucesso',
        description: `Função atualizada para ${roleLabel}`,
      });
    },
    onError: (error) => {
      logError('updateRoleMutation', error);
      toast({
        title: 'Erro',
        description: mapDatabaseError(error),
        variant: 'destructive',
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await invokeOrionFunction('delete-user-admin', { user_id: userId });

      if (error) {
        throw new Error(error.message || 'Erro ao excluir usuário');
      }

      if ((data as { error?: string })?.error) {
        throw new Error((data as { error?: string }).error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: 'Sucesso',
        description: 'Usuário removido com sucesso',
      });
    },
    onError: (error: Error) => {
      logError('deleteUserMutation', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir o usuário',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setDeletingUserId(null);
    }
  });

  const handleDeleteUser = useCallback((userId: string) => {
    setDeletingUserId(userId);
    deleteUserMutation.mutate(userId);
  }, [deleteUserMutation]);

  // Mescla dados de um usuário-fantasma (criado pelo agente na primeira vez
  // que alguém abriu chamado pela bandeja) num usuário real de login — o
  // source (quem abriu o dialog) desaparece, o target escolhido recebe tudo.
  const mergeUsersMutation = useMutation({
    mutationFn: async ({ sourceUserId, targetUserId }: { sourceUserId: string; targetUserId: string }) => {
      const { data, error } = await invokeOrionFunction('merge-users', {
        source_user_id: sourceUserId,
        target_user_id: targetUserId,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao mesclar usuários');
      }
      const result = data as { error?: string; warning?: string };
      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (result?.warning) {
        toast({
          title: 'Dados mesclados',
          description: 'O usuário de origem não pôde ser removido automaticamente — remova-o manualmente.',
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Usuários mesclados — os dados foram unificados.',
        });
      }
      setMergingSourceUser(null);
      setMergeTargetId('');
    },
    onError: (error: Error) => {
      logError('mergeUsersMutation', error);
      toast({
        title: 'Erro ao mesclar',
        description: error.message || 'Não foi possível mesclar os usuários',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsMerging(false);
    },
  });

  const handleOpenMergeDialog = useCallback((userItem: UserData) => {
    setMergingSourceUser(userItem);
    setMergeTargetId('');
  }, []);

  const handleConfirmMerge = useCallback(() => {
    if (!mergingSourceUser || !mergeTargetId) return;
    setIsMerging(true);
    mergeUsersMutation.mutate({ sourceUserId: mergingSourceUser.id, targetUserId: mergeTargetId });
  }, [mergingSourceUser, mergeTargetId, mergeUsersMutation]);

  const handleUpdateUserRole = useCallback((userId: string, newRole: UserRole) => {
    updateRoleMutation.mutate({ userId, newRole });
  }, [updateRoleMutation]);

  const handleCreateUser = async () => {
    if (!formData.full_name || !formData.email) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (!currentUserProfile?.company_id) {
      toast({
        title: 'Erro',
        description: 'Não foi possível identificar sua empresa',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await invokeOrionFunction('create-user-credentials', {
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        department: formData.department || null,
        role: formData.role,
        company_id: currentUserProfile.company_id,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar usuário');
      }

      if ((data as { error?: string })?.error) {
        throw new Error((data as { error?: string }).error);
      }

      toast({
        title: 'Usuário criado!',
        description: 'Usuário criado e credenciais enviadas por e-mail.',
      });

      setFormData({
        full_name: '',
        email: '',
        department: '',
        role: 'customer',
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

    } catch (error) {
      const err = error as Error;
      logError('handleCreateUser', err);
      toast({
        title: 'Erro ao criar usuário',
        description: err.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditDialog = useCallback((userItem: UserData) => {
    setEditFormData({
      id: userItem.id,
      full_name: userItem.full_name || '',
      email: userItem.email,
      department: userItem.department || '',
      role: userItem.role as 'customer' | 'technician' | 'admin',
      password: '',
      company_id: userItem.company_id,
      status: userItem.status || 'active',
    });
    setIsEditDialogOpen(true);
  }, []);

  const handleUpdateUser = async () => {
    if (!editFormData.full_name || !editFormData.email) {
      toast({
        title: 'Erro',
        description: 'Nome e e-mail são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (editFormData.password && editFormData.password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter no mínimo 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);

    try {
      const { data, error } = await invokeOrionFunction('admin-update-user', {
        user_id: editFormData.id,
        email: editFormData.email.trim(),
        full_name: editFormData.full_name.trim(),
        department: editFormData.department || null,
        role: editFormData.role,
        password: editFormData.password || undefined,
        company_id: editFormData.company_id || undefined,
        status: editFormData.status,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao atualizar usuário');
      }

      if ((data as { error?: string })?.error) {
        throw new Error((data as { error?: string }).error);
      }

      toast({
        title: 'Sucesso',
        description: 'Dados atualizados com sucesso',
      });

      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

    } catch (error) {
      const err = error as Error;
      logError('handleUpdateUser', err);
      toast({
        title: 'Erro ao atualizar',
        description: err.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      'customer': 'Colaborador',
      'technician': 'Técnico',
      'admin': 'Gestor'
    };
    return labels[role as keyof typeof labels] || role;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-36 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3.5 border-b last:border-0">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-7 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-semibold text-foreground">
            Erro ao carregar usuários
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            {usersError instanceof Error ? usersError.message : 'Não foi possível carregar a lista de usuários.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchUsers()} className="gap-2 mt-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card de uso do plano */}
      <PlanUsageCard onLimitReached={setIsLimitReached} />
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gerenciar Usuários</CardTitle>
            <CardDescription>
              Defina as funções e permissões de cada usuário do sistema
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <DialogTrigger asChild>
                      <ButtonPrimary disabled={isLimitReached} icon={<Plus className="h-4 w-4" />}>
                        Adicionar Usuário
                      </ButtonPrimary>
                    </DialogTrigger>
                  </span>
                </TooltipTrigger>
                {isLimitReached && (
                  <TooltipContent>
                    <p>Limite de usuários atingido. Faça upgrade do plano.</p>
                  </TooltipContent>
                )}
              </Tooltip>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados para criar uma nova conta de usuário
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  placeholder="Nome do usuário"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">Departamento</Label>
                {departments && departments.length > 0 ? (
                  <Select
                    value={formData.department || "none"}
                    onValueChange={(value) => setFormData({ ...formData, department: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="department"
                    placeholder="Ex: TI, RH, Financeiro"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Função *</Label>
                <Select
                  value={formData.role || undefined}
                  onValueChange={(value: 'customer' | 'technician' | 'admin') => 
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Colaborador</SelectItem>
                    <SelectItem value="technician">Técnico</SelectItem>
                    <SelectItem value="admin">Gestor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Função</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((userItem) => (
              <UserRow
                key={userItem.id}
                userItem={userItem}
                onUpdateRole={handleUpdateUserRole}
                onEdit={handleOpenEditDialog}
                onDelete={handleDeleteUser}
                onMerge={handleOpenMergeDialog}
                isDeleting={deletingUserId === userItem.id}
                isCurrentUser={userItem.id === user?.id}
                isUpdating={isUpdating}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Modal de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário selecionado
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit_full_name">Nome Completo *</Label>
              <Input
                id="edit_full_name"
                placeholder="Nome do usuário"
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_email">E-mail (Apenas Leitura)</Label>
              <Input
                id="edit_email"
                type="email"
                placeholder="email@exemplo.com"
                value={editFormData.email}
                readOnly
                className="bg-muted cursor-not-allowed"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_department">Departamento</Label>
              {departments && departments.length > 0 ? (
                <Select
                  value={editFormData.department || "none"}
                  onValueChange={(value) => setEditFormData({ ...editFormData, department: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="edit_department"
                  placeholder="Ex: TI, RH, Financeiro"
                  value={editFormData.department}
                  onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_company">Empresa / Filial</Label>
              <Select
                value={editFormData.company_id || undefined}
                onValueChange={(value) => setEditFormData({ ...editFormData, company_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {allCompanies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editFormData.company_id !== users?.find(u => u.id === editFormData.id)?.company_id && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Atenção:</strong> Mudar a empresa alterará o acesso do usuário aos tickets e dados imediatamente.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_role">Função *</Label>
              <Select
                value={editFormData.role || undefined}
                onValueChange={(value: 'customer' | 'technician' | 'admin') => 
                  setEditFormData({ ...editFormData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Colaborador</SelectItem>
                  <SelectItem value="technician">Técnico</SelectItem>
                  <SelectItem value="admin">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_status">Status</Label>
              <Select
                value={editFormData.status || undefined}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_password">Nova Senha (Opcional)</Label>
              <Input
                id="edit_password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Preencha apenas se quiser alterar a senha do usuário
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Mesclagem — junta o usuário-fantasma criado pelo agente
          (machine-login) com um usuário real de login. */}
      <Dialog open={!!mergingSourceUser} onOpenChange={(open) => { if (!open) { setMergingSourceUser(null); setMergeTargetId(''); } }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-4 w-4" />
              Mesclar Usuário
            </DialogTitle>
            <DialogDescription>
              Os dados de <strong>{mergingSourceUser?.full_name || mergingSourceUser?.email}</strong> ({mergingSourceUser?.email}) serão movidos
              para o usuário escolhido abaixo, e esta conta será removida. Use quando o agente criou uma
              conta separada da conta de login do mesmo usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="merge_target">Mesclar em (usuário que permanece) *</Label>
              <Select value={mergeTargetId || undefined} onValueChange={setMergeTargetId}>
                <SelectTrigger id="merge_target">
                  <SelectValue placeholder="Selecione o usuário de destino" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    ?.filter((candidate) => candidate.id !== mergingSourceUser?.id)
                    .slice()
                    .sort((a, b) => Number(isGhostAccount(a.email)) - Number(isGhostAccount(b.email)))
                    .map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.full_name || 'Sem nome'} ({candidate.email})
                        {isGhostAccount(candidate.email) ? ' — conta do agente' : ' — login'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Prioridade: escolha sempre a conta com login (técnico, gestor ou cliente cadastrado) como destino —
                ela fica no topo da lista.
              </p>
            </div>
            {mergeTargetId && isGhostAccount(users?.find((u) => u.id === mergeTargetId)?.email || '') && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Atenção:</strong> o destino escolhido é uma conta criada pelo agente (sem login).
                  O usuário com login deveria ser sempre o destino.
                </AlertDescription>
              </Alert>
            )}
            {mergeTargetId && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Atenção:</strong> esta ação não pode ser desfeita. A conta de origem será excluída
                  depois que os dados forem movidos.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMergingSourceUser(null); setMergeTargetId(''); }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmMerge} disabled={!mergeTargetId || isMerging} variant="destructive">
              {isMerging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mesclar e Excluir Origem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Card>
    </div>
  );
};

interface UserRowProps {
  userItem: UserData;
  onUpdateRole: (userId: string, newRole: UserRole) => void;
  onEdit: (userItem: UserData) => void;
  onDelete: (userId: string) => void;
  onMerge: (userItem: UserData) => void;
  isDeleting: boolean;
  isCurrentUser: boolean;
  isUpdating: boolean;
}

const UserRow = React.memo(({
  userItem,
  onUpdateRole,
  onEdit,
  onDelete,
  onMerge,
  isDeleting,
  isCurrentUser,
  isUpdating,
}: UserRowProps) => {
  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50 transition-colors" 
      onClick={() => onEdit(userItem)}
    >
      <TableCell className="font-medium max-w-[150px]">
        <span className="truncate block">{userItem.full_name || 'Sem nome'}</span>
      </TableCell>
      <TableCell className="max-w-[200px]">
        <span className="truncate flex items-center gap-1.5">
          {userItem.email}
          {isGhostAccount(userItem.email) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  agente
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Conta criada automaticamente pelo agente, sem login próprio</p>
              </TooltipContent>
            </Tooltip>
          )}
        </span>
      </TableCell>
      <TableCell className="max-w-[150px]">
        <span className="truncate block">{userItem.company_name}</span>
      </TableCell>
      <TableCell className="max-w-[100px]">
        <span className="truncate block">{userItem.department || '-'}</span>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Select
          value={userItem.role || undefined}
          onValueChange={(value: 'customer' | 'technician' | 'admin') => onUpdateRole(userItem.id, value)}
          disabled={isCurrentUser || isUpdating}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Colaborador</SelectItem>
            <SelectItem value="technician">Técnico</SelectItem>
            <SelectItem value="admin">Gestor</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(userItem)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!isCurrentUser && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onMerge(userItem)}
                >
                  <Merge className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mesclar com outro usuário</p>
              </TooltipContent>
            </Tooltip>
          )}
          {!isCurrentUser && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Usuário?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O usuário <strong>{userItem.full_name}</strong> ({userItem.email}) perderá o acesso imediatamente. Tem certeza?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(userItem.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sim, Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
UserRow.displayName = 'UserRow';
