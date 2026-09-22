import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Monitor, ShieldAlert, HardDrive, Network, Globe, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAllMachines } from '@/hooks/useMonitoring';
import { useNetworkLinks } from '@/hooks/useNetworkLinks';
import { useWebEndpoints } from '@/hooks/useWebMonitoring';
import {
  contarPor, percentual, problemasDaMaquina, resumirMonitoramento, rotuloDispositivo, temProblema,
} from '@/lib/reports/monitoramento';

const TITULO = 'text-sm font-semibold tracking-tight text-foreground flex items-center gap-2';
const TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as const;
const TOOLTIP = { backgroundColor: 'hsl(var(--background))', borderRadius: '8px' } as const;

interface Props {
  companyFilter: string;
}

const Numero: React.FC<{ rotulo: string; valor: React.ReactNode; detalhe?: string; alerta?: boolean }> = ({ rotulo, valor, detalhe, alerta }) => (
  <div className="rounded-lg border border-border/50 bg-card p-4">
    <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
    <p className={`text-2xl font-bold tabular-nums ${alerta ? 'text-destructive' : 'text-foreground'}`}>{valor}</p>
    {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
  </div>
);

const GraficoDeBarras: React.FC<{ dados: { nome: string; total: number }[] }> = ({ dados }) => (
  <div className="h-[240px] w-full">
    {dados.length === 0 ? (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" allowDecimals={false} tick={TICK} />
          <YAxis type="category" dataKey="nome" width={130} tick={TICK} />
          <Tooltip contentStyle={TOOLTIP} />
          <Bar dataKey="total" name="Máquinas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
);

// Aba "Monitoramento" de Relatórios: máquinas, inventário, segurança, links
// de rede e sites. É uma foto do estado atual (não depende do período
// escolhido); respeita o filtro de empresa onde o dado tem empresa.
export const RelatorioDeMonitoramento: React.FC<Props> = ({ companyFilter }) => {
  const { data: todasMaquinas = [], isLoading: carregandoMaquinas } = useAllMachines();
  const { data: todosLinks = [], isLoading: carregandoLinks } = useNetworkLinks();
  const { data: sites = [], isLoading: carregandoSites } = useWebEndpoints();

  const maquinas = useMemo(
    () => companyFilter === 'all' ? todasMaquinas : todasMaquinas.filter(m => m.company_id === companyFilter),
    [todasMaquinas, companyFilter],
  );
  const links = useMemo(
    () => companyFilter === 'all' ? todosLinks : todosLinks.filter(l => l.company_id === companyFilter),
    [todosLinks, companyFilter],
  );

  const resumo = useMemo(() => resumirMonitoramento(maquinas, links, sites), [maquinas, links, sites]);
  const porSistema = useMemo(() => contarPor(maquinas, m => m.os).slice(0, 8), [maquinas]);
  const porTipo = useMemo(() => contarPor(maquinas, m => rotuloDispositivo(m.device_type)), [maquinas]);
  const porVersao = useMemo(() => contarPor(maquinas, m => m.agent_version && `v${m.agent_version}`).slice(0, 8), [maquinas]);
  const comProblema = useMemo(
    () => maquinas
      .map(m => ({ m, p: problemasDaMaquina(m) }))
      .filter(({ p }) => temProblema(p))
      .sort((a, b) => Number(b.p.offline) - Number(a.p.offline) || a.m.hostname.localeCompare(b.m.hostname)),
    [maquinas],
  );

  if (carregandoMaquinas || carregandoLinks || carregandoSites) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const { maquinas: mq, seguranca, recursos } = resumo;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Numero rotulo="Máquinas" valor={mq.total} detalhe={`${mq.online} online · ${mq.offline} offline`} />
        <Numero rotulo="Máquinas com problema" valor={mq.comProblema} alerta={mq.comProblema > 0} detalhe="offline, disco, memória, segurança ou atualização" />
        <Numero rotulo="Links de rede" valor={resumo.links.total} alerta={resumo.links.offline > 0}
          detalhe={`${resumo.links.offline} offline${resumo.links.latenciaMedia != null ? ` · ${resumo.links.latenciaMedia} ms de média` : ''}`} />
        <Numero rotulo="Sites monitorados" valor={resumo.sites.total} alerta={resumo.sites.offline > 0}
          detalhe={`${resumo.sites.offline} fora do ar${resumo.sites.disponibilidadeMedia != null ? ` · ${resumo.sites.disponibilidadeMedia}% em 24h` : ''}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-sm border-border/40">
          <CardHeader><CardTitle className={TITULO}><Monitor className="w-4 h-4" /> Sistema operacional</CardTitle></CardHeader>
          <CardContent><GraficoDeBarras dados={porSistema} /></CardContent>
        </Card>
        <Card className="shadow-sm border-border/40">
          <CardHeader><CardTitle className={TITULO}><Monitor className="w-4 h-4" /> Tipo de dispositivo</CardTitle></CardHeader>
          <CardContent><GraficoDeBarras dados={porTipo} /></CardContent>
        </Card>
        <Card className="shadow-sm border-border/40">
          <CardHeader><CardTitle className={TITULO}><Monitor className="w-4 h-4" /> Versão do agente</CardTitle></CardHeader>
          <CardContent><GraficoDeBarras dados={porVersao} /></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/40">
          <CardHeader><CardTitle className={TITULO}><ShieldAlert className="w-4 h-4" /> Segurança</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Numero rotulo="Sem antivírus ativo" valor={seguranca.semAntivirus} alerta={seguranca.semAntivirus > 0} />
            <Numero rotulo="Firewall desligado" valor={seguranca.firewallDesligado} alerta={seguranca.firewallDesligado > 0} />
            <Numero rotulo="Sem BitLocker" valor={seguranca.semBitlocker} />
            <Numero rotulo="Com atualizações pendentes" valor={seguranca.comAtualizacoes} detalhe={`${seguranca.reinicioPendente} aguardando reinício`} />
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/40">
          <CardHeader><CardTitle className={TITULO}><HardDrive className="w-4 h-4" /> Recursos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Numero rotulo="Disco acima de 90%" valor={recursos.discoCritico} alerta={recursos.discoCritico > 0} />
            <Numero rotulo="Memória acima de 90%" valor={recursos.memoriaCritica} alerta={recursos.memoriaCritica > 0} />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/40">
        <CardHeader><CardTitle className={TITULO}><ShieldAlert className="w-4 h-4" /> Máquinas que precisam de atenção ({comProblema.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {comProblema.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma máquina com problema.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Sistema</TableHead>
                  <TableHead>Disco</TableHead>
                  <TableHead>Problemas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comProblema.slice(0, 50).map(({ m, p }) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.hostname}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.os ?? '—'}</TableCell>
                    <TableCell className="tabular-nums text-xs">{percentual(m.disk_used, m.disk_total) ?? '—'}{percentual(m.disk_used, m.disk_total) != null && '%'}</TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      {p.offline && <Badge variant="destructive">Offline</Badge>}
                      {p.discoCritico && <Badge variant="outline">Disco cheio</Badge>}
                      {p.memoriaCritica && <Badge variant="outline">Memória alta</Badge>}
                      {p.semAntivirus && <Badge variant="outline">Sem antivírus</Badge>}
                      {p.firewallDesligado && <Badge variant="outline">Firewall off</Badge>}
                      {p.reinicioPendente && <Badge variant="outline">Reinício pendente</Badge>}
                      {p.atualizacoesPendentes > 0 && <Badge variant="outline">{p.atualizacoesPendentes} atualizações</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/40">
          <CardHeader><CardTitle className={TITULO}><Network className="w-4 h-4" /> Links de rede</CardTitle></CardHeader>
          <CardContent className="p-0">
            {links.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhum link cadastrado.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Link</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Latência</TableHead></TableRow></TableHeader>
                <TableBody>
                  {links.map(l => (
                    <TableRow key={l.id}>
                      <TableCell><span className="font-medium">{l.name}</span><span className="block text-xs text-muted-foreground">{l.company_name ?? l.ip_or_host}</span></TableCell>
                      <TableCell><Badge variant={l.status === 'online' ? 'secondary' : 'destructive'}>{l.status === 'online' ? 'Online' : l.status === 'offline' ? 'Offline' : 'Aguardando'}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{l.latency_ms != null ? `${l.latency_ms} ms` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/40">
          <CardHeader><CardTitle className={TITULO}><Globe className="w-4 h-4" /> Sites monitorados</CardTitle></CardHeader>
          <CardContent className="p-0">
            {sites.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhum site monitorado.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Disponível 24h</TableHead></TableRow></TableHeader>
                <TableBody>
                  {sites.map(s => (
                    <TableRow key={s.id}>
                      <TableCell><span className="font-medium">{s.name}</span><span className="block text-xs text-muted-foreground truncate max-w-[220px]">{s.url_or_ip}</span></TableCell>
                      <TableCell><Badge variant={s.status === 'online' ? 'secondary' : s.status === 'offline' ? 'destructive' : 'outline'}>{s.status === 'online' ? 'No ar' : s.status === 'offline' ? 'Fora do ar' : s.status === 'paused' ? 'Pausado' : 'Aguardando'}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{s.diagnostics?.uptime_24h_pct != null ? `${s.diagnostics.uptime_24h_pct}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RelatorioDeMonitoramento;
