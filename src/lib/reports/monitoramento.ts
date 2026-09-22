// Números do relatório de monitoramento (aba Monitoramento em Relatórios).
// Funções puras sobre o que as telas de monitoramento já carregam: máquinas
// (/api/monitoring/machines), links de rede e sites monitorados.

import type { MachineWithMetric } from '@/hooks/useMonitoring';

export interface LinkParaRelatorio {
  status: string;
  latency_ms: number | null;
  company_id?: string | null;
}

export interface SiteParaRelatorio {
  status: string;
  diagnostics?: { uptime_24h_pct: number | null } | null;
}

export interface Contagem {
  nome: string;
  total: number;
}

// Acima disto o disco ou a memória entram como problema.
export const LIMITE_USO_CRITICO = 90;

export function percentual(usado: number | null | undefined, total: number | null | undefined): number | null {
  if (!total || total <= 0 || usado == null) return null;
  return Math.round((usado / total) * 100);
}

export interface ProblemasDaMaquina {
  offline: boolean;
  discoCritico: boolean;
  memoriaCritica: boolean;
  semAntivirus: boolean;
  firewallDesligado: boolean;
  semBitlocker: boolean;
  reinicioPendente: boolean;
  atualizacoesPendentes: number;
}

export function problemasDaMaquina(m: MachineWithMetric): ProblemasDaMaquina {
  const antivirus = m.security_info?.antivirus;
  return {
    offline: m.status !== 'online',
    discoCritico: (percentual(m.disk_used, m.disk_total) ?? 0) >= LIMITE_USO_CRITICO,
    memoriaCritica: (percentual(m.ram_used, m.ram_total) ?? 0) >= LIMITE_USO_CRITICO,
    // Sem informação de segurança não conta como problema: o agente pode ser
    // de uma versão que ainda não coleta isso.
    semAntivirus: Array.isArray(antivirus) && !antivirus.some(a => a.active),
    firewallDesligado: m.security_info?.firewall_active === false,
    semBitlocker: m.security_info?.bitlocker_active === false,
    reinicioPendente: m.update_status?.reboot_required === true,
    atualizacoesPendentes: m.update_status?.pending_count ?? 0,
  };
}

export function temProblema(p: ProblemasDaMaquina): boolean {
  return p.offline || p.discoCritico || p.memoriaCritica || p.semAntivirus
    || p.firewallDesligado || p.reinicioPendente || p.atualizacoesPendentes > 0;
}

export function contarPor<T>(itens: T[], chave: (item: T) => string | null | undefined, vazio = 'Não identificado'): Contagem[] {
  const mapa = new Map<string, number>();
  for (const item of itens) {
    const nome = chave(item)?.trim() || vazio;
    mapa.set(nome, (mapa.get(nome) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

const ROTULO_DISPOSITIVO: Record<string, string> = {
  desktop: 'Desktop',
  notebook: 'Notebook',
  server: 'Servidor',
};

export function rotuloDispositivo(tipo: string | null | undefined): string {
  return (tipo && ROTULO_DISPOSITIVO[tipo]) || 'Não identificado';
}

export interface ResumoDeMonitoramento {
  maquinas: { total: number; online: number; offline: number; comProblema: number };
  seguranca: { semAntivirus: number; firewallDesligado: number; semBitlocker: number; reinicioPendente: number; comAtualizacoes: number };
  recursos: { discoCritico: number; memoriaCritica: number };
  links: { total: number; online: number; offline: number; latenciaMedia: number | null };
  sites: { total: number; online: number; offline: number; disponibilidadeMedia: number | null };
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
}

export function resumirMonitoramento(
  maquinas: MachineWithMetric[],
  links: LinkParaRelatorio[],
  sites: SiteParaRelatorio[],
): ResumoDeMonitoramento {
  const problemas = maquinas.map(problemasDaMaquina);
  const conta = (f: (p: ProblemasDaMaquina) => boolean) => problemas.filter(f).length;
  const linksMedidos = links.filter(l => l.status === 'online' && l.latency_ms != null).map(l => l.latency_ms as number);
  const disponibilidade = sites
    .map(s => s.diagnostics?.uptime_24h_pct)
    .filter((v): v is number => typeof v === 'number');

  return {
    maquinas: {
      total: maquinas.length,
      online: maquinas.filter(m => m.status === 'online').length,
      offline: maquinas.filter(m => m.status !== 'online').length,
      comProblema: conta(temProblema),
    },
    seguranca: {
      semAntivirus: conta(p => p.semAntivirus),
      firewallDesligado: conta(p => p.firewallDesligado),
      semBitlocker: conta(p => p.semBitlocker),
      reinicioPendente: conta(p => p.reinicioPendente),
      comAtualizacoes: conta(p => p.atualizacoesPendentes > 0),
    },
    recursos: {
      discoCritico: conta(p => p.discoCritico),
      memoriaCritica: conta(p => p.memoriaCritica),
    },
    links: {
      total: links.length,
      online: links.filter(l => l.status === 'online').length,
      offline: links.filter(l => l.status === 'offline').length,
      latenciaMedia: media(linksMedidos),
    },
    sites: {
      total: sites.length,
      online: sites.filter(s => s.status === 'online').length,
      offline: sites.filter(s => s.status === 'offline').length,
      disponibilidadeMedia: media(disponibilidade),
    },
  };
}
