import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, AlertTriangle, Activity } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import MonitoringWrapper from './Monitoring';
import AlertsDashboardWrapper from './AlertsDashboard';

export default function InfrastructureDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'sistemas';
  const externalMachineId = searchParams.get('machine');

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  const handleAlertClick = (machineId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'sistemas');
    next.set('machine', machineId);
    setSearchParams(next);
  };

  const handleClearExternalMachine = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('machine');
    setSearchParams(next);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header com Tabs */}
      <PageHeader
        icon={Activity}
        badge="INFRAESTRUTURA & INCIDENTES"
        title="Sistemas e Alertas"
        description="Supervisão global da infraestrutura corporativa e central de incidentes."
        actions={
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
            <TabsList className="grid w-full sm:w-[320px] grid-cols-2 p-1 bg-muted/60 rounded-xl border border-border/40">
              <TabsTrigger
                value="sistemas"
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all"
              >
                <Monitor className="w-4 h-4 mr-2" />
                Sistemas
              </TabsTrigger>
              <TabsTrigger
                value="alertas"
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-red-500 font-bold transition-all"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Alertas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* Conteúdo Dinâmico da Aba Ativa */}
      <div className="w-full">
        {activeTab === 'sistemas' ? (
          <MonitoringWrapper
            externalMachineId={externalMachineId}
            onClearExternalMachine={handleClearExternalMachine}
            hideHeader={true}
          />
        ) : (
          <AlertsDashboardWrapper onAlertClick={handleAlertClick} hideHeader={true} />
        )}
      </div>
    </div>
  );
}
