import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, AlertTriangle, Activity } from 'lucide-react';
import MonitoringWrapper from './Monitoring';
import AlertsDashboardWrapper from './AlertsDashboard';

export default function InfrastructureDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'sistemas';
  const externalMachineId = searchParams.get('machine');

  const setTab = (tab: string) => {
    setSearchParams((prev) => {
      prev.set('tab', tab);
      return prev;
    });
  };

  const handleAlertClick = (machineId: string) => {
    setSearchParams((prev) => {
      prev.set('tab', 'sistemas');
      prev.set('machine', machineId);
      return prev;
    });
  };

  const handleClearExternalMachine = () => {
    setSearchParams((prev) => {
      prev.delete('machine');
      return prev;
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-8 pt-8 pb-4 max-w-[1600px] w-full mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/10">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Sistemas e Alertas
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Monitoramento Global e Alertas
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2 p-1 bg-muted/50 rounded-xl">
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
      </div>

      <div className="flex-1 w-full relative">
        <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'sistemas' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <MonitoringWrapper 
            externalMachineId={externalMachineId} 
            onClearExternalMachine={handleClearExternalMachine} 
          />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'alertas' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <AlertsDashboardWrapper onAlertClick={handleAlertClick} />
        </div>
      </div>
    </div>
  );
}
