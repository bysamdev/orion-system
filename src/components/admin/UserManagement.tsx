import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react';
import type { UserRole } from '@/hooks/useUserRole';
import { userRoleSchema } from '@/lib/validation';
import { mapDatabaseError, logError } from '@/lib/error-handling';
import { useAuth } from '@/contexts/AuthContext';

interface NewUserForm {
  full_name: string;
  email: string;
  password: string;
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
}

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  department: string | null;
  company_id: string;
  role: string;
  company_name: string;
}

export const UserManagement = () => {
  const { toast } = useToast();
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewUserForm>({
    full_name: '',
    email: '',
    password: '',
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
  });

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

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError} = await supabase
        .from('profiles')
        .select('id, full_name, email, department, company_id')
        .order('full_name');

      if (profilesError) throw profilesError;

      const companyIds = [...new Set(profiles.map(p => p.company_id))];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      
      const companyMap = new Map(companies?.map(c => [c.id, c.name]) || []);

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      return profiles.map(profile => ({
        ...profile,
        role: roles.find(r => r.user_id === profile.id)?.role || 'customer',
        company_name: companyMap.get(profile.company_id) || 'Sem empresa'
      })) as UserData[];
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: 'Sucesso',
        description: 'Função do usuário atualizada com sucesso',
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
      const { data, error } = await supabase.functions.invoke('delete-user-admin', {
        body: { user_id: userId },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao excluir usuário');
      }

      if (data?.error) {
        throw new Error(data.error);
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
    onError: (error: any) => {
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

  const handleDeleteUser = (userId: string) => {
    setDeletingUserId(userId);
    deleteUserMutation.mutate(userId);
  };

  const handleCreateUser = async () => {
    if (!formData.full_name || !formData.email || !formData.password) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter no mínimo 6 caracteres',
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
      const { data, error } = await supabase.functions.invoke('create-new-user', {
        body: {
          email: formData.email.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          department: formData.department || null,
          role: formData.role,
          company_id: currentUserProfile.company_id,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar usuário');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Sucesso',
        description: 'Usuário criado com sucesso',
      });

      setFormData({
        full_name: '',
        email: '',
        password: '',
        department: '',
        role: 'customer',
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

    } catch (error: any) {
      logError('handleCreateUser', error);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditDialog = (userItem: UserData) => {
    setEditFormData({
      id: userItem.id,
      full_name: userItem.full_name || '',
      email: userItem.email,
      department: userItem.department || '',
      role: userItem.role as 'customer' | 'technician' | 'admin',
      password: '',
    });
    setIsEditDialogOpen(true);
  };

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
      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: {
          user_id: editFormData.id,
          email: editFormData.email.trim(),
          full_name: editFormData.full_name.trim(),
          department: editFormData.department || null,
          role: editFormData.role,
          password: editFormData.password || undefined,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao atualizar usuário');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Sucesso',
        description: 'Dados atualizados com sucesso',
      });

      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });

    } catch (error: any) {
      logError('handleUpdateUser', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message || 'Tente novamente',
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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gerenciar Usuários</CardTitle>
          <CardDescription>
            Defina as funções e permissões de cada usuário do sistema
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          </DialogTrigger>
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
                <Label htmlFor="password">Senha Provisória *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">Departamento</Label>
                {departments && departments.length > 0 ? (
                  <Select
                    value={formData.department}
                    onValueChange={(value) => setFormData({ ...formData, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
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
                  value={formData.role}
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
              <TableRow key={userItem.id}>
                <TableCell className="font-medium">{userItem.full_name || 'Sem nome'}</TableCell>
                <TableCell>{userItem.email}</TableCell>
                <TableCell>{userItem.company_name}</TableCell>
                <TableCell>{userItem.department || '-'}</TableCell>
                <TableCell>
                  <Select
                    value={userItem.role}
                    onValueChange={(value) => 
                      updateRoleMutation.mutate({ 
                        userId: userItem.id, 
                        newRole: value as UserRole 
                      })
                    }
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
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEditDialog(userItem)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {userItem.id !== user?.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingUserId === userItem.id}
                          >
                            {deletingUserId === userItem.id ? (
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
                              onClick={() => handleDeleteUser(userItem.id)}
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
              <Label htmlFor="edit_email">E-mail *</Label>
              <Input
                id="edit_email"
                type="email"
                placeholder="email@exemplo.com"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_department">Departamento</Label>
              {departments && departments.length > 0 ? (
                <Select
                  value={editFormData.department}
                  onValueChange={(value) => setEditFormData({ ...editFormData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
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
              <Label htmlFor="edit_role">Função *</Label>
              <Select
                value={editFormData.role}
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
    </Card>
  );
};
