import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Check, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const SLAConfiguration: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [sla, setSla] = useState({
    urgent: 2,
    high: 8,
    medium: 24,
    low: 48,
  });

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: 'Configurações de SLA salvas com sucesso' });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/40 shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/20 pb-6">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Níveis de SLA (Horas)
          </CardTitle>
          <CardDescription>Defina o tempo limite para resolução de chamados baseados na prioridade</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <SLALevel 
              label="Urgente" 
              value={sla.urgent} 
              onChange={(v) => setSla({...sla, urgent: v})} 
              color="rose"
              icon={AlertTriangle}
            />
            <SLALevel 
              label="Alta" 
              value={sla.high} 
              onChange={(v) => setSla({...sla, high: v})} 
              color="orange"
            />
            <SLALevel 
              label="Média" 
              value={sla.medium} 
              onChange={(v) => setSla({...sla, medium: v})} 
              color="blue"
            />
            <SLALevel 
              label="Baixa" 
              value={sla.low} 
              onChange={(v) => setSla({...sla, low: v})} 
              color="slate"
            />
          </div>

          <Separator className="my-8 opacity-50" />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-bold">Horário de Atendimento</h4>
              <p className="text-xs text-muted-foreground">Os prazos de SLA consideram apenas dias úteis (Seg-Sex, 08:00 - 18:00)</p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={loading}
              className="rounded-xl px-8 gap-2 font-black uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              {loading ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 border-dashed bg-transparent rounded-3xl overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4 text-muted-foreground italic text-sm">
          <div className="p-2 rounded-full bg-muted">
            <Check className="w-4 h-4" />
          </div>
          Alterações no SLA afetarão apenas novos chamados abertos após a atualização.
        </CardContent>
      </Card>
    </div>
  );
};

const SLALevel = ({ label, value, onChange, color, icon: Icon }: any) => {
  const colorMap: any = {
    rose: 'border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 text-rose-600',
    orange: 'border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/10 text-orange-600',
    blue: 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/10 text-blue-600',
    slate: 'border-slate-500/30 bg-slate-50/50 dark:bg-slate-500/10 text-slate-600',
  };

  return (
    <div className={`p-6 rounded-2xl border-2 transition-all hover:shadow-md ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </div>
        <Badge variant="outline" className="border-current font-bold">{value}h</Badge>
      </div>
      <div className="flex items-center gap-4">
        <Input 
          type="number" 
          value={value} 
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="h-10 bg-background border-border/40 rounded-xl font-bold text-foreground"
        />
        <span className="text-xs font-bold opacity-60">Horas</span>
      </div>
    </div>
  );
};
