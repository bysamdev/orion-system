import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  CONDITION_FIELDS, ACTION_TYPES,
  type RoutingRule, type CannedResponseRef, type Technician, type Company,
} from '@/hooks/useAutomation';

interface Props {
  rule: RoutingRule | null;
  technicians: Technician[];
  companies: Company[];
  cannedResponses: CannedResponseRef[];
  onSave: (data: Partial<RoutingRule> & { id?: string }) => void;
  onClose: () => void;
  isPending: boolean;
}

export const RuleForm: React.FC<Props> = ({
  rule, technicians, companies, cannedResponses, onSave, onClose, isPending,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [priority, setPriority] = useState(rule?.priority ?? 10);
  const [condField, setCondField] = useState(rule?.conditions?.field ?? 'category');
  const [condOp, setCondOp] = useState(rule?.conditions?.operator ?? 'equals');
  const [condVal, setCondVal] = useState(rule?.conditions?.value ?? '');
  const [actType, setActType] = useState(rule?.actions?.type ?? 'assign_tech');
  const [actTarget, setActTarget] = useState(rule?.actions?.target ?? '');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);

  const handleCondField = (v: string) => { setCondField(v); setCondVal(''); };
  const effectiveOp = condField === 'is_vip' ? 'equals' : condOp;
  const needsTarget = !['notify_all', 'round_robin'].includes(actType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: 'Preencha o nome da regra', variant: 'destructive' }); return; }
    if (!condVal && condField !== 'is_vip') { toast({ title: 'Preencha o valor da condição', variant: 'destructive' }); return; }
    if (needsTarget && !actTarget.trim()) { toast({ title: 'Preencha o alvo da ação', variant: 'destructive' }); return; }

    onSave({
      id: rule?.id,
      name: name.trim(),
      description: description.trim(),
      priority,
      conditions: { field: condField, operator: effectiveOp, value: condField === 'is_vip' ? 'true' : condVal },
      actions: { type: actType, target: actTarget },
      is_active: isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-2">
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3 space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider">Nome da Regra *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: VIP → Urgente" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider">Ordem</Label>
          <Input type="number" min={1} value={priority} onChange={e => setPriority(+e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider">Descrição</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Explique o que esta regra faz..." />
      </div>

      {/* Condition block */}
      <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-white text-[9px] font-black">SE</div>
          <h4 className="text-xs font-black uppercase tracking-widest text-blue-600">Condição</h4>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={condField} onValueChange={handleCondField}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {condField === 'is_vip' ? (
            <div className="col-span-2 flex items-center justify-center bg-amber-500/10 border border-amber-500/20 rounded-lg px-3">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">for igual a VIP = true</span>
            </div>
          ) : (
            <>
              <Select value={condOp} onValueChange={setCondOp}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">For Igual a</SelectItem>
                  <SelectItem value="contains">Contiver</SelectItem>
                  <SelectItem value="not_equals">Não for Igual a</SelectItem>
                </SelectContent>
              </Select>

              {condField === 'company_id' ? (
                <Select value={condVal} onValueChange={setCondVal}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Empresa..." /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : condField === 'priority' ? (
                <Select value={condVal} onValueChange={setCondVal}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Prioridade..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">🔴 Urgente</SelectItem>
                    <SelectItem value="high">🟠 Alta</SelectItem>
                    <SelectItem value="medium">🟡 Média</SelectItem>
                    <SelectItem value="low">🟢 Baixa</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input className="h-9 text-sm" placeholder="Valor..." value={condVal} onChange={e => setCondVal(e.target.value)} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Action block */}
      <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center text-white text-[9px] font-black">⇒</div>
          <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600">Ação</h4>
        </div>
        <div className={cn('grid gap-2', needsTarget ? 'grid-cols-2' : 'grid-cols-1')}>
          <Select value={actType} onValueChange={v => { setActType(v); setActTarget(''); }}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {(actType === 'assign_tech' || actType === 'escalate_manager') ? (
            <Select value={actTarget} onValueChange={setActTarget}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione técnico..." /></SelectTrigger>
              <SelectContent>
                {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : actType === 'set_priority' ? (
            <Select value={actTarget} onValueChange={setActTarget}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nova prioridade..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">🔴 Urgente</SelectItem>
                <SelectItem value="high">🟠 Alta</SelectItem>
                <SelectItem value="medium">🟡 Média</SelectItem>
                <SelectItem value="low">🟢 Baixa</SelectItem>
              </SelectContent>
            </Select>
          ) : actType === 'auto_response' ? (
            <Select value={actTarget} onValueChange={setActTarget}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Resposta pronta..." /></SelectTrigger>
              <SelectContent>
                {cannedResponses.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title} {r.shortcut ? `(${r.shortcut})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-background border border-border/50 rounded-xl">
        <Label htmlFor="rule-active" className="font-bold text-sm cursor-pointer">Regra Ativa</Label>
        <Switch id="rule-active" checked={isActive} onCheckedChange={setIsActive} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {rule ? 'Salvar Alterações' : 'Criar Regra'}
        </Button>
      </DialogFooter>
    </form>
  );
};
