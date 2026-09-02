# Relatório de Decisão e Viabilidade Técnica: Orion System vs. Milvus

Data: 01/09/2026  
Status: Análise Concluída (Fase de Decisão e Planejamento)  
Ambiente Alvo: Vercel Serverless (Go + Chi) + Supabase (PostgreSQL 15+, Auth, RLS, Storage) + SPA React (Vite/Tailwind) + Orion Agent (Go)

---

## 1. Matriz Consolidada de Viabilidade (8 Lacunas)

| # | Lacuna | Base já existente | Mudança de schema | Risco de segurança | Esforço (P/M/G) | Impacto comercial (A/M/B) | Dependência externa | Veredito |
|---|---|---|---|---|---|---|---|---|
| **1** | Atendimento Multicanal (WhatsApp, E-mail, Chat, Telefone) | 25% (`tickets`, `ticket_updates`, `email-to-ticket`, stub WA) | ADITIVA (`channel_integrations`, `customer_identities`, `ticket_messages`) | 🔴 Alto (Bypass RLS em webhook, injeção de mídia) | **G** | **A** | Meta Cloud API / Resend / Provedor VoIP | **PÓS-LANÇAMENTO** |
| **2** | Aplicativo Mobile (Técnico em Campo / Solicitante) | 15% (Web responsiva, `manifest.json`, hook `useIsMobile`) | ADITIVA (`user_device_tokens`, `field_service_checkins`) | 🟡 Médio (Revogação de token BYOD, push com PII) | **G** | **M** | Firebase Cloud Messaging (FCM) / Apple APNs | **NÃO FAZER NATIVO** (Evoluir para PWA) |
| **3** | Relatórios Personalizáveis pelo Próprio Usuário | 20% (Motor `aggregations.ts`, exportadores PDF/XLSX) | ADITIVA (`custom_reports`, `custom_dashboards`) | 🔴 Alto (DoS no Postgres por queries analíticas sem índice) | **G** | **M** | Nenhuma (Nativo PostgreSQL/React) | **NÃO FAZER BUILDER** (Focar em 15 relatórios fixos) |
| **4** | Agendamento de Relatórios por E-mail | 10% (Cliente Resend em Go `lib/email.go:13`, agregação pura em TS) | ADITIVA (`report_schedules`, `report_execution_logs`) | 🟡 Médio (Vazamento cross-tenant por falha em loop de cron) | **M** | **M** | Resend API / Vercel Cron | **PÓS-LANÇAMENTO** |
| **5** | Recursos de IA no Atendimento (Sugestão, Classificação, Resumo, RAG) | 20% (`pgvector` ativo, HNSW, RPC `match_kb_articles`, UI dialogs) | ADITIVA (`ticket_embeddings`, `ai_ticket_insights`, `ai_usage_quotas`) | 🟡 Médio (Prompt injection, RAG cross-tenant mal filtrado) | **P** | **A** | Google Gemini 2.0 Flash / OpenAI API | **FAZER AGORA** |
| **6** | Acesso Remoto Maduro (Evolução de `machine_commands`) | 50% (Terminal PTY CLI WebSocket, `machine_commands` assíncrono) | ADITIVA (`remote_desktop_sessions`, `remote_file_transfer_logs`) | 🔴 Crítico (IDOR em sessão gráfica, sequestro de tela) | **G** (Próprio) / **P** (DeepLink) | **A** | Servidor Relay RustDesk / Guacamole VPS | **PÓS-LANÇAMENTO** (DeepLink RustDesk) |
| **7** | Contratos, Financeiro e Banco de Horas | 35% (`contracts.monthly_hours`, timer `time_entries`, tela de contratos) | ALTERAÇÃO COMPATÍVEL (`contract_billing_cycles`, `contract_rate_cards`, `contract_invoices`) | 🟢 Baixo (Isolamento RLS por `company_id` já consolidado) | **M** | **A** | Gateway Asaas/Iugu (Opcional) | **FAZER AGORA** |
| **8** | API Pública Documentada e Webhooks | 10% (`api_keys` existente, middleware de escopo em Go, `rate_limit_counters`) | ALTERAÇÃO COMPATÍVEL (`webhook_endpoints`, `webhook_deliveries`, `api_keys.scopes`) | 🟡 Médio (SSRF em webhooks de saída, exaustão de quota) | **M** | **A** | Standard Webhooks Spec / Scalar | **FAZER AGORA** |

---

## 2. Ficha Detalhada das 3 Melhores Propostas

---

### TOP 1: Recursos de IA no Atendimento (Copilot, Resumo, Classificação e RAG)

#### a) Abordagem Recomendada e Justificativa
* **Abordagem:** Integração de chamadas síncronas/streaming via Go Serverless (`/api/ai/*`) consumindo **Google Gemini 2.0 Flash** ([ai.google.dev/pricing](https://ai.google.dev/pricing)) para geração de texto, e **Supabase pgvector** com `text-embedding-3-small` ([supabase.com/docs/guides/database/extensions/pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)) para busca semântica na Base de Conhecimento.
* **Por que venceu:** A infraestrutura de banco de dados (`pgvector`, índice HNSW e RPC `match_kb_articles`) já está provisionada em [`supabase/migrations/20260813000001_phase2_pgvector_rag.sql:2-44`](file:///C:/Users/suporte.ti/Documents/orion-system/supabase/migrations/20260813000001_phase2_pgvector_rag.sql#L2-L44). O frontend já possui o modal de resumo [`src/components/ticket/TicketSummaryDialog.tsx:1-85`](file:///C:/Users/suporte.ti/Documents/orion-system/src/components/ticket/TicketSummaryDialog.tsx#L1-L85) e o hook [`src/hooks/useTicketCopilot.ts:1-62`](file:///C:/Users/suporte.ti/Documents/orion-system/src/hooks/useTicketCopilot.ts#L1-L62). O custo do Gemini 2.0 Flash é irrisório (~$0.10 por 1 milhão de tokens, menos de R$ 0,001 por chamado).

#### b) Arquivos Tocados
* `supabase/migrations/20260901000001_ai_copilot_schema.sql`: Criação das tabelas `ticket_embeddings`, `ai_ticket_insights`, `ai_response_suggestions` e `ai_usage_quotas`.
* `handler/ai_handlers.go`: Novos handlers Go `/api/ai/suggest-reply`, `/api/ai/summarize` e `/api/ai/classify`.
* `handler/router.go:195-251`: Registro das rotas de IA protegidas por `RequireCompanyScope`.
* `lib/ai.go`: Cliente de integração HTTP com Gemini/OpenAI com Structured Outputs via JSON Schema.
* `src/hooks/useTicketCopilot.ts:1-62`: Substituição dos mocks estáticos por chamadas reais via TanStack Query.
* `src/components/ticket/AICopilotCard.tsx`: Novo componente de sugestão contextual sobre o textarea de resposta em `TicketDetails.tsx`.

#### c) Mudanças de Schema e RLS
* **Schema:**
  ```sql
  CREATE TABLE public.ai_ticket_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE UNIQUE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    thread_summary TEXT NOT NULL,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
    predicted_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    predicted_priority TEXT,
    confidence_score NUMERIC(5, 2),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
* **RLS:** Acesso restrito a `technician`, `admin` e `developer` do mesmo `company_id`. Clientes (`customer`) não leem nem gravam dados internos de IA.

#### d) Critério de Sucesso Verificável
1. Resumo de timeline de chamado com 10+ iterações gerado em < 1.2 segundos com custo < $0.0005.
2. Sugestão de resposta referenciando artigos reais da KB encontrados via similaridade de cosseno com distância `< 0.35`.
3. 100% de testes automatizados passando em `go test ./...` e `npx vitest run`.

#### e) Riscos e Mitigações
* **Risco (Vazamento Cross-Tenant no RAG):** Sugestão de resposta trazer dados confidenciais de outra empresa.
* **Mitigação:** A RPC `match_kb_articles` e a nova `match_similar_tickets` forçam estritamente `WHERE company_id = p_company_id` ANTES da comparação de vetores HNSW.

#### f) Ataque do Subagente F e Resposta da Engenharia
* **Ataque do Subagente F:** *"Prompt injection em chamados maliciosos pode sugerir comandos perigosos de PowerShell para o técnico rodar no RMM; custos de tokens podem explodir com logs longos."*
* **Resposta Técnica:** 
  1. A IA operará em modo **Assistido / Human-in-the-loop**: nenhuma ação de RMM ou envio de mensagem é disparada de forma autônoma.
  2. Implementação de truncamento rígido de contexto a 4.000 caracteres no backend Go (`lib/ai.go`) e cota mensal de tokens por tenant em `ai_usage_quotas`.

---

### TOP 2: Módulo de Contratos, Financeiro e Banco de Horas

#### a) Abordagem Recomendada e Justificativa
* **Abordagem:** Ativação e expansão das colunas adormecidas em `public.contracts` (`monthly_hours`, `sla_config_id`), criação do motor de fechamento de ciclo mensal (`contract_billing_cycles`), precificação por hora de técnico (`contract_rate_cards`) e cálculo de horas excedentes.
* **Por que venceu:** É a funcionalidade que define a decisão de compra de um MSP (prestador de serviços gerenciados). O modelo relacional já possui a tabela `contracts` ([`src/integrations/supabase/types.ts:180-240`](file:///C:/Users/suporte.ti/Documents/orion-system/src/integrations/supabase/types.ts#L180-L240)) e o timer de apontamento em tempo real [`src/components/ticket/TimeTracker.tsx:1-189`](file:///C:/Users/suporte.ti/Documents/orion-system/src/components/ticket/TimeTracker.tsx#L1-L189). O risco de infraestrutura é zero (opera 100% em PostgreSQL relacional padrão ACID).

#### b) Arquivos Tocados
* `supabase/migrations/20260901000002_contract_billing_hour_bank.sql`: Criação de `contract_billing_cycles`, `contract_rate_cards`, `contract_invoices` e adição de `contract_id` / `billing_cycle_id` em `time_entries`.
* `src/components/admin/ContractManagement.tsx:22-89`: Expansão do formulário de contratos para configurar franquia de horas, valor da hora extra e renovação.
* `src/pages/TicketDetails.tsx:632-638, 1140-1180`: Integração da validação de saldo de banco de horas no card de encerramento do chamado.
* `src/components/contracts/HourBankProgressBar.tsx`: Novo componente visual de consumo de franquia (Verde/Âmbar/Vermelho).
* `src/pages/Contracts.tsx`: Nova visão consolidada de contratos para técnicos e gestores.

#### c) Mudanças de Schema e RLS
* **Schema:**
  ```sql
  CREATE TABLE public.contract_billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cycle_start_date DATE NOT NULL,
    cycle_end_date DATE NOT NULL,
    contracted_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    consumed_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    overage_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(contract_id, cycle_start_date)
  );
  ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS billing_cycle_id UUID REFERENCES public.contract_billing_cycles(id) ON DELETE SET NULL;
  ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS hourly_rate_applied NUMERIC(10, 2) DEFAULT 0.00;
  ```
* **RLS:** Visualização permitida a `admin` e `technician`. Clientes (`customer`) consultam apenas o extrato resumido de horas consumidas da sua empresa.

#### d) Critério de Sucesso Verificável
1. Ao registrar tempo no `TimeTracker.tsx`, o saldo do ciclo atual em `contract_billing_cycles` é decrementado atomicamente.
2. Chamados abertos após o esgotamento da franquia (100% de horas) são marcados visualmente com badge de "Hora Extra Faturável".
3. Exportação do Espelho de Fechamento Mensal em PDF/Excel com discriminação exata por chamado e técnico.

#### e) Riscos e Mitigações
* **Risco:** Contenção de lock de linha (*row-level lock*) na tabela de contratos durante múltiplos fechamentos simultâneos de chamados.
* **Mitigação:** Os apontamentos em `time_entries` são gravados de forma independente; a consolidação do saldo do ciclo é realizada via agregação assíncrona ou no fechamento da competência.

#### f) Ataque do Subagente F e Resposta da Engenharia
* **Ataque do Subagente F:** *"Transformar o Orion em ERP fiscal gerará pesadelo tributário (NFS-e de 5.000 municípios, conciliação bancária, regras sindicais de horas)."*
* **Resposta Técnica:** 
  1. O escopo é estritamente **Operacional / PSA de TI**: controle de franquia de horas, medição de chamados e extrato de faturamento.
  2. O Orion NÃO emitirá notas fiscais nem fará cobrança bancária direta; ele fornecerá **exportação limpa e webhooks para ERPs de mercado** (Omie, ContaAzul, Asaas).

---

### TOP 3: API Pública Documentada e Webhooks de Saída

#### a) Abordagem Recomendada e Justificativa
* **Abordagem:** Criação de endpoints versionados `/api/v1/*` em Go (Chi Router) com autenticação por API Key corporativa com escopos granulares (RBAC), documentação interativa OpenAPI 3.1 renderizada via **Scalar** ([scalar.com](https://scalar.com)), e motor de Outbound Webhooks com assinatura criptográfica HMAC-SHA256 padrão **Standard Webhooks** ([standardwebhooks.com](https://www.standardwebhooks.com)).
* **Por que venceu:** O backend Go já possui validação de chaves em `lib/db.go:380-388` e middleware de rate limit em `supabase/migrations/20260825000600_persistent_rate_limit_counters.sql:19`. Permite que os clientes conectem o Orion ao Zapier, Make, n8n e ERPs sem demandar desenvolvimento de integrações proprietárias pelo time do Orion.

#### b) Arquivos Tocados
* `supabase/migrations/20260901000003_public_api_and_webhooks.sql`: Criação de `webhook_endpoints`, `webhook_deliveries` e adição de `scopes` / `allowed_ips` em `api_keys`.
* `handler/api_v1_handlers.go`: Handlers REST públicos (`GET /api/v1/tickets`, `POST /api/v1/tickets`, `GET /api/v1/assets`, `GET /api/v1/contracts`).
* `handler/webhook_dispatcher.go`: Worker de despacho HTTP assíncrono com retentativa exponencial e assinatura HMAC.
* `lib/openapi.json`: Especificação OpenAPI 3.1 gerada estaticamente.
* `src/pages/DeveloperPortal.tsx`: Nova página de gerenciamento de API Keys, cadastro de Webhooks e visualização da documentação Scalar.

#### c) Mudanças de Schema e RLS
* **Schema:**
  ```sql
  ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT ARRAY['tickets:read', 'tickets:write']::text[];
  ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER NOT NULL DEFAULT 120;
  
  CREATE TABLE public.webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_url TEXT NOT NULL CHECK (target_url ~ '^https://.+'),
    secret_token TEXT NOT NULL,
    subscribed_events TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
* **RLS:** Gestão de chaves e webhooks restrita a `admin` e `developer` da empresa titular.

#### d) Critério de Sucesso Verificável
1. Consulta de tickets via `curl -H "Authorization: Bearer orn_live_..." /api/v1/tickets` respondendo em < 50ms com headers `X-RateLimit-*`.
2. Criação de ticket dispara webhook HTTP POST em < 500ms com header `X-Orion-Signature-256` validável pelo destinatário.
3. Documentação interativa em `/desenvolvedores/docs` carregando sem erros de console.

#### e) Riscos e Mitigações
* **Risco (SSRF - Server-Side Request Forgery):** Usuário cadastrar webhook apontando para `http://169.254.169.254` ou portas internas do Supabase.
* **Mitigação:** Validação rígida no Go (`net.LookupIP`): rejeição mandatória de IPs privados (RFC 1918, RFC 3927 loopback, metadados de nuvem e esquemas não-HTTPS).

#### f) Ataque do Subagente F e Resposta da Engenharia
* **Ataque do Subagente F:** *"Serverless da Vercel mata goroutines após a resposta HTTP; disparar webhooks com retry sem servidor stateful causará perda de eventos."*
* **Resposta Técnica:** 
  1. O enfileiramento de webhooks será gravado na tabela transacional `webhook_deliveries` via trigger Postgres.
  2. O disparo é orquestrado de forma assíncrona desacoplada via **QStash (Upstash)** ou cron de despacho a cada 1 minuto, garantindo retries exponenciais sem reter a conexão do usuário.

---

## 3. Débitos Técnicos que Barateiam o Roadmap

A auditoria identificou débitos específicos que, se sanados previamente, geram economia comprovada de horas de desenvolvimento:

```
┌───────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────┬─────────────┐
│ Débito Técnico a Pagar                        │ Lacunas Beneficiadas Diretamente                                  │ Redução de  │
│                                               │                                                                   │ Esforço DEV │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┼─────────────┤
│ 1. Decomposição do `TicketDetails.tsx`        │ • Lacuna 1: Multicanal (Reuso no Inbox 360°)                      │   -55%      │
│    (1.459 linhas: extrair Timeline, Context,  │ • Lacuna 5: IA Copilot (Injeção limpa de sugestões)               │   -50%      │
│     TimeTracker e Modais)                     │ • Lacuna 7: Contratos & Horas (Integração sem duplicar regras)    │   -40%      │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┼─────────────┤
│ 2. Decomposição do `Reports.tsx`              │ • Lacuna 3: Relatórios Personalizados (Widgets atômicos)          │   -65%      │
│    (1.193 linhas: isolar abas analíticas      │ • Lacuna 4: Agendamento por E-mail (Exportação headless)          │   -60%      │
│     e extrair hook `useReportFilters`)        │                                                                   │             │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┼─────────────┤
│ 3. Lazy Loading do Recharts                   │ • Redução de 400 kB no carregamento inicial de rotas analíticas   │   -30%      │
│    (Transformar gráficos em micro-chunks)     │ • Elimina travamento da main thread no builder de relatórios      │             │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┼─────────────┤
│ 4. Ajuste do Pool de Conexões Serverless      │ • Estabilidade de todo o backend Go sob carga de webhooks/APIs    │   -40%      │
│    (`lib/db.go`: MaxConns = 3 via Supavisor)  │ • Previne esgotamento de conexões no Supabase (porta 6543)        │             │
└───────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────┴─────────────┘
```

---

## 4. O que NÃO Fazer (Justificativas Técnicas e Financeiras)

1. **NÃO Desenvolver Aplicativo Mobile Nativo (iOS/Android do zero):**
   * *Justificativa:* Custo de desenvolvimento duplicado (Flutter/React Native), taxas recorrentes de lojas ($99/ano Apple), burocracia de aprovação e suporte a centenas de modelos de aparelhos. O técnico de MSP atua 95% do tempo no desktop.
   * *Alternativa Adotada:* Evolução do frontend atual para **PWA Avançado** (Service Worker + Web Push + layout otimizado para touch).
2. **NÃO Construir um Custom Query Builder Dinâmico (Mini-Metabase/BI genérico):**
   * *Justificativa:* Risco altíssimo de exaustão de CPU/IOPS no PostgreSQL por queries analíticas sem índices adequados geradas por usuários não-técnicos, além de risco de bypass de RLS.
   * *Alternativa Adotada:* Expandir a biblioteca de **relatórios pré-formatados e indexados** e fornecer **exportação limpa de dados para CSV/Excel**.
3. **NÃO Desenvolver Motor de Acesso Remoto Gráfico (WebRTC Screen Sharing) Próprio no Serverless:**
   * *Justificativa:* A infraestrutura Vercel Serverless não suporta conexões TCP/UDP de streaming contínuo de vídeo a 30/60 fps nem servidores de sinalização stateful.
   * *Alternativa Adotada:* Manter e evoluir o **Terminal CLI interativo** (que resolve 90% das tarefas de suporte silencioso) e adotar **Deep Link de 1 clique com RustDesk Self-Hosted** (`rustdesk://...`) para acesso visual à tela.
4. **NÃO Construir Gateway de Telefonia / VoIP Próprio (Asterisk/SIP):**
   * *Justificativa:* Alta complexidade regulatória, latência de áudio, necessidade de servidores de mídia dedicados e baixo volume de uso frente ao WhatsApp e portal web.

---

## 5. Suposições e Perguntas em Aberto para Decisão

1. **Provedor de IA Homologado:**
   * *Suposição:* O **Google Gemini 2.0 Flash** será o provedor padrão devido à velocidade (< 800ms) e custo ultra-baixo ($0.10/1M tokens), com fallback opcional para OpenAI GPT-4o-mini.
   * *A Confirmar:* Deseja utilizar uma chave central do Orion (repassando custo na mensalidade) ou permitir que cada MSP insira sua própria API Key de IA?
2. **Estratégia de WhatsApp para a Fase Pós-Lançamento:**
   * *Suposição:* O Orion adotará exclusivamente a **Meta Cloud API Oficial** ou integração via Webhooks com plataformas prontas (ex: Chatwoot/Evolution externo), banindo o uso de instâncias não-oficiais não-homologadas dentro do core da plataforma.
   * *A Confirmar:* O posicionamento oficial de produto aceita a Meta Cloud API com cobrança oficial por conversa?
3. **Gateway de Pagamento / Cobrança de Contratos:**
   * *Suposição:* O Orion focará estritamente no controle de saldo de horas e medição de chamados, fornecendo webhooks e CSVs para ERPs contábeis/financeiros externos (Omie, ContaAzul, Asaas).
   * *A Confirmar:* Confirma que o Orion NÃO deve atuar como emissor direto de faturas bancárias e notas fiscais (NFS-e)?

---

**FIM DO RELATÓRIO — AGUARDANDO APROVAÇÃO EXPLÍCITA PARA OS PRÓXIMOS PASSOS.**
