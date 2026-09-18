# Auditoria da arquitetura de monitoramento — 18/09/2026

Primeira etapa do card "Reestruturação da Arquitetura de Monitoramento". O card
pede que a arquitetura real seja documentada, e comprovada pelo código, antes
de qualquer mudança. Tudo aqui foi verificado no repositório e no banco de
produção nesta data.

## 1. Fluxo real encontrado

Há **dois caminhos independentes**, e só um deles passa pelo servidor de
monitoramento.

### Caminho A — telemetria das máquinas (não passa pelo servidor)

```
Orion Agent (Windows)
   │  POST /api/monitoring/machines/heartbeat   a cada 300 s (estação) / 60 s (servidor)
   │  GET  /api/monitoring/commands/poll        a cada 30 s
   ▼
API Go na Vercel (handler/mon_handlers.go)
   ▼
Supabase (Postgres)
   ├── machines                 snapshot atual: cpu, ram, disco, uptime, last_seen, status
   ├── machine_metrics_history  série do gráfico: 1 ponto a cada 15 min (estação) / 3 min (servidor)
   ├── machine_hardware         inventário (só grava quando muda)
   └── machine_alerts           alertas de CPU, RAM, disco, antivírus e firewall
   ▼
Painel Orion (lê pela API Go: /machines, /machines/{id}/metrics)
```

- Os intervalos vêm de `collectionIntervalSeconds`
  (`handler/mon_handlers.go`) e do laço em `orion-agent/service/windows.go`.
- O gráfico de performance do painel lê `machine_metrics_history`
  (`lib.MetricsHistory`), **não** o Prometheus.
- Online/offline: `last_seen` gravado pelo heartbeat, e o cron
  `mark-machines-offline` (a cada minuto) marca quem parou de reportar. Fonte
  única, já no Supabase.

### Caminho B — sondagem de sites e links (depende do servidor)

```
orion-bridge (monitoring/bridge.mjs, no servidor Debian), a cada 15 s:
   1. RPC get_all_monitoring_targets  → escreve targets/*.json
   2. Prometheus faz scrape:
        blackbox_http / blackbox_icmp  → sites e links
        orion_agents → <IP local da máquina>:9182/metrics  (exporter embutido no agente)
   3. lê probe_success / probe_duration do Prometheus
   4. RPC update_telemetry_status → grava status em monitored_endpoints / network_links
```

O **bridge não recebe telemetria dos agentes**. Ele só sincroniza alvos e
devolve o resultado dos probes ao Supabase.

O job `orion_agents` do Prometheus tenta buscar métricas direto no agente, no
IP **local** da máquina, porta 9182. Isso só alcança máquinas na mesma rede do
servidor Debian. Máquina de cliente atrás de NAT não é alcançável — para a
frota de clientes, esse scrape não traz nada.

## 2. Por que tudo continuou funcionando com o servidor desligado

Porque o caminho A, que é o que o painel de máquinas usa, nunca passou pelo
servidor. O agente fala com a API na Vercel, e a API grava no Supabase.

### O que de fato depende do servidor de monitoramento

| Funcionalidade | Efeito com o servidor desligado |
|---|---|
| Status de sites (`monitored_endpoints`) | **Congela no último valor.** O painel continua mostrando "online" sem nenhum aviso — ver problema P3 |
| Status e latência de links (`network_links`) | Congela (hoje não há links cadastrados) |
| Histórico de uptime de sites (`lib/grafana_metrics.go`, via proxy do Grafana) | Indisponível |
| Dashboards do Grafana e NOC | Indisponíveis |
| Regras de alerta do Grafana → webhook `/alerts/webhook/grafana` | Não disparam |
| Logs no Loki | Não coletados |
| Métricas das máquinas da rede local via `:9182` | Sem coleta |

Nada do núcleo do produto depende do servidor: chamados, inventário, comandos
remotos, status online/offline e gráfico de performance seguem funcionando.

## 3. Carga no Supabase

### Escritas por requisição (medidas no código)

| Origem | Frequência por máquina | Escritas |
|---|---|---|
| Heartbeat | 1 / 300 s | `api_keys.last_used_at` (1) + `machines` upsert (1) + snapshot (1) + status (1) + ponto histórico (1 a cada 3 heartbeats) ≈ **4,3** |
| Poll de comandos | 1 / 30 s | `api_keys.last_used_at` (**1**) |
| Bridge (independe da frota) | 6 sites a cada 15 s | 1 por site por ciclo |

### Projeção para 400 estações

| Origem | Escritas/min | Escritas/dia | Parcela |
|---|---|---|---|
| `api_keys.last_used_at` (heartbeat + poll) | 880 | 1.267.200 | **~75%** |
| `machines` (upsert + status repetido) | 160 | 230.400 | ~14% |
| `machines` snapshot de CPU/RAM/disco | 80 | 115.200 | ~7% |
| `machine_metrics_history` | 27 | 38.400 | ~2% |
| Bridge (`monitored_endpoints`, 6 sites) | 24 | 34.560 | ~2% |
| **Total** | **~1.170** | **~1,69 milhão** | |

Requisições: 80 heartbeats/min (115 mil/dia) e 800 polls/min (1,15 milhão/dia).

### O que isso mostra

1. **Telemetria de verdade é ~9% das escritas.** Snapshot e série histórica
   somam ~107 escritas/min em 400 máquinas, depois do corte da série para um
   ponto a cada 15 min (migration 20260917160000). Tirá-la do Supabase, que é o
   objetivo central do card, reduz pouco.
2. **75% da carga é contabilidade de credencial.** Cada heartbeat e cada poll
   regravam `last_used_at` na chave da empresa. Todas as máquinas de uma
   empresa usam a **mesma linha** — 400 máquinas de um cliente disputariam o
   lock de uma única linha 880 vezes por minuto.
3. **Na medição real de hoje, o maior escritor é o bridge**: 834 mil updates
   em `monitored_endpoints`, para 6 linhas, porque ele regrava todos os sites a
   cada 15 s mesmo sem mudança.

## 4. Problemas encontrados

| # | Problema | Gravidade |
|---|---|---|
| P1 | `last_used_at` regravado a cada heartbeat e a cada poll, numa linha compartilhada por toda a frota da empresa | Alta em escala |
| P2 | Bridge regrava o status de todos os sites a cada 15 s, mesmo sem mudança | Média |
| P3 | Com o servidor desligado, status de site congela em "online" no painel, sem aviso de dado velho | **Alta** — o painel afirma algo que não sabe |
| P4 | `UpdateMachineStatus` regrava o mesmo status a cada heartbeat | Baixa |
| P5 | Job `orion_agents` faz scrape por IP local; não alcança clientes atrás de NAT | Média — arquitetural |
| P6 | `useWebMonitoring` assina Realtime de `monitored_endpoints`, mas a tabela não está na publicação `supabase_realtime` (só `audit_log` está) — a assinatura nunca recebe nada | Baixa — código morto |
| P7 | Bridge usa a chave `service_role` (já documentado; decisão tomada) | Registro |

## 5. Recomendação sobre a arquitetura-alvo do card

O card propõe que o agente passe a enviar telemetria para o bridge, no
servidor Debian, e o Prometheus vire o armazenamento do histórico.

Os números pedem cautela antes disso:

- **O ganho é pequeno**: ~9% das escritas. Os outros ~91% ficam no Supabase de
  qualquer jeito, porque são status, inventário e autenticação — exatamente os
  dados de negócio que o card quer manter lá.
- **O custo é confiabilidade**: o servidor Debian já ficou dias desligado. Hoje
  isso não afeta o gráfico de performance; depois da mudança, afetaria. As
  prioridades do próprio card põem confiabilidade antes de escalabilidade.
- **Exige infraestrutura nova de entrada**: o agente teria de alcançar o bridge
  pela internet (Cloudflare Tunnel), com autenticação por agente, e o scrape
  por IP local teria de sair.

Proposta: fazer primeiro os cortes baratos (P1, P2, P4), que tiram **~85% das
escritas** sem mudar a arquitetura, corrigir P3, e só então decidir se mover
o histórico para o Prometheus ainda compensa.

## 6. Pendências que exigem acesso ao servidor

Não verificáveis daqui, por falta de acesso ao Debian:

- retenção e volume efetivos do Prometheus (o compose declara 30 dias e volume
  persistente `prometheus_data`);
- quais alvos `:9182` respondem de fato no scrape;
- exposição real pelo Cloudflare Tunnel (o compose publica Grafana em
  `0.0.0.0:3000`; os demais só em `127.0.0.1`).
