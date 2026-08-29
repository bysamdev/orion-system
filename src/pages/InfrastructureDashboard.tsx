import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, AlertTriangle, Activity, Gauge } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import MonitoringWrapper from './Monitoring';
import AlertsDashboardWrapper from './AlertsDashboard';
import PlatformHealthTab from '@/components/monitoring/PlatformHealthTab';

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
            <TabsList className="grid w-full sm:w-[460px] grid-cols-3">
              <TabsTrigger value="sistemas" className="gap-2">
                <Monitor className="w-4 h-4" />
                Sistemas
              </TabsTrigger>
              <TabsTrigger value="alertas" className="gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Alertas
              </TabsTrigger>
              <TabsTrigger value="plataforma" className="gap-2">
                <Gauge className="w-4 h-4 text-indigo-500" />
                Plataforma
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {/* Conteúdo Dinâmico da Aba Ativa */}
      <div className="w-full">
        {activeTab === 'sistemas' && (
          <MonitoringWrapper
            externalMachineId={externalMachineId}
            onClearExternalMachine={handleClearExternalMachine}
            hideHeader={true}
          />
        )}
        {activeTab === 'alertas' && <AlertsDashboardWrapper onAlertClick={handleAlertClick} hideHeader={true} />}
        {activeTab === 'plataforma' && <PlatformHealthTab />}
      </div>
    </div>
  );
}
