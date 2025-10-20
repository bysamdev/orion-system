import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/AuthContext';

export const DepartmentManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<string | null>(null);

  const { data: adminProfile } = useQuery({
    queryKey: ['admin-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: departments, isLoading } = useQuery({
    queryKey: ['company-departments', adminProfile?.company_id],
    queryFn: async () => {
      if (!adminProfile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', adminProfile.company_id)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!adminProfile?.company_id,
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!adminProfile?.company_id) throw new Error('Company ID not found');
      
      const { error } = await supabase
        .from('departments')
        .insert({ 
          name,
          company_id: adminProfile.company_id 
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-departments'] });
      setNewDepartmentName('');
      toast({
        title: 'Sucesso',
        description: 'Setor criado com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message?.includes('unique') 
          ? 'Já existe um setor com este nome'
          : 'Não foi possível criar o setor',
        variant: 'destructive',
      });
    }
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-departments'] });
      setDeleteDepartmentId(null);
      toast({
        title: 'Sucesso',
        description: 'Setor removido com sucesso',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o setor',
        variant: 'destructive',
      });
    }
  });

  const handleCreateDepartment = () => {
    if (!newDepartmentName.trim()) {
      toast({
        title: 'Erro',
        description: 'Digite um nome para o setor',
        variant: 'destructive',
      });
      return;
    }
    createDepartmentMutation.mutate(newDepartmentName);
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
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Setores</CardTitle>
          <CardDescription>
            Adicione e gerencie os setores da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Input
              placeholder="Nome do setor"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDepartment()}
            />
            <Button 
              onClick={handleCreateDepartment}
              disabled={createDepartmentMutation.isPending}
            >
              {createDepartmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </>
              )}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Setor</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments?.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell>
                    {new Date(department.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDepartmentId(department.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteDepartmentId} onOpenChange={() => setDeleteDepartmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este setor? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDepartmentId && deleteDepartmentMutation.mutate(deleteDepartmentId)}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
