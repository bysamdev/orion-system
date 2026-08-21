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
            <TabsList className="grid w-full sm:w-[320px] grid-cols-2">
              <TabsTrigger value="sistemas" className="gap-2">
                <Monitor className="w-4 h-4" />
                Sistemas
              </TabsTrigger>
              <TabsTrigger value="alertas" className="gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
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
