import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { useUserProfile } from '@/hooks/useUserRole';
import { TopBar } from '@/components/dashboard/TopBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  GitBranch, Plus, Edit2, Trash2, ArrowRightLeft, Loader2,
  History, Zap, Crown, CheckCircle2, XCircle, RefreshCw,
  MessageSquare, AlertTriangle, ChevronRight
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: { field: string; operator: string; value: string };
  actions: { type: string; target: string };
  is_active: boolean;
}

interface AutomationLog {
  id: string;
  rule_id: string | null;
  ticket_id: string;
  rule_name: string;
  action_type: string;
  action_result: string;
  created_at: string;
}

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  shortcut?: string;
}

// ── Constants ────────────────────────────────────────────────
const CONDITION_FIELDS = [
  { value: 'category',   label: 'Categoria' },
  { value: 'priority',   label: 'Prioridade' },
  { value: 'title',      label: 'Assunto (contém)' },
  { value: 'company_id', label: 'Empresa' },
  { value: 'is_vip',     label: '👑 Cliente VIP' },
];

const ACTION_TYPES = [
  { value: 'assign_tech',       label: 'Atribuir a Agente' },
  { value: 'round_robin',       label: 'Round-Robin (Fila)' },
  { value: 'escalate_manager',  label: 'Escalar para Gestor' },
  { value: 'set_priority',      label: 'Definir Prioridade' },
  { value: 'auto_response',     label: 'Resposta Automática' },
  { value: 'notify_all',        label: 'Notificar Todos os Técnicos' },
];

const ACTION_ICONS: Record<string, React.ElementType> = {
  assign_tech: ArrowRightLeft,
  round_robin: RefreshCw,
  escalate_manager: AlertTriangle,
  set_priority: Crown,
  auto_response: MessageSquare,
  notify_all: Zap,
};

// ── Rule Builder Form ────────────────────────────────────────
function RuleForm({
  rule, technicians, companies, cannedResponses, onSave, onClose, isPending,
}: {
  rule: RoutingRule | null;
  technicians: any[];
  companies: any[];
  cannedResponses: CannedResponse[];
  onSave: (data: any) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [priority, setPriority] = useState(rule?.priority ?? 10);
  const [condField, setCondField] = useState(rule?.conditions?.field ?? 'category');
  const [condOp, setCondOp] = useState(rule?.conditions?.operator ?? 'equals');
  const [condVal, setCondVal] = useState(rule?.conditions?.value ?? '');
  const [actType, setActType] = useState(rule?.actions?.type ?? 'assign_tech');
  const [actTarget, setActTarget] = useState(rule?.actions?.target ?? '');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const { toast } = useToast();

  // When condition field changes, reset value
  const handleCondField = (v: string) => { setCondField(v); setCondVal(''); };
  // When is_vip selected, operator must be 'equals'
  const effectiveOp = condField === 'is_vip' ? 'equals' : condOp;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: 'Preencha o nome da regra', variant: 'destructive' }); return; }
    if (!condVal && condField !== 'is_vip') { toast({ title: 'Preencha o valor da condição', variant: 'destructive' }); return; }
    if (actType !== 'notify_all' && actType !== 'round_robin' && !actTarget.trim()) {
      toast({ title: 'Preencha o alvo da ação', variant: 'destructive' }); return;
    }
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

  const needsTarget = !['notify_all', 'round_robin'].includes(actType);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-2">
      {/* Name + Order */}
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

      {/* Condition */}
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
                    {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

      {/* Action */}
      <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center text-white text-[9px] font-black">⇒</div>
          <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600">Ação</h4>
        </div>
        <div className={cn("grid gap-2", needsTarget ? "grid-cols-2" : "grid-cols-1")}>
          <Select value={actType} onValueChange={v => { setActType(v); setActTarget(''); }}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {actType === 'assign_tech' || actType === 'escalate_manager' ? (
            <Select value={actTarget} onValueChange={setActTarget}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione técnico..." /></SelectTrigger>
              <SelectContent>
                {technicians.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
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

      {/* Active toggle */}
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
}

// ── Tab 1: Rules ─────────────────────────────────────────────
function RulesTab({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | null>(null);

  const { data: rules = [], isLoading: rulesLoading } = useQuery<RoutingRule[]>({
    queryKey: ['routing-rules', companyId],
    queryFn: async () => {
      const { data, error } = await supabaseRead.from('routing_rules').select('*')
        .eq('company_id', companyId).order('priority', { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, user_roles!inner(role)')
        .eq('company_id', companyId).in('user_roles.role', ['technician', 'admin', 'developer']);
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['all-companies'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id, name, is_vip');
      return (data as any[]) || [];
    },
  });

  const { data: cannedResponses = [] } = useQuery<CannedResponse[]>({
    queryKey: ['canned-responses', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('canned_responses').select('id, title, shortcut')
        .eq('company_id', companyId);
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        company_id: companyId,
        name: data.name, description: data.description,
        priority: data.priority,
        conditions: data.conditions,
        actions: data.actions,
        is_active: data.is_active,
      };
      if (data.id) {
        const { error } = await supabase.from('routing_rules').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('routing_rules').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routing-rules'] });
      toast({ title: 'Regra salva!' });
      setDialogOpen(false); setEditing(null);
    },
    onError: () => toast({ title: 'Erro ao salvar regra', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routing_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routing-rules'] });
      toast({ title: 'Regra removida' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('routing_rules').update({ is_active: active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-rules'] }),
  });

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (r: RoutingRule) => { setEditing(r); setDialogOpen(true); };

  const ActionBadge = ({ type }: { type: string }) => {
    const ActionIcon = ACTION_ICONS[type] || Zap;
    const label = ACTION_TYPES.find(a => a.value === type)?.label ?? type;
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
        <ActionIcon className="w-3 h-3" /> {label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">Regras de Automação</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Executadas na criação de cada chamado, por ordem de prioridade.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2 font-bold"><Plus className="w-4 h-4" />Nova Regra</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[620px]">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Regra' : 'Nova Regra de Automação'}</DialogTitle>
            </DialogHeader>
            <RuleForm
              rule={editing}
              technicians={technicians}
              companies={companies}
              cannedResponses={cannedResponses}
              onSave={d => saveMutation.mutate(d)}
              onClose={() => { setDialogOpen(false); setEditing(null); }}
              isPending={saveMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {rulesLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="p-4 bg-muted/30 rounded-full"><GitBranch className="w-8 h-8 text-muted-foreground/50" /></div>
            <div>
              <p className="font-bold text-foreground">Nenhuma regra configurada</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Crie sua primeira regra para automatizar atribuições, prioridades e respostas nos chamados.
              </p>
            </div>
            <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Criar Primeira Regra</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const condLabel = CONDITION_FIELDS.find(f => f.value === rule.conditions?.field)?.label ?? rule.conditions?.field;
            return (
              <Card key={rule.id} className={cn(
                "border transition-all duration-200",
                rule.is_active ? "border-border/50" : "border-border/20 opacity-60"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Priority badge */}
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-primary">{rule.priority}</span>
                    </div>

                    {/* Rule info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-sm text-foreground truncate">{rule.name}</h3>
                        {!rule.is_active && (
                          <Badge variant="outline" className="text-[9px] font-black bg-muted">INATIVA</Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mb-2 truncate">{rule.description}</p>
                      )}
                      {/* Condition → Action pill */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                          {condLabel} {rule.conditions?.operator === 'contains' ? 'contém' : rule.conditions?.operator === 'not_equals' ? '≠' : '='} "{rule.conditions?.value}"
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <ActionBadge type={rule.actions?.type} />
                        {rule.actions?.target && (
                          <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[160px]">{rule.actions.target}</span>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={v => toggleMutation.mutate({ id: rule.id, active: v })}
                        className="scale-90"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(rule)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"
                        onClick={() => { if (confirm('Excluir esta regra?')) deleteMutation.mutate(rule.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Execution History ─────────────────────────────────
function HistoryTab() {
  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<AutomationLog[]>({
    queryKey: ['automation-logs'],
    queryFn: async () => {
      const { data, error } = await (supabaseRead as any)
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) || [];
    },
    refetchInterval: 15_000,
  });

  const actionIcon = (type: string) => {
    const Icon = ACTION_ICONS[type] || Zap;
    return <Icon className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">Histórico de Execuções</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Atualiza automaticamente a cada 15 segundos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
      ) : logs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <History className="w-10 h-10 text-muted-foreground/30" />
            <div>
              <p className="font-bold">Nenhuma execução registrada</p>
              <p className="text-sm text-muted-foreground">As regras são executadas automaticamente quando um chamado é criado.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="bg-muted/10 sticky top-0">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Quando</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Regra Disparada</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Ação</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id} className="hover:bg-muted/10">
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { locale: ptBR, addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-xs">{log.rule_name ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                        {actionIcon(log.action_type)} {ACTION_TYPES.find(a => a.value === log.action_type)?.label ?? log.action_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.action_result}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}

// ── Tab 3: Canned Responses Manager ─────────────────────────
function TemplatesTab({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [shortcut, setShortcut] = useState('');

  const { data: responses = [], isLoading } = useQuery<CannedResponse[]>({
    queryKey: ['canned-responses-full', companyId],
    queryFn: async () => {
      const { data, error } = await supabaseRead.from('canned_responses').select('*')
        .eq('company_id', companyId).order('title');
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!companyId,
  });

  const resetForm = () => { setEditing(null); setTitle(''); setContent(''); setShortcut(''); };
  const openEdit = (r: CannedResponse) => { setEditing(r); setTitle(r.title); setContent(r.content); setShortcut(r.shortcut ?? ''); setDialogOpen(true); };
  const openNew = () => { resetForm(); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !content.trim()) throw new Error('Preencha título e conteúdo');
      const payload: any = { title: title.trim(), content: content.trim(), shortcut: shortcut.trim() || null, company_id: companyId };
      if (editing) {
        const { error } = await supabase.from('canned_responses').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('canned_responses').insert([{ ...payload, created_by: user?.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-responses-full'] });
      qc.invalidateQueries({ queryKey: ['canned-responses'] });
      toast({ title: editing ? 'Template atualizado' : 'Template criado' });
      setDialogOpen(false); resetForm();
    },
    onError: (err: any) => toast({ title: err.message ?? 'Erro', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('canned_responses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-responses-full'] });
      qc.invalidateQueries({ queryKey: ['canned-responses'] });
      toast({ title: 'Template removido' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">Templates de Resposta</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Respostas prontas disponíveis no editor de chamados e nas regras de automação.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2 font-bold"><Plus className="w-4 h-4" />Novo Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Template' : 'Novo Template de Resposta'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider">Título *</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Saudação Inicial" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider">Atalho</Label>
                  <Input value={shortcut} onChange={e => setShortcut(e.target.value)} placeholder="/oi" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Conteúdo *</Label>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Texto da resposta pronta..."
                  className="min-h-[140px] resize-none"
                />
                <p className="text-[10px] text-muted-foreground text-right">{content.length} caracteres</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {responses.map(r => (
            <Card key={r.id} className="group border-border/50 hover:border-primary/30 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-sm text-foreground">{r.title}</h3>
                  {r.shortcut && (
                    <Badge variant="secondary" className="text-[9px] font-black shrink-0">{r.shortcut}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{r.content}</p>
                <div className="flex items-center justify-end gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(r)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
                    onClick={() => { if (confirm('Excluir este template?')) deleteMutation.mutate(r.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {responses.length === 0 && (
            <Card className="border-dashed col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Zap className="w-10 h-10 text-muted-foreground/30" />
                <div>
                  <p className="font-bold">Nenhum template cadastrado</p>
                  <p className="text-sm text-muted-foreground">Crie templates para agilizar as respostas da equipe.</p>
                </div>
                <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Criar Primeiro Template</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
const Automacoes: React.FC = () => {
  const { data: profile } = useUserProfile();
  const companyId = profile?.company_id ?? '';

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 lg:p-12 max-w-[1400px] mx-auto w-full">
        <TopBar />

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <GitBranch className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Motor de Automação</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              Regras · Gatilhos · Workflows
            </p>
          </div>
        </div>

        {!companyId ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">Empresa não identificada. Verifique suas permissões.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="rules" className="space-y-6">
            <TabsList className="bg-muted/40 border border-border/50 h-11 p-1">
              <TabsTrigger value="rules" className="gap-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <GitBranch className="w-4 h-4" /> Regras
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <History className="w-4 h-4" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Zap className="w-4 h-4" /> Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rules"><RulesTab companyId={companyId} /></TabsContent>
            <TabsContent value="history"><HistoryTab /></TabsContent>
            <TabsContent value="templates"><TemplatesTab companyId={companyId} /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Automacoes;
