import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Cpu, HardDrive, Monitor, Network, Battery, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pct, formatBytes } from '@/hooks/useMonitoring';
import type { MachineWithMetric, HardwareRow } from '@/hooks/useMonitoring';

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
  cpu_model?: string | null;
  gpu?: string | null;
  disks?: Array<{ mountpoint?: string; mount_point?: string; path?: string; name?: string; fs_type?: string; fstype?: string; file_system?: string; media_type?: string; used?: number; total?: number; size?: number }>;
  network_interfaces?: Array<{ name?: string; interface_name?: string; mac?: string; mac_address?: string; ips?: string[]; ip?: string; ip_address?: string }>;
  battery_info?: { has_battery: boolean; percent?: number; plugged_in?: boolean };
}

interface Props {
  machine: MachineWithMetric | null;
  hardware: HardwareDetail | HardwareRow | undefined | null;
  isOnline?: boolean;
}

export const InventoryTab: React.FC<Props> = ({ machine, hardware: hw, isOnline = true }) => {
  const battery = machine?.battery_info ?? (hw as any)?.battery_info;
  const rawDisks = (hw as any)?.disks;
  const rawIfaces = (hw as any)?.network_interfaces;
  const diskUsagePct = pct(machine?.disk_used, machine?.disk_total);

  return (
    <div className="space-y-6">
      {/* Base hardware */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-indigo-500" />
            Hardware Base &amp; Componentes
          </h3>
          <span className="text-[10px] text-muted-foreground">Especificações do Host</span>
        </div>

        <div className="bg-muted/15 border border-border/40 rounded-xl p-4 divide-y divide-border/20">
          <InfoRow icon={Cpu} label="Processador" value={hw?.cpu_model || 'Não identificado'} />
          <InfoRow icon={Monitor} label="Controlador Gráfico (GPU)" value={hw?.gpu || 'Integrado / Básico'} />
          <InfoRow icon={HardDrive} label="Memória RAM Total" value={formatBytes(machine?.ram_total ?? null)} />
          {battery?.has_battery && (
            <InfoRow
              icon={battery.plugged_in ? Zap : Battery}
              label="Bateria"
              value={`${battery.percent ?? 0}% ${battery.plugged_in ? '(Carregando)' : '(Na bateria)'}`}
            />
          )}
        </div>
      </section>

      {/* Disks & Partitions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
            <HardDrive className="w-4 h-4 text-amber-500" />
            Armazenamento &amp; Discos Particionados
          </h3>
          <span className="text-[10px] text-muted-foreground">Volumes físicos e lógicos</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.isArray(rawDisks) && rawDisks.length > 0 ? (
            rawDisks.map((d: any, idx: number) => {
              const mount = d.mountpoint || d.mount_point || d.path || d.name || `Volume #${idx + 1}`;
              const fs = d.fs_type || d.fstype || d.file_system || '';
              // media_type: "SSD" ou "HD", resolvido pelo agente via WMI
              // MSFT_PhysicalDisk (ver orion-agent/collector/disk_media_windows.go)
              // — tipo de MÍDIA (hardware), não confundir com fs (sistema
              // de arquivos, NTFS/exFAT/etc). Mostrado no lugar do
              // sistema de arquivos aqui a pedido explícito: mídia importa
              // mais pro diagnóstico de desempenho do que o filesystem.
              // Cai pro filesystem (ou "Desconhecido") só se o agente
              // ainda não resolveu o tipo de mídia dessa unidade (rede
              // mapeada, disco virtual, ou versão antiga do agente).
              const midia = d.media_type || fs || 'Desconhecido';
              const used = d.used ?? 0;
              const total = d.total ?? d.size ?? 0;
              const diskPct = pct(used, total);
              return (
                <Card key={idx} className="p-4 bg-muted/15 border-border/40 space-y-3 shadow-none hover:bg-muted/25 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">{mount}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{midia}</span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold font-mono",
                        diskPct > 90
                          ? "text-red-500 border-red-500/30 bg-red-500/10"
                          : diskPct > 75
                          ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                          : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                      )}
                    >
                      {diskPct}% em uso
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <Progress
                      value={diskPct}
                      className={cn(
                        "h-2",
                        diskPct > 90
                          ? "[&>div]:bg-red-500"
                          : diskPct > 75
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-primary"
                      )}
                    />
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                      <span>Usado: <strong className="text-foreground">{formatBytes(used)}</strong></span>
                      <span>Livre: <strong className="text-foreground">{formatBytes(Math.max(0, total - used))}</strong></span>
                      <span>Total: <strong className="text-foreground">{formatBytes(total)}</strong></span>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="p-4 bg-muted/15 border-border/40 space-y-3 shadow-none sm:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Volume Principal do Sistema (C:)</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Partição Ativa</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold font-mono",
                    diskUsagePct > 90
                      ? "text-red-500 border-red-500/30 bg-red-500/10"
                      : diskUsagePct > 75
                      ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                      : "text-emerald-600 border-emerald-500/30 bg-emerald-500/5"
                  )}
                >
                  {diskUsagePct}% em uso
                </Badge>
              </div>

              <div className="space-y-1.5">
                <Progress
                  value={diskUsagePct}
                  className={cn(
                    "h-2",
                    diskUsagePct > 90
                      ? "[&>div]:bg-red-500"
                      : diskUsagePct > 75
                      ? "[&>div]:bg-amber-500"
                      : "[&>div]:bg-primary"
                  )}
                />
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Usado: <strong className="text-foreground">{formatBytes(machine?.disk_used)}</strong></span>
                  <span>
                    Livre:{' '}
                    <strong className="text-foreground">
                      {machine?.disk_total && machine?.disk_used != null
                        ? formatBytes(Math.max(0, machine.disk_total - machine.disk_used))
                        : '–'}
                    </strong>
                  </span>
                  <span>Total: <strong className="text-foreground">{formatBytes(machine?.disk_total)}</strong></span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Network interfaces */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
            <Network className="w-4 h-4 text-sky-500" />
            Adaptadores de Rede &amp; Conectividade
          </h3>
          <span className="text-[10px] text-muted-foreground">Interfaces físicas e virtuais detectadas</span>
        </div>

        <Card className="border-border/40 bg-card/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 border-b border-border/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Interface de Rede</th>
                  <th className="px-4 py-2.5">Endereço IP (IPv4 / IPv6)</th>
                  <th className="px-4 py-2.5">Endereço MAC</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {Array.isArray(rawIfaces) && rawIfaces.length > 0 ? (
                  rawIfaces.map((iface: any, idx: number) => {
                    const name = iface.name || iface.interface_name || `Interface ${idx + 1}`;
                    const mac = iface.mac || iface.mac_address || '–';
                    const ips: string[] = Array.isArray(iface.ips)
                      ? iface.ips
                      : iface.ip
                      ? [iface.ip]
                      : iface.ip_address
                      ? [iface.ip_address]
                      : [];

                    return (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                          <Network className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                          <span>{name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {ips.length > 0 ? (
                              ips.map((ip, i) => (
                                <Badge key={i} variant="outline" className="font-mono text-[10px] bg-muted/40 text-foreground">
                                  {ip}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-[11px]">N/A</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {mac}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-semibold",
                              isOnline
                                ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                                : "text-muted-foreground border-border/30"
                            )}
                          >
                            {isOnline ? "Conectado" : "Offline"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <Network className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                      <span>Adaptador Principal do Host</span>
                    </td>
                    <td className="px-4 py-3">
                      {machine?.ip_address ? (
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/40 text-foreground">
                          {machine.ip_address}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Não identificado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {machine?.mac_address || '–'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-semibold",
                          isOnline
                            ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                            : "text-muted-foreground border-border/30"
                        )}
                      >
                        {isOnline ? "Conectado" : "Offline"}
                      </Badge>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
};

