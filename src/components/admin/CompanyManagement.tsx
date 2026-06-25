import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2, Pencil, Building2, Zap } from 'lucide-react';
import { companyNameSchema } from '@/lib/validation';
import { mapDatabaseError, logError } from '@/lib/error-handling';
import { formatDate } from '@/lib/utils';
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

interface CompanyForm {
  name: string;
  cnpj: string;
  phone: string;
  address: string;
  domain: string;
}

const emptyForm: CompanyForm = { name: '', cnpj: '', phone: '', address: '', domain: '' };

export const CompanyManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CompanyForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const [tokenCompanyId, setTokenCompanyId] = useState<string | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: companyTokens, refetch: refetchTokens } = useQuery({
    queryKey: ['company-tokens', tokenCompanyId],
    queryFn: async () => {
      if (!tokenCompanyId) return [];
      const { data, error } = await supabase
        .from('api_keys' as any)
        .select('*')
        .eq('company_id', tokenCompanyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tokenCompanyId
  });

  const generateTokenMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = 'orion_';
      for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Não autenticado');

      const { error } = await supabase.from('api_keys' as any).insert({
        company_id: companyId,
        user_id: userData.user.id,
        key_value: result,
        label: `Gerada manualmente em ${formatDate(new Date())}`
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTokens();
      toast({ title: 'Sucesso', description: 'Token gerado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    }
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('api_keys' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTokens();
      toast({ title: 'Sucesso', description: 'Token removido.' });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CompanyForm & { id?: string }) => {
      const validationResult = companyNameSchema.safeParse(data.name);
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      const payload = {
        name: validationResult.data,
        cnpj: data.cnpj.trim() || null,
        phone: data.phone.trim() || null,
        address: data.address.trim() || null,
        domain: (data as any).domain?.trim().toLowerCase() || null,
      };

      if (data.id) {
        const { error } = await supabase.from('companies').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('companies').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowDialog(false);
      setFormData(emptyForm);
      setEditingId(null);
      toast({ title: 'Sucesso', description: editingId ? 'Empresa atualizada.' : 'Empresa criada.' });
    },
    onError: (error) => {
      logError('saveMutation', error);
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    }
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteCompanyId(null);
      toast({ title: 'Sucesso', description: 'Empresa removida.' });
    },
    onError: (error) => {
      logError('deleteCompanyMutation', error);
      toast({ title: 'Erro', description: mapDatabaseError(error), variant: 'destructive' });
    }
  });

  const openCreate = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowDialog(true);
  };

  const openEdit = (company: any) => {
    setFormData({
      name: company.name || '',
      cnpj: company.cnpj || '',
      phone: company.phone || '',
      address: company.address || '',
      domain: company.domain || '',
    });
    setEditingId(company.id);
    setShowDialog(true);
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Empresas</CardTitle>
              <CardDescription>Adicione e gerencie as empresas que utilizam o sistema</CardDescription>
            </div>
            <ButtonPrimary onClick={openCreate} className="gap-2 font-bold" icon={<Plus className="h-4 w-4" />}>
              Nova Empresa
            </ButtonPrimary>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Domínio</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies?.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium max-w-[200px]">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-primary font-mono text-xs">
                    {(company as any).domain ? `@${(company as any).domain}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {company.cnpj || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                    {company.phone || '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                    {formatDate(company.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setTokenCompanyId(company.id)}
                        className="gap-2 text-[10px] uppercase font-black"
                      >
                        <Zap className="h-3 w-3" /> Tokens
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(company)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteCompanyId(company.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!companies || companies.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa cadastrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Tokens */}
      <Dialog open={!!tokenCompanyId} onOpenChange={() => setTokenCompanyId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Tokens de Monitoramento</DialogTitle>
            <DialogDescription>
              Gerencie chaves de API para instalação do Orion Agent nesta empresa.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <ButtonPrimary 
              onClick={() => tokenCompanyId && generateTokenMutation.mutate(tokenCompanyId)}
              className="w-full gap-2 font-bold"
              disabled={generateTokenMutation.isPending}
              icon={<Plus className="h-4 w-4" />}
            >
              Gerar Novo Token
            </ButtonPrimary>

            <div className="rounded-xl border border-border/40 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30 text-[10px] uppercase font-black">
                  <TableRow>
                    <TableHead>Token / Label</TableHead>
                    <TableHead>Último Uso</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyTokens?.map((tk: any) => (
                    <TableRow key={tk.id} className="text-xs">
                      <TableCell>
                        <div className="space-y-1">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-emerald-600 font-bold">{tk.key_value}</code>
                          <p className="text-[10px] text-muted-foreground">{tk.label}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tk.last_used_at ? formatDate(tk.last_used_at) : 'Nunca usado'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => deleteTokenMutation.mutate(tk.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!companyTokens || companyTokens.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground italic">
                        Nenhum token ativo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de criação/edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Atualize os dados da empresa.' : 'Preencha os dados para cadastrar uma nova empresa.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Contoso Ltda"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Domínio de Rede (DNS)</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData(p => ({ ...p, domain: e.target.value }))}
                  placeholder="Ex: contoso.com"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData(p => ({ ...p, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                placeholder="Rua, Número, Cidade - UF"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate({ ...formData, id: editingId || undefined })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? 'Salvar Alterações' : 'Cadastrar Empresa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteCompanyId} onOpenChange={() => setDeleteCompanyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta empresa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCompanyId && deleteCompanyMutation.mutate(deleteCompanyId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
