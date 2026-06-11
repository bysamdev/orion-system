import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cpu, HardDrive, Monitor, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pct } from '@/hooks/useMonitoring';
import type { MachineWithMetric } from '@/hooks/useMonitoring';

function bytes(n: number | null): string {
  if (!n) return '–';
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${n} B`;
}

function InfoRow({ label, value, icon: Icon }: { label: React.ReactNode; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex justify-between items-center py-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-semibold text-foreground text-right max-w-[60%] truncate">
        {value ?? '–'}
      </span>
    </div>
  );
}

interface HardwareDetail {
  cpu_model?: string;
  gpu?: string;
  disks?: Array<{ mountpoint: string; fs_type: string; used: number; total: number }>;
  network_interfaces?: Array<{ name: string; mac: string; ips: string[] }>;
}

interface Props {
  machine: MachineWithMetric | null;
  hardware: HardwareDetail | undefined;
}

export const InventoryTab: React.FC<Props> = ({ machine, hardware: hw }) => (
  <div className="space-y-8">
    {/* Base hardware */}
    <section className="space-y-4">
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Hardware Base</h3>
      <div className="bg-muted/10 border border-border/40 rounded-xl p-4 space-y-1">
        <InfoRow icon={Cpu} label="Processador" value={hw?.cpu_model} />
        <InfoRow icon={Monitor} label="Gráficos (GPU)" value={hw?.gpu} />
        <InfoRow icon={HardDrive} label="Memória Total" value={bytes(machine?.ram_total ?? null)} />
      </div>
    </section>

    {/* Disks */}
    <section className="space-y-4">
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Armazenamento &amp; Partições</h3>
      <div className="space-y-3">
        {Array.isArray(hw?.disks) && hw!.disks.length > 0 ? (
          hw!.disks.map((d, idx) => (
            <Card key={idx} className="p-4 border-border/40 bg-muted/5 shadow-none">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold">{d.mountpoint}</span>
                </div>
                <span className="text-[10px] bg-background px-2 py-0.5 rounded border border-border/40 text-muted-foreground">
                  {d.fs_type}
                </span>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all rounded-full',
                      pct(d.used, d.total) > 90 ? 'bg-red-500' : pct(d.used, d.total) > 70 ? 'bg-amber-500' : 'bg-primary',
                    )}
                    style={{ width: `${pct(d.used, d.total)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-medium">
                  <span className="text-muted-foreground">Uso: {bytes(d.used)}</span>
                  <span className={cn('font-bold', pct(d.used, d.total) > 90 ? 'text-red-500' : 'text-foreground')}>
                    {pct(d.used, d.total)}% de {bytes(d.total)}
                  </span>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <p className="text-center text-xs text-muted-foreground py-4">Sem informações de partições detalhadas.</p>
        )}
      </div>
    </section>

    {/* Network interfaces */}
    <section className="space-y-4">
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Interfaces de Rede</h3>
      <div className="space-y-2">
        {Array.isArray(hw?.network_interfaces) && hw!.network_interfaces.length > 0 ? (
          hw!.network_interfaces.map((iface, idx) => (
            <div key={idx} className="bg-muted/10 border border-border/40 rounded-xl p-4 transition-all hover:bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Network className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold">{iface.name}</span>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">{iface.mac}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {iface.ips?.map((ip, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] font-mono bg-background/50">{ip}</Badge>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-xs text-muted-foreground py-4">Dados de rede indisponíveis.</p>
        )}
      </div>
    </section>
  </div>
);
