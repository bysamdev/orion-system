import React from 'react';
import { useUserProfile } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { GitBranch, History, Zap } from 'lucide-react';
import { RulesTab } from '@/components/automation/RulesTab';
import { HistoryTab } from '@/components/automation/HistoryTab';
import { TemplatesTab } from '@/components/automation/TemplatesTab';
import { SLATab } from '@/components/automation/SLATab';
import { Clock } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

const Automacoes: React.FC = () => {
  const { data: profile } = useUserProfile();
  const companyId = profile?.company_id ?? '';

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={Zap}
        badge="TRIAGEM & WORKFLOWS"
        title="Central de Automações"
        description="Regras inteligentes de triagem, roteamento de chamados e execução de rotinas."
      />

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
              <TabsTrigger value="sla" className="gap-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Clock className="w-4 h-4" /> SLA & Contratos
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2 font-bold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Zap className="w-4 h-4" /> Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rules"><RulesTab companyId={companyId} /></TabsContent>
            <TabsContent value="history"><HistoryTab /></TabsContent>
            <TabsContent value="sla"><SLATab companyId={companyId} /></TabsContent>
            <TabsContent value="templates"><TemplatesTab companyId={companyId} /></TabsContent>
          </Tabs>
        )}
    </div>
  );
};

export default Automacoes;
