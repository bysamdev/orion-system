import { describe, expect, it } from 'vitest';
import type { MachineWithMetric } from '@/hooks/useMonitoring';
import { contarPor, percentual, problemasDaMaquina, resumirMonitoramento, temProblema } from './monitoramento';

const maquina = (extra: Partial<MachineWithMetric>): MachineWithMetric => ({
  id: 'm', group_id: null, company_id: null, hostname: 'PC', ip_address: null, os: 'Windows 11', os_version: null,
  status: 'online', last_seen: null, agent_version: '1.1.32', created_at: '',
  cpu_usage: 10, ram_total: 100, ram_used: 50, disk_total: 100, disk_used: 50, uptime: 1, collected_at: null,
  ...extra,
});

describe('relatório de monitoramento', () => {
  it('calcula percentual e ignora total zerado', () => {
    expect(percentual(45, 100)).toBe(45);
    expect(percentual(1, 0)).toBeNull();
    expect(percentual(null, 100)).toBeNull();
  });

  it('marca disco e memória a partir de 90%', () => {
    const p = problemasDaMaquina(maquina({ disk_used: 91, ram_used: 89 }));
    expect(p.discoCritico).toBe(true);
    expect(p.memoriaCritica).toBe(false);
  });

  it('não acusa segurança quando o agente não informa', () => {
    const p = problemasDaMaquina(maquina({}));
    expect(p.semAntivirus).toBe(false);
    expect(p.firewallDesligado).toBe(false);
    expect(temProblema(p)).toBe(false);
  });

  it('acusa antivírus inativo, firewall desligado e atualização pendente', () => {
    const p = problemasDaMaquina(maquina({
      security_info: { antivirus: [{ name: 'Defender', active: false, updated: true }], firewall_active: false },
      update_status: { pending_count: 3 },
    }));
    expect(p.semAntivirus).toBe(true);
    expect(p.firewallDesligado).toBe(true);
    expect(p.atualizacoesPendentes).toBe(3);
    expect(temProblema(p)).toBe(true);
  });

  it('conta agrupando vazios e ordena do maior para o menor', () => {
    expect(contarPor([{ os: 'A' }, { os: 'B' }, { os: 'A' }, { os: null }], i => i.os)).toEqual([
      { nome: 'A', total: 2 }, { nome: 'B', total: 1 }, { nome: 'Não identificado', total: 1 },
    ]);
  });

  it('resume máquinas, links e sites', () => {
    const r = resumirMonitoramento(
      [maquina({}), maquina({ status: 'offline' })],
      [{ status: 'online', latency_ms: 10 }, { status: 'online', latency_ms: 30 }, { status: 'offline', latency_ms: null }],
      [{ status: 'online', diagnostics: { uptime_24h_pct: 100 } }, { status: 'offline', diagnostics: { uptime_24h_pct: 90 } }],
    );
    expect(r.maquinas).toEqual({ total: 2, online: 1, offline: 1, comProblema: 1 });
    expect(r.links).toEqual({ total: 3, online: 2, offline: 1, latenciaMedia: 20 });
    expect(r.sites).toEqual({ total: 2, online: 1, offline: 1, disponibilidadeMedia: 95 });
  });
});
