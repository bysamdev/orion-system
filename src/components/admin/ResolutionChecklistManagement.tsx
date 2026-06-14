import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Edit2, Trash2, ListChecks, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export const ResolutionChecklistManagement = () => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<any>(null);
  
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [isActive, setIsActive] = useState(true);

  const { data: checklists = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['resolution-checklists', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from('resolution_checklists')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('category');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const saveMutation = useMutation({
    mutationFn: async (checklistData: any) => {
      const payload = {
        company_id: profile?.company_id,
        category: checklistData.category,
        items: checklistData.items.filter((i: string) => i.trim() !== ''),
        is_active: checklistData.isActive
      };

      if (checklistData.id) {
        const { error } = await supabase.from('resolution_checklists').update(payload).eq('id', checklistData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('resolution_checklists').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resolution-checklists'] });
      toast({ title: 'Sucesso', description: 'Checklist salvo com sucesso.' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('resolution_checklists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resolution-checklists'] });
      toast({ title: 'Sucesso', description: 'Checklist removido com sucesso.' });
    }
  });

  const resetForm = () => {
    setEditingChecklist(null);
    setCategory('');
    setItems(['']);
    setIsActive(true);
  };

  const handleEdit = (checklist: any) => {
    setEditingChecklist(checklist);
    setCategory(checklist.category);
    setItems(checklist.items.length ? checklist.items : ['']);
    setIsActive(checklist.is_active);
    setIsDialogOpen(true);
  };

  const addItem = () => setItems([...items, '']);
  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
  };
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() || items.filter(i => i.trim() !== '').length === 0) {
      toast({ title: 'Atenção', description: 'Categoria e pelo menos um item são obrigatórios.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ id: editingChecklist?.id, category, items, isActive });
  };

  return (
    <Card className="border-border/40 shadow-xl shadow-primary/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" />
            Checklists de Resolução
          </CardTitle>
          <CardDescription>Configure verificações obrigatórias ao resolver tickets por categoria.</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-bold"><Plus className="w-4 h-4" /> Novo Checklist</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingChecklist ? 'Editar Checklist' : 'Novo Checklist'}</DialogTitle>
              <DialogDescription>Define os passos obrigatórios para encerrar tickets desta categoria.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Categoria do Chamado</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sistema">Sistemas Corporativos</SelectItem>
                    <SelectItem value="Hardware">Hardware / Equipamentos</SelectItem>
                    <SelectItem value="Acesso">Acessos e Contas</SelectItem>
                    <SelectItem value="Dúvida">Dúvidas Técnicas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Itens de Verificação</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addItem} className="h-8 text-xs font-bold text-primary">
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input 
                        placeholder={`Executar validação ${index + 1}...`} 
                        value={item} 
                        onChange={(e) => updateItem(index, e.target.value)}
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeItem(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-muted/20">
                <Label htmlFor="active-status" className="font-bold cursor-pointer">Checklist Ativo</Label>
                <Switch id="active-status" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Checklist
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
              <TableHead className="w-[200px] pl-6 font-bold uppercase text-[10px] tracking-widest">Categoria</TableHead>
              <TableHead className="font-bold uppercase text-[10px] tracking-widest">Itens Obligatórios</TableHead>
              <TableHead className="w-[100px] text-center font-bold uppercase text-[10px] tracking-widest">Status</TableHead>
              <TableHead className="w-[100px] text-right pr-6 font-bold uppercase text-[10px] tracking-widest">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && profile?.company_id ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Carregando checklists...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-destructive">
                    <div className="text-sm font-bold">Erro ao carregar checklists</div>
                    <div className="text-xs opacity-80">{error instanceof Error ? error.message : 'Erro desconhecido'}</div>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2 text-foreground">Tentar novamente</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : !profile?.company_id ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <span className="font-medium">Empresa não identificada</span>
                    <span className="text-xs">Verifique suas permissões de acesso.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : checklists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <ListChecks className="w-8 h-8 opacity-20" />
                    <span className="font-medium">Nenhum checklist configurado</span>
                    <span className="text-xs">Adicione checklists para orientar os técnicos na resolução de chamados.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              checklists.map((checklist: any) => (
                <TableRow key={checklist.id}>
                  <TableCell className="pl-6 font-bold">{checklist.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {checklist.items.length} itens: {checklist.items[0]}...
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {checklist.is_active ? 
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">ATIVO</span> : 
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">INATIVO</span>
                    }
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(checklist)} className="h-8 w-8 hover:text-primary"><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if(window.confirm('Excluir este checklist?')) deleteMutation.mutate(checklist.id) }} className="h-8 w-8 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
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
