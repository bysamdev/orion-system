import React from 'react';
import { useUserProfile } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { GitBranch, History, Zap, Sparkles } from 'lucide-react';
import { RulesTab } from '@/components/automation/RulesTab';
import { HistoryTab } from '@/components/automation/HistoryTab';
import { TemplatesTab } from '@/components/automation/TemplatesTab';
import { PageHeader } from '@/components/shared/PageHeader';
import { useRoutingRules, useCannedResponses, useAutomationLogs } from '@/hooks/useAutomation';

const Automacoes: React.FC = () => {
  const { data: profile } = useUserProfile();
  const companyId = profile?.company_id ?? '';

  const { data: rules = [] } = useRoutingRules(companyId);
  const { data: cannedResponses = [] } = useCannedResponses(companyId);
  const { data: logs = [] } = useAutomationLogs();

  const activeRulesCount = rules.filter((r) => r.is_active).length;
  const totalRulesCount = rules.length;
  const totalTemplatesCount = cannedResponses.length;
  const totalLogsCount = logs.length;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={GitBranch}
        badge="WORKFLOWS & PRODUTIVIDADE"
        title="Automações & Respostas Prontas"
        description="Configure regras inteligentes de triagem, roteamento automático de chamados e gerencie templates de respostas rápidas para a equipe."
      />

      {!companyId ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-muted-foreground">Empresa não identificada. Verifique suas permissões.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Métricas e Indicadores Visuais de Automação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Regras Ativas */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:border-primary/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-primary/10 transition-all" />
              <CardContent className="p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-sm">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regras de Triagem</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-foreground tracking-tight">{activeRulesCount}</span>
                    <span className="text-xs text-muted-foreground font-medium">de {totalRulesCount} ativas</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Templates & Respostas */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-amber-500/10 transition-all" />
              <CardContent className="p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-sm">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Respostas Prontas</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-foreground tracking-tight">{totalTemplatesCount}</span>
                    <span className="text-xs text-muted-foreground font-medium">modelos rápidos</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Histórico de Execuções */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-emerald-500/10 transition-all" />
              <CardContent className="p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
                  <History className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disparos Totais</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-foreground tracking-tight">{totalLogsCount}</span>
                    <span className="text-xs text-muted-foreground font-medium">no histórico</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Status do Motor */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-indigo-500/10 transition-all" />
              <CardContent className="p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motor de Triagem</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-sm font-bold text-foreground">Operacional</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="rules" className="space-y-6">
            <div className="overflow-x-auto pb-1">
              <TabsList className="w-auto inline-flex flex-wrap sm:flex-nowrap">
                <TabsTrigger value="rules" className="gap-2">
                  <GitBranch className="w-4 h-4" />
                  <span>Regras de Triagem</span>
                </TabsTrigger>

                <TabsTrigger value="templates" className="gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Respostas Prontas</span>
                </TabsTrigger>

                <TabsTrigger value="history" className="gap-2">
                  <History className="w-4 h-4" />
                  <span>Histórico de Execuções</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="rules" className="mt-6">
              <RulesTab companyId={companyId} />
            </TabsContent>

            <TabsContent value="templates" className="mt-6">
              <TemplatesTab companyId={companyId} />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <HistoryTab />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default Automacoes;

