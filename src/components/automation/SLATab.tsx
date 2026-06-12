import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Loader2, Save, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const SLATab = ({ companyId }: { companyId: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: slaConfigs = [], isLoading } = useQuery({
    queryKey: ['sla-configs', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sla_configs')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!companyId
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { error } = await supabase.from('sla_configs').update(payload).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sla_configs').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
      toast({ title: 'Sucesso', description: 'Configuração de SLA salva com sucesso.' });
      setEditingId(null);
      setFormData(null);
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sla_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
      toast({ title: 'Excluído', description: 'Configuração removida.' });
    }
  });

  const handleEdit = (sla: any) => {
    setEditingId(sla.id);
    setFormData({ ...sla });
  };

  const handleCreate = () => {
    setEditingId('new');
    setFormData({
      company_id: companyId,
      name: 'Nova Política de SLA',
      business_hours_only: true,
      business_start: '09:00',
      business_end: '18:00',
      urgent_hours: 4,
      high_hours: 8,
      medium_hours: 24,
      low_hours: 48
    });
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Políticas de SLA</h2>
          <p className="text-sm text-muted-foreground">Gerencie os prazos de resposta e resolução (Service Level Agreement).</p>
        </div>
        <Button onClick={handleCreate} disabled={editingId !== null} className="gap-2">
          <Plus className="w-4 h-4" /> Novo SLA
        </Button>
      </div>

      {editingId && formData && (
        <Card className="border-primary/50 shadow-md">
          <CardHeader>
            <CardTitle>{editingId === 'new' ? 'Nova Política' : 'Editar Política'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Nome da Política</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="Ex: SLA Ouro"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
              <div className="space-y-0.5">
                <Label>Apenas Horário Comercial</Label>
                <p className="text-xs text-muted-foreground">O tempo de SLA será pausado fora deste horário.</p>
              </div>
              <Switch 
                checked={formData.business_hours_only} 
                onCheckedChange={v => setFormData({ ...formData, business_hours_only: v })} 
              />
            </div>

            {formData.business_hours_only && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início (HH:MM)</Label>
                  <Input 
                    type="time" 
                    value={formData.business_start} 
                    onChange={e => setFormData({ ...formData, business_start: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Término (HH:MM)</Label>
                  <Input 
                    type="time" 
                    value={formData.business_end} 
                    onChange={e => setFormData({ ...formData, business_end: e.target.value })} 
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border/50 space-y-4">
              <h4 className="text-sm font-bold uppercase text-muted-foreground">Prazos de Resolução (Em horas)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-red-500 font-bold">Urgente</Label>
                  <Input type="number" min="1" value={formData.urgent_hours} onChange={e => setFormData({ ...formData, urgent_hours: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-amber-500 font-bold">Alta</Label>
                  <Input type="number" min="1" value={formData.high_hours} onChange={e => setFormData({ ...formData, high_hours: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-blue-500 font-bold">Média</Label>
                  <Input type="number" min="1" value={formData.medium_hours} onChange={e => setFormData({ ...formData, medium_hours: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-bold">Baixa</Label>
                  <Input type="number" min="1" value={formData.low_hours} onChange={e => setFormData({ ...formData, low_hours: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => { setEditingId(null); setFormData(null); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Política
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {slaConfigs.map((sla: any) => (
          <Card key={sla.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{sla.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {sla.business_hours_only ? `${sla.business_start} às ${sla.business_end}` : '24/7'}
                    </span>
                    <span className="flex items-center gap-1 text-red-500/80">
                      <AlertTriangle className="w-3 h-3" />
                      Urgente: {sla.urgent_hours}h
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(sla)}>Editar</Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(sla.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {slaConfigs.length === 0 && !editingId && (
          <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
            <p className="text-muted-foreground">Nenhuma política de SLA configurada.</p>
          </div>
        )}
      </div>
    </div>
  );
};
