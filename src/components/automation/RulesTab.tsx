import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, GitBranch, Plus, Edit2, Trash2, RefreshCw, AlertTriangle, Zap, MessageSquare, Crown, ArrowRightLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  CONDITION_FIELDS, ACTION_TYPES,
  useRoutingRules, useTechnicians, useAllCompanies, useCannedResponseRefs,
  useSaveRule, useDeleteRule, useToggleRule,
  type RoutingRule,
} from '@/hooks/useAutomation';
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
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
      <Icon className="w-3 h-3" /> {label}
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

  const { data: rules = [], isLoading } = useRoutingRules(companyId);
  const { data: technicians = [] } = useTechnicians(companyId);
  const { data: companies = [] } = useAllCompanies();
  const { data: cannedResponses = [] } = useCannedResponseRefs(companyId);

  const saveMutation = useSaveRule(companyId);
  const deleteMutation = useDeleteRule();
  const toggleMutation = useToggleRule();

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (r: RoutingRule) => { setEditing(r); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const handleSave = (data: any) => {
    saveMutation.mutate(data, {
      onSuccess: () => { toast({ title: 'Regra salva!' }); closeDialog(); },
      onError: () => toast({ title: 'Erro ao salvar regra', variant: 'destructive' }),
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: 'Regra removida' }),
    });
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
            <ButtonPrimary onClick={openNew} className="font-bold" icon={<Plus className="w-4 h-4" />}>
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

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="p-4 bg-muted/30 rounded-full"><GitBranch className="w-8 h-8 text-muted-foreground/50" /></div>
            <div>
              <p className="font-bold text-foreground">Nenhuma regra configurada</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Crie sua primeira regra para automatizar atribuições, prioridades e respostas.</p>
            </div>
            <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Criar Primeira Regra</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const condLabel = CONDITION_FIELDS.find(f => f.value === rule.conditions?.field)?.label ?? rule.conditions?.field;
            return (
              <Card key={rule.id} className={cn('border transition-all duration-200', rule.is_active ? 'border-border/50' : 'border-border/20 opacity-60')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-primary">{rule.priority}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-sm text-foreground truncate">{rule.name}</h3>
                        {!rule.is_active && <Badge variant="outline" className="text-[9px] font-black bg-muted">INATIVA</Badge>}
                      </div>
                      {rule.description && <p className="text-xs text-muted-foreground mb-2 truncate">{rule.description}</p>}
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={v => toggleMutation.mutate({ id: rule.id, active: v })}
                        className="scale-90"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(rule)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(rule.id)}>
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
};
