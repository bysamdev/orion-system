import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Edit2, Trash2, ArrowRightLeft, GitBranch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export const RoutingRulesManagement = () => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priorityOrder, setPriorityOrder] = useState(1);
  const [conditionField, setConditionField] = useState('category');
  const [conditionOperator, setConditionOperator] = useState('equals');
  const [conditionValue, setConditionValue] = useState('');
  const [actionType, setActionType] = useState('assign_to_user');
  const [actionTarget, setActionTarget] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { data: rules = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['routing-rules', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('routing_rules')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('priority', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const saveMutation = useMutation({
    mutationFn: async (ruleData: any) => {
      const payload = {
        company_id: profile?.company_id,
        name: ruleData.name,
        description: ruleData.description,
        priority: ruleData.priorityOrder,
        conditions: { field: ruleData.conditionField, operator: ruleData.conditionOperator, value: ruleData.conditionValue },
        actions: { type: ruleData.actionType, target: ruleData.actionTarget },
        is_active: ruleData.isActive
      };

      if (ruleData.id) {
        const { error } = await supabase.from('routing_rules').update(payload).eq('id', ruleData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('routing_rules').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules'] });
      toast({ title: 'Sucesso', description: 'Regra salva com sucesso.' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro', description: 'Não foi possível salvar a regra.', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routing_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules'] });
      toast({ title: 'Sucesso', description: 'Regra removida com sucesso.' });
    }
  });

  const resetForm = () => {
    setEditingRule(null);
    setName('');
    setDescription('');
    setPriorityOrder(1);
    setConditionField('category');
    setConditionOperator('equals');
    setConditionValue('');
    setActionType('assign_to_user');
    setActionTarget('');
    setIsActive(true);
  };

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description || '');
    setPriorityOrder(rule.priority);
    setConditionField(rule.conditions?.field || 'category');
    setConditionOperator(rule.conditions?.operator || 'equals');
    setConditionValue(rule.conditions?.value || '');
    setActionType(rule.actions?.type || 'assign_to_user');
    setActionTarget(rule.actions?.target || '');
    setIsActive(rule.is_active);
    setIsDialogOpen(true);
  };

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_roles!inner(role)')
        .eq('company_id', profile.company_id)
        .in('user_roles.role', ['technician', 'admin', 'developer']);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name');
      if (error) throw error;
      return data || [];
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !conditionValue.trim() || (actionType !== 'notify_all' && !actionTarget.trim())) {
      toast({ title: 'Atenção', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ 
      id: editingRule?.id, 
      name, description, priorityOrder, 
      conditionField, conditionOperator, conditionValue, 
      actionType, actionTarget, isActive 
    });
  };

  return (
    <Card className="border-border/40 shadow-xl shadow-primary/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Regras de Roteamento
          </CardTitle>
          <CardDescription>Automatize a atribuição e fluxo de tickets baseados em condições condicionais (SE... ENTÃO).</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <ButtonPrimary onClick={() => setEditingRule(null)} className="font-bold" icon={<Plus className="w-4 h-4" />}>
              Nova Regra
            </ButtonPrimary>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra de Roteamento'}</DialogTitle>
              <DialogDescription>Configure as condições e as ações decorrentes.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-2">
                    <Label>Nome da Regra</Label>
                    <Input placeholder="Ex: Roteamento de Hardware" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label>Ordem</Label>
                    <Input type="number" min="1" value={priorityOrder} onChange={(e) => setPriorityOrder(parseInt(e.target.value))} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input placeholder="Explique o que esta regra faz..." value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <div className="p-4 bg-muted/20 border-l-4 border-l-primary/50 rounded-r-xl space-y-4">
                <h4 className="font-bold text-sm text-foreground uppercase tracking-widest">Condição (SE)</h4>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={conditionField} onValueChange={setConditionField}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Categoria</SelectItem>
                      <SelectItem value="priority">Prioridade</SelectItem>
                      <SelectItem value="company_id">Cliente (Empresa)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={conditionOperator} onValueChange={setConditionOperator}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">For Igual a</SelectItem>
                      <SelectItem value="contains">Contiver</SelectItem>
                    </SelectContent>
                  </Select>
                  {conditionField === 'company_id' ? (
                    <Select value={conditionValue} onValueChange={setConditionValue}>
                      <SelectTrigger><SelectValue placeholder="Selecione empresa..." /></SelectTrigger>
                      <SelectContent>
                        {companies.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : conditionField === 'priority' ? (
                    <Select value={conditionValue} onValueChange={setConditionValue}>
                      <SelectTrigger><SelectValue placeholder="Selecione prioridade..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input placeholder="Valor..." value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} required />
                  )}
                </div>
              </div>

              <div className="p-4 bg-muted/20 border-l-4 border-l-indigo-500/50 rounded-r-xl space-y-4">
                <h4 className="font-bold text-sm text-foreground uppercase tracking-widest">Ação (ENTÃO)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assign_to_user">Atribuir a Agente</SelectItem>
                      <SelectItem value="round_robin">Round-Robin (Equipe)</SelectItem>
                      <SelectItem value="notify_all">Notificar Todos os Técnicos</SelectItem>
                      <SelectItem value="escalate_manager">Escalar para Gestor</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {actionType === 'assign_to_user' ? (
                    <Select value={actionTarget} onValueChange={setActionTarget}>
                      <SelectTrigger><SelectValue placeholder="Selecione técnico..." /></SelectTrigger>
                      <SelectContent>
                        {technicians.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : actionType === 'notify_all' ? (
                    <div className="flex items-center text-xs font-bold text-muted-foreground bg-background px-3 rounded-lg border border-border/40">
                      Toda a equipe será alertada
                    </div>
                  ) : (
                    <Input placeholder="Alvo da ação..." value={actionTarget} onChange={(e) => setActionTarget(e.target.value)} />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background">
                <Label htmlFor="active-rule" className="font-bold cursor-pointer">Regra Ativa</Label>
                <Switch id="active-rule" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Regra
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="w-[50px] text-center font-bold uppercase text-[10px] tracking-widest">#</TableHead>
              <TableHead className="w-[200px] text-left font-bold uppercase text-[10px] tracking-widest">Nome da Regra</TableHead>
              <TableHead className="text-left font-bold uppercase text-[10px] tracking-widest">Condição</TableHead>
              <TableHead className="text-left font-bold uppercase text-[10px] tracking-widest">Ação</TableHead>
              <TableHead className="w-[100px] text-center font-bold uppercase text-[10px] tracking-widest">Status</TableHead>
              <TableHead className="w-[100px] text-right pr-6 font-bold uppercase text-[10px] tracking-widest">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && profile?.company_id ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Carregando regras de roteamento...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-destructive">
                    <div className="text-sm font-bold">Erro ao carregar regras</div>
                    <div className="text-xs opacity-80">{error instanceof Error ? error.message : 'Erro desconhecido'}</div>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2 text-foreground">Tentar novamente</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : !profile?.company_id ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <span className="font-medium">Empresa não identificada</span>
                    <span className="text-xs">Verifique suas permissões de acesso.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <GitBranch className="w-8 h-8 opacity-20" />
                    <span className="font-medium">Nenhuma regra de roteamento configurada</span>
                    <span className="text-xs">Crie regras para rotear chamados automaticamente.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule: any) => (
                <TableRow key={rule.id}>
                  <TableCell className="text-center font-bold text-muted-foreground">{rule.priority}</TableCell>
                  <TableCell className="font-bold">{rule.name}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-md font-medium border border-border/50">
                      [{rule.conditions?.field}] {rule.conditions?.operator} "{rule.conditions?.value}"
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                       <span className="text-xs font-bold text-primary truncate max-w-[150px]">
                         {rule.actions?.type === 'assign_to_user' ? 'Atribuir a: ' : ''}{rule.actions?.target}
                       </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {rule.is_active ? 
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">ATIVA</span> : 
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">INATIVA</span>
                    }
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)} className="h-8 w-8 hover:text-primary"><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if(window.confirm('Excluir esta regra?')) deleteMutation.mutate(rule.id) }} className="h-8 w-8 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
