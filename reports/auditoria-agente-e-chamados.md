# Relatório de Auditoria: Orion Agent e Abertura de Chamados

**Data:** 02/09/2026  
**Status:** Fase 1 e 2 Concluídas — 100% Somente Leitura  
**Alvo:** `orion-agent/` (Go Windows) e Backend Go (`handler/mon_handlers.go`, `handler/auth_handlers.go`, `lib/monitoring.go`, `lib/db.go`)

---

## 1. DIAGRAMA TEXTUAL DO FLUXO COMPLETO

Fluxo ponta a ponta da máquina até a abertura de chamado e processamento de telemetria, com indicação dos pontos de falha silenciosa:

```
[ Máquina do Cliente (Windows) ]
  │
  ├── (A) LOOP DE TELEMETRIA / HEARTBEAT (a cada 60s/180s ±10% jitter)
  │     │
  │     ▼ Coleta Hardware/CPU/RAM/Disco/Segurança (`collector/hardware.go:96`)
  │     ▼ Envio HTTP POST `/api/monitoring/machines/heartbeat` (`sender/api.go:70`)
  │     │   [X-Agent-Key no header, machine_token no JSON]
  │     ▼
  │   [ Backend Go: `monitoringHeartbeat` (`handler/mon_handlers.go:488`) ]
  │     ├─ [PONTO DE FALHA 1] Rate limit grava no Postgres sem expurgo (`lib/ratelimit.go:85`)
  │     ├─ Valida X-Agent-Key (`lib/helpers.go:102`)
  │     ├─ `db.UpsertMachine` (`lib/monitoring.go:535`)
  │     │   ├─ [PONTO DE FALHA 2] Máquina clonada com mesmo token sobrescreve outra máquina
  │     │   └─ [PONTO DE FALHA 3] Máquina rejeitada apagada renasce como 'pending'
  │     ├─ `db.UpdateMachineSnapshot` (snapshot na tabela `machines`, sem histórico)
  │     ├─ Avaliação de métricas (>85% CPU, >90% RAM/Disco) (`mon_handlers.go:625-696`)
  │     │   └─ Grava em `public.machine_alerts` via `InsertAlertIfNotExists`
  │     │
  │     ▼
  │   [ STOP: TELEMETRIA NUNCA GERA CHAMADO ] ──> NENHUM TICKET É CRIADO AQUI!
  │
  ├── (B) LOOP DE COMANDOS RMM (a cada 30s ±10% jitter)
  │     │
  │     ▼ Envio HTTP GET `/api/monitoring/commands/poll?machine_id=...` (`service/windows.go:402`)
  │     ▼ Backend entrega comandos pendentes e marca como 'sent' (`mon_handlers.go:1109`)
  │     │   ├─ [PONTO DE FALHA 4] 'sent' quebra `HasPendingUpdateCommand` -> duplica update
  │     │   ├─ [PONTO DE FALHA 5] Agente offline puxa comandos obsoletos acumulados em lote
  │     │   └─ [PONTO DE FALHA 6] URL assinada de update expira em 300s -> erro 403
  │     ▼ Agente executa via `cmd.exe /C` (`service/windows.go:566`)
  │         └─ [PONTO DE FALHA 7] Instalador mata agente antes de enviar 'completed'
  │
  └── (C) FLUXO MANUAL DE ABERTURA DE CHAMADO (Ação do Usuário)
        │
        ▼ Usuário clica em "Abrir Chamado" no systray (`orion-agent/main.go:179`)
        ▼ Agente abre navegador com Magic Link (`service/windows.go:293`):
        │   `GET /api/auth/machine-login?token={machine_token}&redirect_to=/novo-ticket`
        ▼
      [ Backend Go: `machineLogin` (`handler/auth_handlers.go:61-125`) ]
        ├─ [PONTO DE FALHA 8] Não valida `approval_status`: máquina 'pending' loga no sistema
        ├─ Deriva email fantasma `lib.MachineGhostEmail(token)` (`lib/monitoring.go:268`)
        ├─ Garante usuário no Supabase Auth (`sb.AdminCreateUser`)
        ├─ Gera Magic Link com sessão ativa do Supabase (`sb.AdminGenerateLink`)
        ▼ Redireciona navegador para `/novo-ticket`
        │
      [ Frontend React: Formulário de Novo Chamado (`src/pages/NewTicket.tsx`) ]
        ├─ Usuário preenche título, descrição e categoria manualmente
        ├─ [PONTO DE FALHA 9] `asset_id` vincula a `public.assets` (patrimônio), NÃO a `machines`
        ├─ [PONTO DE FALHA 10] `tickets.machine_token` é ignorado no INSERT
        ▼ Submit grava em `public.tickets` via Supabase Client (`NewTicket.tsx:337`)
        │
      [ Tela de Detalhes do Chamado (`src/pages/TicketDetails.tsx:1310-1312`) ]
        └─ [PONTO DE FALHA 11] Consulta `/api/monitoring/machines/{ticket.asset_id}` -> ERRO 404!
```

---

## 2. TABELA CONSOLIDADA DE ACHADOS

| # | Achado | Eixo | Gravidade | Esforço | Toca schema? | Veredito |
|---|---|---|:---:|:---:|:---:|:---:|
| **1** | Abertura automática de chamados por alertas de telemetria não existe | Chamados | Alta | M | Não | **PÓS-LANÇAMENTO** |
| **2** | Conflito `assets` vs `machines` no chamado gera erro 404 em detalhes | Chamados | Alta | P | Não | **CORRIGIR ANTES DO MVP** |
| **3** | Coluna `tickets.machine_token` é ignorada no insert de novos chamados | Chamados | Média | P | Não | **CORRIGIR ANTES DO MVP** |
| **4** | Rejeição de máquina faz `DELETE` físico e causa loop de reencarnação | Ciclo de Vida | Alta | P | Não | **CORRIGIR ANTES DO MVP** |
| **5** | Máquina com `approval_status = 'pending'` acessa o portal e abre chamados | Ciclo de Vida | Alta | P | Não | **CORRIGIR ANTES DO MVP** |
| **6** | Inconsistência `dispatched` vs `sent` quebra deduplicação de auto-update | Comandos | Média | P | Não | **CORRIGIR ANTES DO MVP** |
| **7** | Instalador do agente mata o processo pai antes de enviar status 'completed' | Comandos | Média | P | Não | **CORRIGIR ANTES DO MVP** |
| **8** | Comandos para máquinas offline não expiram (sem TTL) e executam em lote | Comandos | Média | P | Aditiva | **PÓS-LANÇAMENTO** |
| **9** | URL assinada de download do auto-update expira em 300s (gera HTTP 403) | Comandos | Média | P | Não | **CORRIGIR ANTES DO MVP** |
| **10** | Ausência de validação de health check e rollback pós-atualização | Comandos | Alta | M | Não | **PÓS-LANÇAMENTO** |
| **11** | Chave `X-Agent-Key` compartilhada entre todas as máquinas da empresa | Autenticação | Alta | M | Não | **PÓS-LANÇAMENTO** |
| **12** | `agent.yaml` gravado em texto plano com permissão aberta (0644) | Autenticação | Alta | P | Não | **CORRIGIR ANTES DO MVP** |
| **13** | Omissão do expurgo de `rate_limit_counters` causa inchaço contínuo no banco | Telemetria | Alta | P | Não | **CORRIGIR ANTES DO MVP** |
| **14** | Polling de comandos a cada 30s gera 80% do tráfego HTTP desnecessariamente | Telemetria | Média | M | Não | **PÓS-LANÇAMENTO** |
| **15** | Execução de comandos arbitrários no agente via `cmd.exe /C` sem allowlist | Segurança | Crítica | M | Não | **PRECISA DE DECISÃO SUA** |
| **16** | Desinstalação do agente não notifica servidor e mantém token em disco | Ciclo de Vida | Baixa | P | Não | **PÓS-LANÇAMENTO** |
| **17** | Rota `DELETE /api/monitoring/machines/{id}` ausente no roteador Go | Ciclo de Vida | Baixa | P | Não | **CORRIGIR ANTES DO MVP** |
| **18** | Prometheus incapaz de coletar métricas de agentes atrás de NAT | Telemetria | Média | G | Não | **NÃO FAZER** |

---

## 3. FICHAS DAS 3 CORREÇÕES PRIORITÁRIAS

### Ficha 1: Correção do Vínculo Máquina-Chamado e Bloqueio de Máquina Pendente
- **Eixo:** Chamados / Ciclo de Vida  
- **Veredito:** `CORRIGIR ANTES DO MVP`  
- **Problema:**  
  1. `src/pages/TicketDetails.tsx:1310-1312` tenta carregar detalhes da máquina passando `ticket.asset_id` (que referencia a tabela `public.assets`). Como os IDs são de tabelas diferentes, a API retorna 404 e a aba de ações RMM fica inoperante.  
  2. `src/pages/NewTicket.tsx:337-352` não envia `machine_token`.  
  3. `handler/auth_handlers.go:120` em `machineLogin` não valida `approval_status`, permitindo que máquinas ainda não aprovadas acessem o portal do cliente.
- **Abordagem Cirúrgica:**  
  1. Em `handler/auth_handlers.go:120`, adicionar verificação: rejeitar login com HTTP 403 se `machine.ApprovalStatus != nil && *machine.ApprovalStatus != "approved"`.  
  2. Em `handler/auth_handlers.go:111`, repassar `machine_id` na URL de redirecionamento: `/novo-ticket?machine_id={id}`.  
  3. Em `src/pages/NewTicket.tsx:346-352`, ler `machine_id` dos search params e gravar `machine_token` no insert de `tickets`.  
  4. Em `src/pages/TicketDetails.tsx:1310`, se `ticket.machine_id` estiver preenchido, consumir `ticket.machine_id` diretamente em vez de `ticket.asset_id`.
- **Arquivos Tocados:**  
  - [`handler/auth_handlers.go`](file:///c:/Users/suporte.ti/Documents/orion-system/handler/auth_handlers.go)  
  - [`src/pages/NewTicket.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/NewTicket.tsx)  
  - [`src/pages/TicketDetails.tsx`](file:///c:/Users/suporte.ti/Documents/orion-system/src/pages/TicketDetails.tsx)
- **Mudança de Schema:** Nenhuma (compatível; coluna `tickets.machine_token` já existe em `supabase/migrations/20260318000000_agent_v2_support.sql:14`).
- **Critério de Sucesso Verificável:**  
  Clicar em "Abrir Chamado" no systray de máquina aprovada, submeter o formulário e constatar que em `TicketDetails` as métricas e ações da máquina aparecem sem erro 404. Máquina pendente que tentar login recebe 403.
- **Contra-argumento do Advogado do Diabo (Subagente F):**  
  *"Alterar o formulário de chamados pode quebrar a criação manual feita por usuários via portal web que não vieram do agente."*  
- **Resposta / Defesa:**  
  A leitura do parâmetro `machine_id` na URL é estritamente opcional (`searchParams.get('machine_id') || null`). Se ausente (fluxo web tradicional), o comportamento é 100% idêntico ao atual.

---

### Ficha 2: Correção da Rejeição de Máquinas e Loop de Reencarnação
- **Eixo:** Ciclo de Vida  
- **Veredito:** `CORRIGIR ANTES DO MVP`  
- **Problema:**  
  Em `lib/monitoring.go:470`, `RejectMachine` executa `DELETE FROM public.machines`. Como o agente na máquina continua rodando, o próximo heartbeat (~30-60s) executa `UpsertMachine` (`lib/monitoring.go:539`), reinserindo o registro com `approval_status = 'pending'`. A máquina nunca é rejeitada de verdade.
- **Abordagem Cirúrgica:**  
  1. Alterar `RejectMachine` (`lib/monitoring.go:470`) para executar:  
     `UPDATE public.machines SET approval_status = 'rejected', updated_at = now() WHERE id = $1 AND approval_status = 'pending'`.  
  2. Em `handler/mon_handlers.go:580`, após `db.UpsertMachine`, verificar se a máquina retornada possui `approval_status == 'rejected'`. Se sim, abortar com HTTP 403 Forbidden (`"máquina rejeitada pela administração"`), sem atualizar métricas nem status online.
- **Arquivos Tocados:**  
  - [`lib/monitoring.go`](file:///c:/Users/suporte.ti/Documents/orion-system/lib/monitoring.go)  
  - [`handler/mon_handlers.go`](file:///c:/Users/suporte.ti/Documents/orion-system/handler/mon_handlers.go)
- **Mudança de Schema:** Nenhuma (o valor `'rejected'` já é previsto no CHECK da coluna em `supabase/migrations/20260821150000_add_machine_approval_gate.sql:24`).
- **Critério de Sucesso Verificável:**  
  Rejeitar uma máquina na fila de pendentes. Observar que o status no banco permanece `'rejected'` e os heartbeats subsequentes recebem HTTP 403, não reaparecendo na lista de pendentes.
- **Contra-argumento do Advogado do Diabo (Subagente F):**  
  *"Manter máquinas rejeitadas no banco consome espaço e linhas na tabela `machines` para sempre."*  
- **Resposta / Defesa:**  
  A migration `20260821150000` previu explicitamente o status `'rejected'` para manter rastreabilidade de auditoria. O volume de máquinas rejeitadas é insignificante (dezenas de registros) e elimina o custo de suporte de técnicos re-rejeitando a mesma máquina em loop infinito.

---

### Ficha 3: Correção do Auto-Update Duplicado e Restauração do Expurgo de Rate Limits
- **Eixo:** Comandos / Telemetria  
- **Veredito:** `CORRIGIR ANTES DO MVP`  
- **Problema:**  
  1. `lib/monitoring.go:784` (`HasPendingUpdateCommand`) verifica apenas `status IN ('pending', 'dispatched')`. No entanto, `handler/mon_handlers.go:1109` altera o comando imediatamente para `'sent'`. Com isso, heartbeats subsequentes acham que não há update em andamento e enfileiram cópias duplicadas do comando de update enquanto o download ainda está ocorrendo.  
  2. Na migration `20260831000000:23-45`, a rotina de limpeza do banco perdeu o comando de expurgo da tabela `public.rate_limit_counters`, causando inchaço de dezenas de milhões de linhas.  
  3. URL assinada de download tem TTL de apenas 300s (`handler/installer_handlers.go:145`). Se o agente demorar >5min para puxar o comando, recebe 403 Forbidden.
- **Abordagem Cirúrgica:**  
  1. Em `lib/monitoring.go:784`, alterar para `status IN ('pending', 'dispatched', 'sent')`.  
  2. Em `handler/installer_handlers.go:145`, elevar o TTL da URL assinada para 3600 segundos (1 hora).  
  3. Restaurar na função SQL `cleanup_monitoring_history()` a linha:  
     `DELETE FROM public.rate_limit_counters WHERE window_start < now() - INTERVAL '1 hour';`.
- **Arquivos Tocados:**  
  - [`lib/monitoring.go`](file:///c:/Users/suporte.ti/Documents/orion-system/lib/monitoring.go)  
  - [`handler/installer_handlers.go`](file:///c:/Users/suporte.ti/Documents/orion-system/handler/installer_handlers.go)  
  - Nova migration SQL pontual (aditiva/compatível).
- **Mudança de Schema:** Compatível (ajuste da função de expurgo existente no `pg_cron`).
- **Critério de Sucesso Verificável:**  
  Disparar auto-update. Verificar que novos heartbeats reportando versão antiga não enfileiram comando extra. Verificar via query SQL que linhas antigas de `rate_limit_counters` são limpas pelo `cleanup_monitoring_history()`.
- **Contra-argumento do Advogado do Diabo (Subagente F):**  
  *"Aumentar o TTL da URL assinada para 1 hora expõe o binário do instalador por mais tempo."*  
- **Resposta / Defesa:**  
  O binário do instalador já é público para download sob demanda pelo painel do cliente via endpoint de download. O risco é nulo e evita falhas sistemáticas de atualização em máquinas com conexão lenta ou latência.

---

## 4. CENÁRIOS DE FALHA NÃO TRATADOS (O QUE ACONTECE HOJE)

### 4.1 Máquina Offline por Vários Dias
- **No Banco:** Após 5 minutos sem heartbeat, `cronMarkOffline` (`lib/monitoring.go:1010`) marca `status = 'offline'`.
- **Comandos Acumulados:** Se comandos foram enfileirados enquanto offline, eles **não expiram**. `lib/monitoring.go:800` busca todos os pendentes sem limite de quantidade nem data. Ao religar, o agente puxa e executa todos os comandos de uma vez em rajada sequencial (`service/windows.go:519`), podendo reiniciar o computador ou alterar configurações fora de hora.
- **Auto-Update Pendente:** Se houver comando `orion-install` pendente, a URL assinada já estará expirada (TTL 300s, `installer_handlers.go:145`). O download falha com HTTP 403 Forbidden (`service/windows.go:725`).

### 4.2 Relógio da Máquina Dessincronizado
- **No Agente:** O agente envia métricas com timestamps gerados localmente e calcula uptimes relativos (`collector/hardware.go:538`).
- **No Servidor:** O servidor utiliza predominantemente `now()` do PostgreSQL para `last_seen` (`lib/monitoring.go:539`) e `metrics_collected_at` (`lib/monitoring.go:629`).
- **Falha de TLS:** Se o relógio da máquina estiver defasado em mais de algumas horas/dias, a validação de certificado TLS (`crypto/tls`, `service/windows.go:864`) falhará por certificado ainda não válido ou expirado. O agente entra em loop de retentativa e buffer local de falhas (`service/windows.go:150`).

### 4.3 Disco da Máquina Cheio (Volume `C:\`)
- **No Agente:**  
  - O agente continua rodando em memória RAM. Ao tentar gravar logs locais em `C:\Orion\agent.log` (`main.go:60`), as operações de escrita em arquivo começam a falhar silenciosamente (`os.OpenFile` com erro de I/O).  
  - Na rotina de auto-atualização, `downloadFileToTemp` (`service/windows.go:704`) falha ao tentar criar o arquivo temporário `%TEMP%\orion-update-*.exe`, cancelando a atualização e reportando erro no poll.
- **No Servidor:** O heartbeat consegue enviar o percentual de disco (`100%`). O servidor dispara `InsertAlertIfNotExists` gerando alerta de severidade `critical` (`handler/mon_handlers.go:652`). **Nenhum chamado de emergência é aberto.**

### 4.4 Agente Desatualizado em Relação ao Servidor
- **Detecção:** A cada heartbeat, `handler/mon_handlers.go:727` compara `req.AgentVersion != lib.LatestAgentVersion`.
- **Disparo:** Se diferente, enfileira comando `orion-install` via `enfileirarAutoUpdateSeNecessario`.
- **Falha Conhecida (Achado A5):** O instalador baixa a nova versão, executa `taskkill /F /IM orion-agent.exe` e `sc stop OrionAgent` (`cmd/installer/main.go:188-195`). Isso mata o processo do agente antes que ele consiga enviar `RespondToCommand("completed")` (`service/windows.go:644`). O comando permanece para sempre com status `'sent'` no histórico do banco, embora o agente tenha atualizado com sucesso.

### 4.5 Chave de Agente (`X-Agent-Key`) Inválida ou Excluída no Painel
- **Rejeição:** `lib.ValidateAgentKey` (`lib/helpers.go:124`) retorna erro `"chave de agente inválida"`. O servidor responde `HTTP 401 Unauthorized`.
- **Comportamento do Agente:** O agente entra no fluxo de retentativa (`orion-agent/sender/api.go:45-68`). Como 401 não é tratado como erro fatal permanente, ele esgota as 3 tentativas e salva no buffer local (`service/windows.go:150`).
- **Orfandade da Frota:** O agente **não possui mecanismo de buscar nova chave**. A máquina fica permanentemente desconectada até que um técnico vá até a máquina física e edite o arquivo `C:\Orion\agent.yaml`.

### 4.6 Servidor Indisponível (Queda ou Manutenção) Durante o Envio
- **No Agente:** `sender.Send` tenta 3 vezes com backoff exponencial (`2s * 2^(tentativa-1) + jitter`). Ao esgotar, insere o snapshot na fila em memória `bufferFalhas` (capacidade 5) (`service/windows.go:150-161`).
- **Ao Retornar o Servidor:** No primeiro heartbeat bem-sucedido, o agente chama `escoarBufferFalhas()` (`service/windows.go:170-180`) e retransmite os dados represados antes de prosseguir com os novos ciclos. O comportamento do agente é robusto e correto.

---

## 5. SUPOSIÇÕES E DECISÕES QUE DEPENDEM DE VOCÊ

### Decisão 1: Abertura Automática de Chamados por Alertas (Sim ou Não?)
- **Opção A (Recomendação do Advogado do Diabo):** **NÃO abrir chamados automaticamente por métricas transitórias (CPU/RAM/Disco).** Manter alertas isolados na Zona Vermelha (`machine_alerts`). Criar apenas um botão no dashboard: *"Gerar Chamado a partir deste Alerta"* para decisão do operador humano. Evita flapping e fadiga de alertas.
- **Opção B (Automação Restrita com Histerese):** Abrir chamados automáticos **apenas para eventos não-oscilantes e persistentes**:
  1. Disco > 90% persistente por > 30 minutos.
  2. Antivírus ausente/desativado por > 2 horas.
  3. Falha na execução de script de autocura (`rmm_remediation_logs.status = 'failed'`).

### Decisão 2: Autor dos Chamados Gerados pelo Sistema / Agente
- **Contexto:** `public.tickets` exige `user_id NOT NULL REFERENCES auth.users(id)` (`supabase/migrations/20251022014710:129`). O agente roda como máquina, sem usuário.
- **Opção A:** Criar no banco um usuário de serviço global (ex: `orion-system@orion.internal`) para ser o `user_id` de todos os chamados abertos por automação.
- **Opção B:** Reaproveitar o `auth.users` do usuário-fantasma da máquina (`lib.MachineGhostEmail(token)`), já utilizado no fluxo do atalho da bandeja.

### Decisão 3: Execução Remota de Comandos (Livre vs. Catálogo/Allowlist)
- **Contexto:** Hoje qualquer comando enviado pelo painel é executado cegamente pelo agente via `cmd.exe /C <command>` (`service/windows.go:566`) sob a conta de serviço local.
- **Opção A (Status Quo - Flexibilidade Total):** Manter execução livre, confiando no controle de acesso do backend Go (`admin`, `technician`, `developer`).
- **Opção B (Segurança Reforçada):** Adotar allowlist no agente para comandos pré-definidos (ex.: `restart-spooler`, `gpupdate-force`, `flush-dns`, `reboot`), rejeitando strings arbitrárias.

### Decisão 4: Cadência do Polling de Comandos (30s)
- **Contexto:** O polling de comandos a cada 30s representa 80% das requisições HTTP da frota. Com 200 máquinas, são 20,7 milhões de requisições/mês, estourando planos gratuitos de serverless em horas.
- **Opção A:** Aumentar o intervalo para 60s ou 120s em estações/notebooks (mantendo 30s apenas para servidores).
- **Opção B:** Piggybacking — retornar comandos pendentes no próprio payload de resposta do heartbeat, eliminando a rota de polling separada.

---

**PARE:** Fase 2 de consolidação concluída. Nenhum arquivo de código foi alterado. Aguardando suas decisões sobre as correções prioritárias e regras de negócio antes de qualquer implementação.
