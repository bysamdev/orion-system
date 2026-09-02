import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, GitBranch, Plus, Edit2, Trash2, RefreshCw, AlertTriangle, Zap, MessageSquare, Crown, ArrowRightLeft, ArrowRight, Search, Filter, Layers, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  CONDITION_FIELDS, ACTION_TYPES,
  useRoutingRules, useTechnicians, useCannedResponseRefs,
  useSaveRule, useDeleteRule, useToggleRule,
  type RoutingRule,
} from '@/hooks/useAutomation';
import { useCompanies } from '@/hooks/useCompanies';
import { useProfilesMap, resolveUserDisplayName } from '@/hooks/useUserDisplayName';
import { RuleForm } from './RuleForm';

const ACTION_ICONS: Record<string, React.ElementType> = {
  assign_tech: ArrowRightLeft,
  round_robin: RefreshCw,
  escalate_manager: AlertTriangle,
  set_priority: Crown,
  auto_response: MessageSquare,
  notify_all: Zap,
};

const ActionBadge = ({ type }: { type: string }) => {
  const Icon = ACTION_ICONS[type] || Zap;
  const label = ACTION_TYPES.find(a => a.value === type)?.label ?? type;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

interface Props {
  companyId: string;
}

export const RulesTab: React.FC<Props> = ({ companyId }) => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rules = [], isLoading } = useRoutingRules(companyId);
  const { data: technicians = [] } = useTechnicians(companyId);
  const { data: companies = [] } = useCompanies();
  const { data: cannedResponses = [] } = useCannedResponseRefs(companyId);
  const { profilesMap } = useProfilesMap();

  const nomePorTecnico = useMemo(() => {
    const map = new Map<string, string>();
    technicians.forEach(t => map.set(t.id, t.full_name));
    return map;
  }, [technicians]);

  const nomePorEmpresa = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach(c => map.set(c.id, c.name));
    return map;
  }, [companies]);

  const nomePorTemplate = useMemo(() => {
    const map = new Map<string, string>();
    cannedResponses.forEach(r => map.set(r.id, r.title));
    return map;
  }, [cannedResponses]);

  const formatActionTarget = (type: string | undefined, target: string | undefined) => {
    if (!target) return '';
    if (type === 'assign_tech' || type === 'escalate_manager') {
      return nomePorTecnico.get(target) || resolveUserDisplayName(target, profilesMap, { fallback: 'Técnico removido' });
    }
    if (type === 'auto_response') {
      return nomePorTemplate.get(target) || 'Template';
    }
    if (type === 'set_priority') {
      const priorityLabels: Record<string, string> = {
        urgent: 'Urgente',
        high: 'Alta',
        medium: 'Média',
        low: 'Baixa',
      };
      return priorityLabels[target] || target;
    }
    return target;
  };

  const formatConditionValue = (field: string | undefined, value: string | undefined) => {
    if (!value) return '';
    if (field === 'company_id') {
      return nomePorEmpresa.get(value) || value;
    }
    if (field === 'assigned_to' || field === 'user_id') {
      return resolveUserDisplayName(value, profilesMap, { fallback: 'Usuário removido' });
    }
    if (field === 'priority') {
      const priorityLabels: Record<string, string> = {
        urgent: 'Urgente',
        high: 'Alta',
        medium: 'Média',
        low: 'Baixa',
      };
      return priorityLabels[value] || value;
    }
    return value;
  };

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const query = searchQuery.toLowerCase();
    return rules.filter(r => 
      r.name.toLowerCase().includes(query) ||
      (r.description && r.description.toLowerCase().includes(query)) ||
      (r.conditions?.field && r.conditions.field.toLowerCase().includes(query)) ||
      (r.conditions?.value && r.conditions.value.toLowerCase().includes(query)) ||
      (r.actions?.type && r.actions.type.toLowerCase().includes(query))
    );
  }, [rules, searchQuery]);

  const saveMutation = useSaveRule(companyId);
  const deleteMutation = useDeleteRule();
  const toggleMutation = useToggleRule();

  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (r: RoutingRule) => { setEditing(r); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const handleSave = (data: Partial<RoutingRule> & { id?: string }) => {
    saveMutation.mutate(data, {
      onSuccess: () => { toast({ title: 'Regra salva com sucesso!' }); closeDialog(); },
      onError: () => toast({ title: 'Erro ao salvar regra', variant: 'destructive' }),
    });
  };

  const handleDelete = (id: string) => {
    setRuleToDelete(id);
  };

  return (
    <div className="space-y-4">
      {/* Header com Busca e Criação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 p-4 rounded-2xl border border-border/40 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm tracking-tight text-foreground">Fluxos e Regras de Triagem</h2>
          </div>
          <p className="text-xs text-muted-foreground">Executadas na abertura de cada chamado, seguindo a ordem de prioridade definida.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar regras..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background/60"
            />
          </div>

          <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) setEditing(null); }}>
            <DialogTrigger asChild>
              <ButtonPrimary onClick={openNew} className="font-bold h-9" icon={<Plus className="w-4 h-4" />}>
                Nova Regra
              </ButtonPrimary>
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
                onSave={handleSave}
                onClose={closeDialog}
                isPending={saveMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Carregando regras de automação...</p>
        </div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <GitBranch className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground text-base">Nenhuma regra configurada</p>
              <p className="text-xs text-muted-foreground max-w-md">Crie regras automatizadas para atribuir chamados a técnicos, definir prioridades e disparar respostas pré-definidas.</p>
            </div>
            <ButtonPrimary onClick={openNew} className="gap-2 font-bold mt-2" icon={<Plus className="w-4 h-4" />}>
              Criar Primeira Regra
            </ButtonPrimary>
          </CardContent>
        </Card>
      ) : filteredRules.length === 0 ? (
        <Card className="border-dashed bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Search className="w-8 h-8 text-muted-foreground/40" />
            <p className="font-semibold text-sm text-foreground">Nenhuma regra encontrada</p>
            <p className="text-xs text-muted-foreground">Tente buscar por outro termo ou limpe o filtro.</p>
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="mt-2 text-xs">
              Limpar busca
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRules.map(rule => {
            const condLabel = CONDITION_FIELDS.find(f => f.value === rule.conditions?.field)?.label ?? rule.conditions?.field;
            const targetFormatted = formatActionTarget(rule.actions?.type, rule.actions?.target);

            return (
              <Card
                key={rule.id}
                className={cn(
                  'border transition-all duration-300 rounded-2xl overflow-hidden',
                  rule.is_active
                    ? 'border-border/60 bg-card/70 backdrop-blur-sm hover:border-primary/40 hover:shadow-md'
                    : 'border-border/30 bg-muted/10 opacity-70 hover:opacity-90'
                )}
              >
                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Topo do Card: Ordem, Título, Descrição e Ações */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-primary">#{rule.priority}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-foreground truncate">{rule.name}</h3>
                          {rule.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Ativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
                              Pausada
                            </span>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rule.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5 mr-1 bg-background/50 border border-border/40 px-2 py-1 rounded-xl">
                        <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
                          {rule.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={v => toggleMutation.mutate({ id: rule.id, active: v })}
                          className="scale-90"
                          aria-label="Ativar ou desativar regra"
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar regra de automação"
                        className="h-8 w-8 rounded-lg hover:text-primary hover:bg-primary/10"
                        onClick={() => openEdit(rule)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir regra de automação"
                        className="h-8 w-8 rounded-lg hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Diagrama Visual de Fluxo: SE (Gatilho/Condição) ➔ ENTÃO (Ação) */}
                  <div className="bg-muted/30 border border-border/40 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    {/* Bloco SE */}
                    <div className="flex-1 flex items-center gap-2.5 bg-background/80 border border-blue-500/20 p-2.5 rounded-lg shadow-2xs">
                      <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <Filter className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <span className="text-[10px] uppercase font-extrabold text-blue-600 dark:text-blue-400 block">SE O CHAMADO</span>
                        <span className="text-foreground font-medium truncate block">
                          <strong className="font-semibold text-foreground">{condLabel}</strong>{' '}
                          {rule.conditions?.operator === 'contains' ? 'contiver' : rule.conditions?.operator === 'not_equals' ? 'não for' : 'for igual a'}{' '}
                          <span className="font-bold text-primary">"{formatConditionValue(rule.conditions?.field, rule.conditions?.value)}"</span>
                        </span>
                      </div>
                    </div>

                    {/* Conector Visual */}
                    <div className="flex items-center justify-center text-muted-foreground/60 shrink-0">
                      <div className="hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-muted/60 border border-border">
                        <ArrowRight className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="md:hidden text-[10px] font-black uppercase tracking-wider text-muted-foreground">ENTÃO DISPARAR</span>
                    </div>

                    {/* Bloco ENTÃO */}
                    <div className="flex-1 flex items-center gap-2.5 bg-background/80 border border-indigo-500/20 p-2.5 rounded-lg shadow-2xs">
                      <div className="w-6 h-6 rounded-md bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <span className="text-[10px] uppercase font-extrabold text-indigo-600 dark:text-indigo-400 block">EXECUTAR AÇÃO</span>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <ActionBadge type={rule.actions?.type} />
                          {targetFormatted && (
                            <span className="font-bold text-foreground text-xs truncate max-w-[200px]">
                              ➔ {targetFormatted}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Regra de Automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta regra deixará de ser executada automaticamente na criação dos próximos chamados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-xl"
              onClick={() => {
                if (ruleToDelete) {
                  deleteMutation.mutate(ruleToDelete, {
                    onSuccess: () => toast({ title: 'Regra removida com sucesso' }),
                  });
                  setRuleToDelete(null);
                }
              }}
            >
              Excluir Regra
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

