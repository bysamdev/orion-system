import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';
import { DeviceItem } from '@/hooks/useDeviceInventory';

interface AssetTopologyGraphProps {
  devices: DeviceItem[];
}

export const AssetTopologyGraph: React.FC<AssetTopologyGraphProps> = ({ devices }) => {
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);

  // Simple topology layout categorization
  const gateways = devices.filter(d => d.device_type === 'Servidor' || d.device_type === 'server' || d.hostname?.toLowerCase().includes('fw') || d.hostname?.toLowerCase().includes('gw'));
  const switches = devices.filter(d => d.device_type === 'switch' || d.hostname?.toLowerCase().includes('sw'));
  const endpoints = devices.filter(d => !gateways.includes(d) && !switches.includes(d));

  return (
    <Card className="border-border/40 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden min-h-[600px] flex flex-col">
      <CardHeader className="p-5 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          Topologia de Rede
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-6 flex flex-col gap-8 items-center bg-muted/5 relative overflow-auto">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />
        
        {/* Gateways Layer */}
        <div className="w-full flex flex-col items-center gap-4 z-10">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gateways & Edge</h3>
          <div className="flex flex-wrap justify-center gap-6">
            {gateways.length > 0 ? gateways.map(d => (
              <TopologyNode key={d.id} device={d} onClick={() => setSelectedDevice(d)} />
            )) : <div className="text-sm text-muted-foreground">Nenhum gateway detectado</div>}
          </div>
        </div>

        {/* Core/Dist/Access Layer */}
        <div className="w-full flex flex-col items-center gap-4 z-10 mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Switches & Core</h3>
          <div className="flex flex-wrap justify-center gap-6">
            {switches.length > 0 ? switches.map(d => (
              <TopologyNode key={d.id} device={d} onClick={() => setSelectedDevice(d)} />
            )) : <div className="text-sm text-muted-foreground">Nenhum switch detectado</div>}
          </div>
        </div>

        {/* Endpoints Layer */}
        <div className="w-full flex flex-col items-center gap-4 z-10 mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Endpoints (Computadores / Notebooks)</h3>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
            {endpoints.map(d => (
              <TopologyNode key={d.id} device={d} onClick={() => setSelectedDevice(d)} small />
            ))}
            {endpoints.length === 0 && <div className="text-sm text-muted-foreground">Nenhum endpoint detectado</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const TopologyNode = ({ device, onClick, small = false }: { device: DeviceItem; onClick: () => void; small?: boolean }) => {
  const isOnline = device.status === 'online';
  
  return (
    <div 
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer hover:border-primary/50 transition-all bg-card shadow-sm hover:shadow-md ${small ? 'w-28' : 'w-36'}`}
    >
      <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      <Network className={`mb-2 text-muted-foreground ${small ? 'w-6 h-6' : 'w-8 h-8'}`} />
      <span className="text-xs font-semibold text-center truncate w-full" title={device.hostname || device.name}>
        {device.hostname || device.name || 'Desconhecido'}
      </span>
      <span className="text-[9px] text-muted-foreground font-mono mt-1">{device.ip_address || device.local_ip || 'Sem IP'}</span>
    </div>
  );
};
