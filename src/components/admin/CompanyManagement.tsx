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
import { Plus, Loader2, Trash2, Pencil, Building2, Zap, CheckCircle2, Timer } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { companyNameSchema } from '@/lib/validation';
import { mapDatabaseError, logError } from '@/lib/error-handling';
import { sincronizarEmpresaComGrafana, removerEmpresaDoGrafana } from '@/hooks/useGrafanaSync';
import { formatDate, cn } from '@/lib/utils';
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
  has_contract: boolean;
}

const emptyForm: CompanyForm = { name: '', cnpj: '', phone: '', address: '', domain: '', has_contract: true };

export const CompanyManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CompanyForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const [tokenCompanyId, setTokenCompanyId] = useState<string | null>(null);

  const { data: companies, isLoading, refetch } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('companies') as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        cnpj: string | null;
        phone: string | null;
        address: string | null;
        domain?: string | null;
        has_contract?: boolean | null;
        created_at: string;
        updated_at?: string;
        current_plan_id?: string | null;
        logo_url?: string | null;
        settings?: any;
      }>;
    }
  });

  const { data: companyTokens, refetch: refetchTokens } = useQuery({
    queryKey: ['company-tokens', tokenCompanyId],
    queryFn: async () => {
      if (!tokenCompanyId) return [];
      const { data, error } = await (supabase
        .from('api_keys' as unknown as 'companies')
        .select('*') as unknown as ReturnType<typeof supabase.from>)
        .eq('company_id', tokenCompanyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Array<{ id: string; key_value: string; label: string; last_used_at: string | null }>;
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

      const { error } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)('api_keys').insert({
        company_id: companyId,
        user_id: userData.user.id,
        key_value: result,
        label: `Gerada manualmente em ${formatDate(new Date())}`
      });
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
      const { error } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)('api_keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchTokens();
      toast({ title: 'Sucesso', description: 'Token removido.' });
    }
  });

  const toggleContractMutation = useMutation({
    mutationFn: async ({ id, has_contract }: { id: string; has_contract: boolean }) => {
      const { error } = await (supabase.from('companies') as any).update({ has_contract }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company-options'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-company-data'] });
      queryClient.invalidateQueries({ queryKey: ['ticket'] });
      toast({
        title: 'Modalidade atualizada',
        description: variables.has_contract ? 'Empresa definida como "Com Contrato".' : 'Empresa definida como "Esporádico (Sem Contrato)".',
      });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: mapDatabaseError(error), variant: 'destructive' });
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
        domain: data.domain.trim() || null,
        has_contract: data.has_contract ?? true,
      };

      if (data.id) {
        const { error } = await (supabase.from('companies') as any).update(payload).eq('id', data.id);
        if (error) throw error;
        return { id: data.id };
      } else {
        const { data: inserted, error } = await (supabase.from('companies') as any).insert(payload).select('id').single();
        if (error) throw error;
        return { id: inserted.id as string };
      }
    },
    onSuccess: ({ id }, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company-options'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-company-data'] });
      queryClient.invalidateQueries({ queryKey: ['ticket'] });
      setShowDialog(false);
      setFormData(emptyForm);
      setEditingId(null);
      toast({ title: 'Sucesso', description: editingId ? 'Empresa atualizada.' : 'Empresa criada.' });

      // Espelha a empresa no Grafana (pasta + dashboard) — best-effort: o
      // Grafana é só um espelho de navegação, uma falha aqui não deve
      // incomodar quem só quer cadastrar a empresa. Ver useGrafanaSync.ts.
      sincronizarEmpresaComGrafana(id, variables.name.trim()).catch((err) => {
        logError('sincronizarEmpresaComGrafana', err);
        toast({
          title: 'Empresa salva, mas o Grafana não sincronizou',
          description: err instanceof Error ? err.message : 'Tente novamente mais tarde.',
          variant: 'destructive',
        });
      });
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
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteCompanyId(null);
      toast({ title: 'Sucesso', description: 'Empresa removida.' });

      removerEmpresaDoGrafana(id).catch((err) => {
        logError('removerEmpresaDoGrafana', err);
        toast({
          title: 'Empresa removida, mas a pasta no Grafana continua lá',
          description: err instanceof Error ? err.message : 'Remova manualmente se necessário.',
          variant: 'destructive',
        });
      });
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

  const openEdit = (company: { id: string; name: string | null; cnpj: string | null; phone: string | null; address: string | null; domain?: string | null; has_contract?: boolean | null }) => {
    setFormData({
      name: company.name || '',
      cnpj: company.cnpj || '',
      phone: company.phone || '',
      address: company.address || '',
      domain: company.domain || '',
      has_contract: company.has_contract !== false,
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
              <CardDescription>Adicione e gerencie os clientes e empresas que utilizam o sistema</CardDescription>
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
                <TableHead>Nome da Empresa / Cliente</TableHead>
                <TableHead>Modalidade / Contrato</TableHead>
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
                      <span className="truncate font-bold">{company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleContractMutation.mutate({ id: company.id, has_contract: !(company.has_contract !== false) })}
                      disabled={toggleContractMutation.isPending}
                      className="cursor-pointer group flex items-center gap-1.5 transition-transform active:scale-95"
                      title="Clique para alternar entre Com Contrato e Esporádico"
                    >
                      {company.has_contract !== false ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Com Contrato
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                          <Timer className="w-3.5 h-3.5" /> Esporádico (Sem Contrato)
                        </span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-primary font-mono text-xs">
                    {company.domain || '—'}
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                  {(companyTokens as Array<{ id: string; key_value: string; label: string; last_used_at: string | null }> | undefined)?.map((tk) => (
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

            {/* Modalidade / Contrato do Cliente */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="has_contract" className="text-sm font-bold text-foreground">Modalidade do Cliente</Label>
                <p className="text-xs text-muted-foreground">
                  {formData.has_contract
                    ? 'Com Contrato: O chamado contabiliza o tempo automaticamente e oculta o cronógrafo.'
                    : 'Esporádico (Sem Contrato): Libera menu de apontamento manual de horas faturáveis.'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  id="has_contract"
                  checked={formData.has_contract}
                  onCheckedChange={(checked) => setFormData(p => ({ ...p, has_contract: checked }))}
                />
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-md",
                  formData.has_contract ? "text-emerald-600 bg-emerald-500/10" : "text-amber-600 bg-amber-500/10"
                )}>
                  {formData.has_contract ? 'Com Contrato' : 'Esporádico'}
                </span>
              </div>
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
