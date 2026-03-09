import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Trash2, Pencil, FileText } from 'lucide-react';
import { useContracts, useCreateContract, useUpdateContract, useDeleteContract } from '@/hooks/useContracts';

interface ContractForm {
  company_id: string;
  name: string;
  start_date: string;
  end_date: string;
  monthly_hours: string;
  notes: string;
  is_active: boolean;
}

const emptyForm: ContractForm = {
  company_id: '',
  name: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  monthly_hours: '',
  notes: '',
  is_active: true,
};

export const ContractManagement = () => {
  const [formData, setFormData] = useState<ContractForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: contracts, isLoading } = useContracts();
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();

  // Buscar empresas para o select
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const openCreate = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowDialog(true);
  };

  const openEdit = (contract: any) => {
    setFormData({
      company_id: contract.company_id,
      name: contract.name,
      start_date: contract.start_date,
      end_date: contract.end_date || '',
      monthly_hours: contract.monthly_hours?.toString() || '',
      notes: contract.notes || '',
      is_active: contract.is_active,
    });
    setEditingId(contract.id);
    setShowDialog(true);
  };

  const handleSave = () => {
    const payload = {
      company_id: formData.company_id,
      name: formData.name.trim(),
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      monthly_hours: formData.monthly_hours ? parseFloat(formData.monthly_hours) : null,
      notes: formData.notes.trim() || null,
      is_active: formData.is_active,
    };

    if (!payload.name || !payload.company_id || !payload.start_date) return;

    if (editingId) {
      updateContract.mutate({ id: editingId, ...payload }, {
        onSuccess: () => { setShowDialog(false); setEditingId(null); }
      });
    } else {
      createContract.mutate(payload, {
        onSuccess: () => { setShowDialog(false); }
      });
    }
  };

  // Mapa de empresas para exibição
  const companyMap = new Map(companies?.map(c => [c.id, c.name]) || []);

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
              <CardTitle>Gerenciar Contratos</CardTitle>
              <CardDescription>Vincule contratos a empresas com parâmetros de SLA e banco de horas</CardDescription>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Contrato
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                <TableHead>Horas/Mês</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts?.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{contract.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {companyMap.get(contract.company_id) || '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(contract.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {contract.end_date
                      ? new Date(contract.end_date + 'T00:00:00').toLocaleDateString('pt-BR')
                      : 'Indeterminado'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contract.monthly_hours ? `${contract.monthly_hours}h` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={contract.is_active ? 'default' : 'secondary'}>
                      {contract.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(contract)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(contract.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!contracts || contracts.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum contrato cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de criação/edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Atualize os dados do contrato.' : 'Preencha os dados para criar um novo contrato.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empresa *</Label>
              <Select value={formData.company_id} onValueChange={(v) => setFormData(p => ({ ...p, company_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do Contrato *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Contrato Anual 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(p => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data Término</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(p => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Horas Mensais Contratadas</Label>
              <Input
                type="number"
                value={formData.monthly_hours}
                onChange={(e) => setFormData(p => ({ ...p, monthly_hours: e.target.value }))}
                placeholder="Ex: 40"
                min="0"
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Notas sobre o contrato..."
                className="min-h-[80px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData(p => ({ ...p, is_active: v }))}
              />
              <Label>Contrato ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createContract.isPending || updateContract.isPending || !formData.name || !formData.company_id}
            >
              {(createContract.isPending || updateContract.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este contrato? Tickets vinculados perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteContract.mutate(deleteId)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
