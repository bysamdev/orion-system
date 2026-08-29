# Escalabilidade do Orion Agent — Manual Técnico e Checklist de Produção

**Escopo:** implementação do [Plano de Escalabilidade do Orion Agent](#) aprovado em 2026-08-29 —
evoluir o Orion Agent e a infraestrutura de monitoramento de dezenas para centenas/milhares de
máquinas, mantendo Postgres como sistema de registro (Opção B do plano — sem Prometheus/Grafana,
por causa do modelo pull não alcançar máquinas de cliente atrás de NAT).

**Como ler este documento:** a seção 0 é o status por fase. A seção 1 é o manual técnico — como as
peças se encaixam depois das mudanças, para quem for mexer nisso depois. A seção 2 é o checklist de
produção. A seção 3 é o procedimento de rollback por mudança. A seção 4 lista o que ficou
deliberadamente pendente e por quê.

---

## 0. Status por fase

| Fase | Item | Status |
|---|---|---|
| 0 | Auditoria da arquitetura atual | ✅ Completa — achou e corrigiu um bloqueador real (ver §1.1) |
| 1 | Baseline e métricas atuais | 🟡 Parcial — medição real de capacidade requer rodar `loadsim` (§1.6) contra um ambiente controlado; não feito ainda |
| 2 | Contratos/API | 🟡 Parcial — teste de contrato agente↔backend existe (`handler/testdata/`); versionamento formal de schema não |
| 3 | Classificação de dispositivos | ✅ UNKNOWN, motivo, override manual, histórico |
| 4 | Políticas de coleta por tipo | ✅ Servidor 60s / estação·notebook·unknown 180s, entregue pelo backend |
| 5 | Ingestão/batching | ✅ Heartbeat em transação única, poll de comandos em lote |
| 6 | Separação Prometheus/Postgres | ✅ Opção B — consolidado em Postgres, retenção + índices |
| 7 | Alertas | ✅ Divergência de limiar (85%/90%) corrigida |
| 8 | Resiliência do agente | ✅ Buffer local, retry em poll/respond, jitter de ticker |
| 9 | Segurança (rate limit) | ✅ Centralizado em Postgres, cobre os 5 endpoints de agente |
| 10 | Observabilidade da própria plataforma | ✅ `GET /api/monitoring/platform-health` + aba "Plataforma" no dashboard |
| 11 | Testes de carga | ✅ Ferramenta pronta (`orion-agent/cmd/loadsim`) — validada localmente, não rodada contra produção |
| 12 | Rollout gradual | 🟡 Parcial — `company_id` e `agent_version` já dão a base; nenhum mecanismo de feature flag formal |
| 13 | Documentação final | ✅ Este documento |

---

## 1. Manual técnico

### 1.1. O achado que motivou a Fase 0: drift entre repositório e produção

Antes de qualquer mudança, a auditoria encontrou o Supabase de produção com `machine_metrics`
(tabela de série temporal) já removida — via uma migration aplicada diretamente no banco, nunca
commitada neste repositório — em favor de colunas de snapshot em `machines` (`cpu_usage`,
`ram_total`, ...). O código Go deste checkout ainda dependia da tabela removida em três pontos
(`InsertMetric` no heartbeat, `MachinesByGroupID`, `CriticalAlerts`), o que significava que **todo
heartbeat estava falhando** antes de conseguir atualizar status/alertas — mascarado porque o
`UpsertMachine` que grava `status='online'` roda antes do ponto de falha.

Isso foi corrigido recriando `machine_metrics` como histórico **limitado** (7 dias de retenção via
`pg_cron`, não mais ilimitado) e reescrevendo os três pontos de leitura para usar as colunas de
snapshot em `machines`. Ver commit `0398159`.

**Lição operacional:** qualquer migration aplicada direto no SQL Editor do Supabase sem
`supabase/migrations/*.sql` correspondente no repositório é dívida técnica que só aparece quando
alguém confia no repositório como fonte de verdade. Isso já aconteceu pelo menos duas vezes neste
projeto (`machine_metrics`/colunas de snapshot, e `rate_limit_counters`, ver §1.3) antes desta
sessão.

### 1.2. Fluxo de heartbeat (estado atual)

```
Orion Agent (tick, a cada N segundos — política por tipo, ver §1.4)
  │
  ├─ collector.Collect() → Payload (hardware, device_type, device_type_reason, ...)
  │
  └─ POST /api/monitoring/machines/heartbeat  (X-Agent-Key, retry 3x com backoff+jitter)
         │
         ├─ agentRateLimitAllow (Postgres, rate_limit_counters — ver §1.3)
         ├─ lib.HeartbeatUpsert (1 transação):
         │     ├─ UPSERT machines (snapshot: status, cpu/ram/disk, device_type — CASE
         │     │   preserva o valor se device_type_locked=true)
         │     ├─ INSERT machine_metrics (histórico, 7 dias de retenção)
         │     └─ INSERT machine_device_type_history (só se o tipo mudou de verdade)
         ├─ UpsertHardware (best-effort, fora da transação de propósito — ver commit 0398159)
         ├─ avaliação de alertas (cpu/ram/disk/antivirus/firewall, a partir do req, sem query)
         └─ resposta: {"machine_id", "next_interval_seconds"}
                                    │
                                    └─ Svc.tick() aplica via ticker.Reset() (Fase 4)
```

Arquivos centrais: `lib/monitoring.go` (`HeartbeatUpsert`), `handler/mon_handlers.go`
(`monitoringHeartbeat`), `orion-agent/service/windows.go` (`tick`, `run`).

### 1.3. Rate limiting centralizado

`lib.DB.AllowDB` (`lib/ratelimit.go`) é um contador de janela fixa em `public.rate_limit_counters`
(`bucket_key`, `window_start`, `count`) — a tabela já existia em produção sem nenhum código usando
(mesmo padrão de drift do §1.1). Cobre `heartbeat`, `machine-login`, `commands/poll`,
`commands/respond`, `self-heal-event` — os três últimos não tinham limite nenhum antes. Fallback
para o limitador em memória (`lib.RateLimiter`) se a checagem no Postgres falhar — nunca bloqueia
tráfego de agente legítimo por causa de uma falha do próprio limitador.

Retenção: `cleanup_monitoring_history()` (pg_cron, diário às 4h) apaga janelas com mais de 1h.

### 1.4. Classificação de dispositivo e política de coleta

- `orion-agent/collector/device_type_windows.go` / `device_type_other.go`: retornam
  `(tipo, motivo)`. `tipo ∈ {desktop, notebook, server, unknown}` — `unknown` só quando NENHUM
  sinal (WMI no Windows; bateria/os-release no Linux) respondeu, nunca como default silencioso.
  macOS cai em `unknown` (sem `/sys/class/power_supply` nem `/etc/os-release`).
- `machines.device_type_locked`: quando `true` (setado via `POST
  /api/monitoring/machines/{id}/update` com `{"device_type": "..."}`, ver
  `lib.DB.SetDeviceTypeOverride`), o heartbeat do agente **para de sobrescrever** a classificação
  dessa máquina. UI: painel "Configurações Administrativas" em `MachineDrawer.tsx` — separado do
  botão "Salvar Alterações" de grupo/empresa de propósito (incluir `device_type` no corpo travaria
  a classificação em toda edição administrativa, não só quando a intenção é corrigi-la).
- `machine_device_type_history`: uma linha por transição real (`changed_by ∈ {agent, manual}`).
- Política de coleta (`handler.collectionIntervalSeconds`): servidor = 60s, todo o resto
  (incluindo `unknown`, de propósito — "não assumir comportamento de servidor") = 180s. O agente
  aplica via `ticker.Reset()`, sem precisar recriar o loop principal.

### 1.5. Resiliência do agente

- `Svc.bufferFalhas` (`service/windows.go`): heartbeats que falham mesmo após as retentativas de
  `sender.Send` vão para uma fila limitada a 5 itens (FIFO, descarta o mais antigo). Reenviados no
  próximo heartbeat bem-sucedido, via `escoarBufferFalhas`.
- `sender.PollCommands`/`RespondToCommand` ganharam o mesmo retry com backoff que só `Send` tinha.
- Jitter de início: 0 a um intervalo inteiro, uma única vez após o primeiro check-in — evita que
  uma frota inteira reiniciando junto (patch agendado, GPO) bata no backend sempre no mesmo
  instante relativo.

### 1.6. Ferramentas de operação

- **`GET /api/monitoring/platform-health`** (`handler/mon_handlers.go`,
  `monitoringPlatformHealth`) — visão agregada cross-tenant da frota: total/online/offline/alerta,
  contagem por `device_type`, alertas abertos, backlog de comandos RMM pendentes (com a idade do
  mais antigo), buckets de rate limit ativos. Restrito a `escopo.Global()` (master/developer) — é
  operação da plataforma, não dado de um cliente específico. UI: aba "Plataforma" em
  `InfrastructureDashboard.tsx` (`PlatformHealthTab.tsx`) — mostra "Acesso restrito" para quem não
  é master/developer, refletindo o 403 do backend em vez de duplicar a checagem `Global()` no
  frontend.
- **`orion-agent/cmd/loadsim`** — simulador de carga (Fase 11). Reproduz N agentes falsos
  reaproveitando `orion-agent/sender`/`config` de verdade (não uma reimplementação paralela do
  protocolo), distribuição de tipo de ativo 70% desktop / 20% notebook / 10% server (a frota real
  descrita para este parque, não uniforme). Uso:

  ```bash
  cd orion-agent
  go run ./cmd/loadsim -url https://sua-api.exemplo.com -agent-key SEU_AGENT_KEY \
    -count 100 -duration 5m
  ```

  Validado localmente contra um servidor mock (caminho feliz, 401, DNS/conexão recusada) — **nunca
  rodado contra produção**. Progressão recomendada pela Fase 13 do plano original: 100 → 250 → 500
  → 1000 → 2500, medindo a cada degrau antes de subir. Rodar contra produção exige autorização
  explícita e escopo definido (não é uma ação a se tomar por conta própria).

---

## 2. Checklist de produção

Antes de considerar esta fase do trabalho "pronta para produção":

- [x] **Aplicar as migrations pendentes** — já feito nesta sessão, direto no projeto de produção
      (`kcxwealimsfxqstoprdg`): `20260829120000_metrics_history_and_retention.sql`,
      `20260829130000_rate_limit_counters_retention.sql`,
      `20260829140000_device_type_confidence_and_override.sql`. Se este trabalho for replicado em
      outro ambiente (staging, outro projeto Supabase), aplicar as três e verificar contra o schema
      ao vivo (`SELECT to_regclass('public.machine_metrics')`, `\d public.machines` —
      device_type_reason/device_type_locked, `\d public.machine_device_type_history`).
- [ ] **Confirmar que o código deste branch é o que está de fato implantado** — o achado do §1.1 só
      foi possível porque schema e código de produção haviam divergido do repositório sem que
      ninguém tivesse como saber. Depois do merge, validar isso não deveria mais ser necessário,
      mas vale conferir uma vez.
- [ ] **Rodar `loadsim` num ambiente de staging/homologação** antes de confiar em qualquer número
      de capacidade — nenhuma alegação de "suporta N agentes" deste documento é validada por
      benchmark real ainda (ver §4).
- [ ] **Monitorar `machine_commands` e `machine_alerts`** por uma semana após o deploy para
      confirmar que a retenção (`cleanup_monitoring_history`) está de fato podando as tabelas —
      `SELECT COUNT(*) FROM machine_commands WHERE status IN ('completed','failed') AND created_at
      < now() - interval '30 days'` deve cair para 0 depois do primeiro ciclo do cron (diário, 4h).
- [ ] **Verificar o job do pg_cron está ativo**: `SELECT * FROM cron.job WHERE jobname =
      'cleanup-monitoring-history-daily'`.
- [ ] **Plano do Supabase**: o projeto está no plano free (500 MB, conforme auditoria original) —
      confirmar se ainda é o caso antes de qualquer rollout além do piloto atual (3 máquinas).
      Crescimento de frota real vai exigir upgrade de plano independente de qualquer otimização de
      código feita aqui.
- [ ] **Comunicar aos usuários dos agentes existentes** que o intervalo de heartbeat vai passar a
      variar por tipo de máquina (antes: fixo por `agent.yaml`) — não deveria ter efeito visível,
      mas é uma mudança de comportamento real.

---

## 3. Procedimento de rollback (por mudança)

| Mudança | Como reverter |
|---|---|
| `machine_metrics` recriada + retenção | `DROP TABLE public.machine_metrics CASCADE` desfaz o schema; reverter o commit `0398159` desfaz o código. Mas ver §1.1 — sem essa tabela, o heartbeat volta a falhar como estava antes desta sessão. Não recomendado sem substituir por outra correção. |
| Rate limiting centralizado | Reverter commit `e21b8f0` volta ao limitador em memória (funcional, só não correto em serverless multi-instância — comportamento pré-existente, não uma regressão). Tabela `rate_limit_counters` pode ficar (não é lida por mais ninguém). |
| `device_type_locked`/histórico | Reverter commit `caa00ca`. Colunas/tabela novas podem ficar sem uso (não quebram nada se o código parar de escrevê-las). |
| Política de coleta por tipo | Reverter commit `6510210`. Agente volta a usar só `cfg.IntervalSeconds` fixo — `next_interval_seconds` simplesmente para de ser enviado/lido. |
| Buffer/retry/jitter do agente | Reverter commit `d045986`. Sem efeito no backend. |
| `platform-health`/`loadsim` | Reverter commit `03e0b28`. Endpoint e ferramenta são aditivos — nada mais os depende. |
| Injeção de versão + UI de platform-health/override | Reverter commit `9e48317`. `version.Version` volta a ser lido sem `-ldflags` (fallback "1.0.0" continua funcionando, só deixa de ser a versão real). UI removida não afeta a API por baixo dela. |

Todas as mudanças de schema foram feitas via `ADD COLUMN IF NOT EXISTS`/`CREATE TABLE IF NOT
EXISTS` — nenhuma é destrutiva por si só. Reverter o código sem reverter o schema é sempre seguro
(colunas/tabelas extras não usadas não quebram nada).

---

## 4. Pendências e próximos passos

Itens do plano original **deliberadamente não fechados** nesta sessão, e por quê:

1. **Capacidade medida em 100/250/500/1000/2500 agentes** (Fase 1/11 do plano) — a ferramenta
   existe (`loadsim`) e foi validada localmente, mas rodá-la contra um ambiente real (mesmo que
   staging) e registrar os números é uma ação que precisa de escopo/autorização explícitos, não
   algo a se decidir sozinho no meio da implementação. Além disso, o código desta sessão está em
   `main-utu21b`, ainda não mergeado/implantado — rodar `loadsim` contra a produção atual hoje
   testaria o código antigo, não o que foi construído aqui.
2. **Versionamento formal de contrato/schema** (Fase 2) — hoje a compatibilidade é mantida "por
   convenção" (campos novos são sempre aditivos, nunca removidos/renomeados) mais o teste de
   fixture real agente↔backend (§1.6). Deliberadamente não construído: não há hoje uma mudança
   quebradora de contrato pendente que precise de negociação de versão — adicionar esse mecanismo
   sem um caso concreto seria infraestrutura especulativa, o oposto do que a auditoria original
   pediu ("não aumentar complexidade sem benefício").
3. **Rollout gradual formal** (Fase 12) — `company_id` já permite testar uma mudança de política
   numa empresa antes de outra, e `agent_version` já é reportado (e agora injetável no build, ver
   item fechado abaixo). Um mecanismo de feature flag dedicado não foi construído pela mesma razão
   do item 2: não há hoje um rollout arriscado específico esperando por ele. Fica documentado como
   o próximo passo natural quando (e se) essa necessidade aparecer, não implementado adiantado.

**Itens que estavam aqui e foram fechados numa rodada seguinte desta mesma sessão:**
UI para `platform-health` e para override manual de `device_type` (`PlatformHealthTab.tsx`,
`MachineDrawer.tsx` — ver §1.4/§1.6), e injeção de `agent_version` no build (`version.Version` virou
`var`, aceita `-ldflags -X orion-agent/version.Version=...` — ver §1.6 e `installer-msi/build.ps1`).

## 5. Merge com o desenvolvimento paralelo em `main` (2026-08-29)

Entre o início desta sessão e o merge, `origin/main` avançou ~100 commits de um fluxo de trabalho
separado — incluindo, notavelmente, uma migração independente do histórico de métricas de
`machine_metrics` para Prometheus/Grafana (commits `c6cbe2c`/`9612b7f`), que resolve o mesmo
problema que `HeartbeatUpsert` desta sessão resolvia por outro caminho (retenção em Postgres).

Reconciliação (decisão do usuário: **descartar a parte de métricas desta sessão, manter o resto**):

- `HeartbeatUpsertInput`/`HeartbeatUpsert`, a tabela de histórico em `machine_metrics` e
  `MetricsByMachineID` foram **descartados** — o `main` já resolve isso via `UpdateMachineSnapshot`
  (snapshot nas colunas de `machines`) + `lib/grafana_metrics.go` (proxy pro Prometheus via Grafana).
- `UpsertMachine` (do `main`) recebeu de volta a lógica que só existia nesta sessão: o CASE que
  respeita `device_type_locked` num override manual, a coluna `device_type_reason`, e o registro em
  `machine_device_type_history` — nada disso existia no `main`. A função passou a rodar em
  transação e devolve `(id, deviceType, err)`.
- Mantidos e reintegrados sobre a base do `main`: `SetDeviceTypeOverride`, `PlatformHealth`/
  `monitoringPlatformHealth`, `collectionIntervalSeconds` (política de coleta por tipo de ativo),
  rate limiting Postgres-backed (`AllowDB`/`agentRateLimitAllow`) em `commands/poll`,
  `commands/respond` e `self-heal-event`, buffer de heartbeats represados do agente, jitter
  contínuo (mesclado com o jitter de boot que o `main` já tinha), `PlatformHealthTab.tsx` (adaptada
  ao `PageHeader` que o `main` introduziu), `loadsim`, e o versionamento do agente via `-ldflags`
  (mantendo `"1.1.26"` do `main` como valor-default).
- `MarkCommandsSent` (desta sessão) foi descartada em favor do `UpdateCommandsStatusBatch`
  equivalente que já existia no `main`.

Validado após a reconciliação: `go build`/`vet`/`test` (raiz e `orion-agent` — este último
cross-compilado para `GOOS=windows`, sua plataforma real), `tsc --noEmit`, `vite build` e `vitest`
(62/62) — sem regressões nos arquivos tocados pelo merge. O merge foi feito como fast-forward de
`main-utu21b` para `main` (nenhum histórico reescrito) e já está em `origin/main`.

**Pendência conhecida, não bloqueante:** a migration
`20260829120000_metrics_history_and_retention.sql` já havia sido aplicada em produção nesta sessão
(antes de se descobrir o trabalho paralelo do `main`) e recriou a tabela `machine_metrics` — hoje
órfã, nada mais escreve nela. Não é urgente (não quebra nada, só ocupa espaço), mas vale um
`DROP TABLE public.machine_metrics CASCADE` numa sessão futura para não confundir quem for mexer
no schema depois.
