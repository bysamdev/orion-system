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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { agruparUsuariosPorEmpresa, filtrarUsuarios, FILTRO_DE_USUARIOS_VAZIO, type FiltroDeUsuarios } from '@/lib/usuariosPorEmpresa';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2, Pencil, AlertTriangle, Merge, RefreshCw, Users, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { useToast } from '@/hooks/use-toast';
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
  // Vazio = a própria empresa de quem está criando. Só equipe com escopo
  // global consegue gravar em outra: create-user-credentials recusa com 403
  // quem tentar (ver a checagem SEC-02 na edge function).
  company_id: string;
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
    company_id: '',
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

  // Agrupamento por empresa: a lista é multiempresa e, plana, não dá para
  // saber de quem é cada usuário sem ler a coluna "Empresa" linha a linha.
  // Mesma leitura visual de "Sistemas e Alertas" em modo lista (ver
  // GroupSectionHeader em src/pages/Monitoring.tsx). A regra de ordenação e
  // contagem mora em src/lib/usuariosPorEmpresa.ts, com teste.
  const [filtro, setFiltro] = useState<FiltroDeUsuarios>(FILTRO_DE_USUARIOS_VAZIO);
  const usuariosFiltrados = useMemo(() => filtrarUsuarios(users, filtro), [users, filtro]);
  const usuariosPorEmpresa = useMemo(() => agruparUsuariosPorEmpresa(usuariosFiltrados), [usuariosFiltrados]);
  const temFiltro = filtro.busca.trim() !== '' || filtro.papel !== 'all' || filtro.empresaId !== 'all';
  const empresasDaLista = useMemo(() => {
    const vistas = new Map<string, string>();
    (users ?? []).forEach(u => { if (u.company_id) vistas.set(u.company_id, u.company_name); });
    return [...vistas.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [users]);

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
        company_id: formData.company_id || currentUserProfile.company_id,
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
        company_id: '',
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
              <div className="grid gap-2">
                <Label htmlFor="company">Empresa *</Label>
                <Select
                  value={formData.company_id || currentUserProfile?.company_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                >
                  <SelectTrigger id="company">
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
                <p className="text-xs text-muted-foreground">
                  É a empresa que define quais chamados esse usuário enxerga. Criar em outra
                  empresa exige escopo global.
                </p>
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
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              autoComplete="off"
              placeholder="Buscar por nome, e-mail ou departamento"
              value={filtro.busca}
              onChange={e => setFiltro(f => ({ ...f, busca: e.target.value }))}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filtro.papel} onValueChange={v => setFiltro(f => ({ ...f, papel: v }))}>
            <SelectTrigger className="h-9 md:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as funções</SelectItem>
              <SelectItem value="customer">Colaborador</SelectItem>
              <SelectItem value="technician">Técnico</SelectItem>
              <SelectItem value="admin">Gestor</SelectItem>
              <SelectItem value="developer">Desenvolvedor</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtro.empresaId} onValueChange={v => setFiltro(f => ({ ...f, empresaId: v }))}>
            <SelectTrigger className="h-9 md:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresasDaLista.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {temFiltro && (
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => setFiltro(FILTRO_DE_USUARIOS_VAZIO)}>
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
          <span className="md:ml-auto self-center text-xs text-muted-foreground tabular-nums">
            {usuariosFiltrados.length} de {users?.length ?? 0} usuários
          </span>
        </div>
        <div className="w-full overflow-x-auto">
        <Table className="min-w-[700px]">
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
            {usuariosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <TableEmptyState
                    icon={Users}
                    title={temFiltro ? 'Nenhum usuário com esses filtros' : 'Nenhum usuário cadastrado'}
                    description={temFiltro ? 'Mude a busca ou limpe os filtros.' : 'Adicione o primeiro usuário para começar a gerenciar acessos.'}
                  />
                </TableCell>
              </TableRow>
            ) : (
              usuariosPorEmpresa.map((grupo) => (
                <React.Fragment key={grupo.empresa}>
                  <CompanySectionRow
                    empresa={grupo.empresa}
                    total={grupo.usuarios.length}
                    equipe={grupo.equipe}
                  />
                  {grupo.usuarios.map((userItem) => (
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
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
        </div>
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

// Cabeçalho de seção de empresa dentro da tabela de usuários. Reaproveita a
// leitura visual de "Sistemas e Alertas" em modo lista (GroupSectionHeader em
// src/pages/Monitoring.tsx): barra vertical na cor primária, nome da empresa,
// contagem num badge e a linha horizontal fechando a faixa.
//
// É uma TableRow de célula única (colSpan) em vez de um <div> solto porque
// precisa viver dentro do <TableBody> — um elemento fora de tr/td ali é HTML
// inválido e o navegador o reposiciona para fora da tabela.
function CompanySectionRow({ empresa, total, equipe }: { empresa: string; total: number; equipe: number }) {
  return (
    <TableRow className="hover:bg-transparent border-none">
      <TableCell colSpan={6} className="py-3 px-2">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 rounded-full bg-primary flex-shrink-0" />
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h3 className="text-base font-bold text-foreground tracking-tight truncate">{empresa}</h3>
            <Badge variant="outline" className="text-[11px] font-semibold ml-1 gap-1.5 border-border/60 bg-muted/30">
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', equipe > 0 ? 'bg-primary' : 'bg-muted-foreground')} />
              <span>
                {total} {total === 1 ? 'usuário' : 'usuários'}
                {equipe > 0 && ` · ${equipe} da equipe`}
              </span>
            </Badge>
          </div>
          <div className="flex-1 border-t border-border/40 ml-2" />
        </div>
      </TableCell>
    </TableRow>
  );
}

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
        {/* Desenvolvedor dá acesso total e não é atribuível por aqui: aparece
            como selo fixo em vez de um seletor em branco. */}
        {userItem.role === 'developer' ? (
          <span className="inline-flex h-9 w-[140px] items-center rounded-md border border-border/60 bg-muted/40 px-3 text-sm text-muted-foreground">
            Desenvolvedor
          </span>
        ) : (
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
        )}
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
