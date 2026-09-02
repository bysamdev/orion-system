import React from 'react';
import { useUserProfile } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { GitBranch, History, Zap } from 'lucide-react';
import { RulesTab } from '@/components/automation/RulesTab';
import { HistoryTab } from '@/components/automation/HistoryTab';
import { TemplatesTab } from '@/components/automation/TemplatesTab';
import { PageHeader } from '@/components/shared/PageHeader';

const Automacoes: React.FC = () => {
  const { data: profile } = useUserProfile();
  const companyId = profile?.company_id ?? '';

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={GitBranch}
        badge="TRIAGEM & WORKFLOWS"
        title="Automações"
        description="Regras inteligentes de triagem, roteamento de chamados e templates de respostas rápidas."
      />

      {!companyId ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-muted-foreground">Empresa não identificada. Verifique suas permissões.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="rules" className="space-y-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="w-auto inline-flex flex-nowrap overflow-x-auto">
              <TabsTrigger value="rules" className="gap-2">
                <GitBranch className="w-4 h-4" />
                <span>Regras</span>
              </TabsTrigger>

              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                <span>Histórico</span>
              </TabsTrigger>

              <TabsTrigger value="templates" className="gap-2">
                <Zap className="w-4 h-4" />
                <span>Templates</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="rules">
            <RulesTab companyId={companyId} />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesTab companyId={companyId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Automacoes;

