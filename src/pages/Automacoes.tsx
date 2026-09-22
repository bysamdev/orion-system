import React, { useMemo, useState } from 'react';
import { GitBranch, History, Zap } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RulesTab } from '@/components/automation/RulesTab';
import { HistoryTab } from '@/components/automation/HistoryTab';
import { TemplatesTab } from '@/components/automation/TemplatesTab';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCompanies } from '@/hooks/useCompanies';
import { useEquipeInterna } from '@/hooks/useEquipeInterna';
import { useCannedResponseRefs, type Company } from '@/hooks/useAutomation';
import type { Nomes } from '@/components/automation/fluxo';

// Área de gestor (rota e menu só liberam admin e developer; a RLS garante o
// mesmo no banco). Regras, histórico e templates são compartilhados entre os
// gestores: o filtro de empresa abaixo só muda o que aparece na tela.
const Automacoes: React.FC = () => {
  const { data: profile } = useUserProfile();
  const { data: empresasBrutas = [] } = useCompanies();
  const { data: equipe = [] } = useEquipeInterna();
  const { data: templates = [] } = useCannedResponseRefs();
  const [filtroEmpresa, setFiltroEmpresa] = useState('all');

  const empresas: Company[] = useMemo(
    () => empresasBrutas.map(e => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [empresasBrutas]
  );

  const nomes: Nomes = useMemo(() => ({
    empresas: new Map(empresas.map(e => [e.id, e.name])),
    pessoas: new Map(equipe.map(p => [p.id, p.full_name || 'Sem nome'])),
    templates: new Map(templates.map(t => [t.id, t.title])),
  }), [empresas, equipe, templates]);

  const empresaPadrao = profile?.company_id ?? empresas[0]?.id ?? '';

  return (
    <div className="w-full space-y-6">
      <PageHeader
        icon={GitBranch}
        badge="TRIAGEM & WORKFLOWS"
        title="Automações"
        description="Fluxos que agem sozinhos quando um chamado é aberto, o histórico do que eles fizeram e as respostas prontas."
      />

      <Tabs defaultValue="rules" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="overflow-x-auto pb-1">
            <TabsList className="w-auto inline-flex flex-nowrap">
              <TabsTrigger value="rules" className="gap-2"><GitBranch className="w-4 h-4" /><span>Regras</span></TabsTrigger>
              <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /><span>Histórico</span></TabsTrigger>
              <TabsTrigger value="templates" className="gap-2"><Zap className="w-4 h-4" /><span>Templates</span></TabsTrigger>
            </TabsList>
          </div>
          {empresas.length > 1 && (
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="h-9 sm:w-[220px]" aria-label="Filtrar por empresa"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="rules">
          <RulesTab
            filtroEmpresa={filtroEmpresa}
            empresaPadrao={empresaPadrao}
            empresas={empresas}
            equipe={equipe}
            templates={templates}
            nomes={nomes}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab filtroEmpresa={filtroEmpresa} nomesDasEmpresas={nomes.empresas} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Automacoes;
