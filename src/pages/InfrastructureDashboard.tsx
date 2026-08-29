import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, AlertTriangle, Activity, Gauge } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-md shadow-primary/10">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Sistemas e Alertas
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              Supervisão global da infraestrutura e central de incidentes
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
          <TabsList className="grid w-full sm:w-[460px] grid-cols-3 p-1 bg-muted/60 rounded-xl border border-border/40">
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
            <TabsTrigger
              value="plataforma"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-indigo-500 font-bold transition-all"
            >
              <Gauge className="w-4 h-4 mr-2" />
              Plataforma
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conteúdo Dinâmico da Aba Ativa */}
      <div className="w-full">
        {activeTab === 'sistemas' && (
          <MonitoringWrapper
            externalMachineId={externalMachineId}
            onClearExternalMachine={handleClearExternalMachine}
          />
        )}
        {activeTab === 'alertas' && <AlertsDashboardWrapper onAlertClick={handleAlertClick} />}
        {activeTab === 'plataforma' && <PlatformHealthTab />}
      </div>
    </div>
  );
}
