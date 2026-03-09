

# Modelo de Dados Relacional Completo -- Orion System

## Estado Atual do Banco

Tabelas existentes: `companies`, `profiles`, `user_roles`, `tickets`, `ticket_updates`, `ticket_attachments`, `notifications`, `audit_log`, `canned_responses`, `departments`, `plans`, `invite_tokens`.

O modelo abaixo **preserva todas as tabelas existentes** e propõe ajustes + novas entidades.

---

## 1. Tabelas Existentes -- Ajustes Necessarios

### 1.1 companies (já existe)
**Finalidade**: Empresa/cliente do sistema multi-tenant.

Campos a **adicionar**:
- `cnpj` text, nullable, unique -- Documento fiscal
- `phone` text, nullable
- `address` text, nullable
- `logo_url` text, nullable
- `settings` jsonb, default '{}' -- Config customizada (fuso, idioma, etc.)

Relacionamentos existentes: 1:N com profiles, tickets, departments, canned_responses.
Novos: 1:N com contracts, categories, services, sla_configs, knowledge_base_articles, custom_fields.

### 1.2 tickets (já existe)
**Finalidade**: Chamado de suporte.

Campos a **adicionar**:
- `contract_id` uuid, nullable, FK → contracts(id) -- Contrato vigente
- `service_id` uuid, nullable, FK → services(id) -- Item do catálogo
- `category_id` uuid, nullable, FK → categories(id) -- Substituir campo text `category` gradualmente
- `resolution_notes` text, nullable -- Resumo da resolução
- `satisfaction_rating` smallint, nullable, CHECK (1-5) -- Avaliação do cliente
- `satisfaction_comment` text, nullable
- `scheduled_date` timestamptz, nullable -- Agendamento futuro
- `closed_at` timestamptz, nullable -- Momento exato do fechamento
- `cancelled_at` timestamptz, nullable

Restrições existentes mantidas: NOT NULL em title, description, requester_name, category, priority, status, user_id, company_id.

### 1.3 profiles (já existe -- sem mudanças estruturais)
**Finalidade**: Perfil de usuário (cliente, técnico, admin).
Campos atuais: id, full_name, email, company_id, department, created_at, updated_at.
Papéis controlados via `user_roles` (tabela separada -- correto).

### 1.4 notifications (já existe -- sem mudanças)
**Finalidade**: Notificações in-app por usuário.
Campos: id, user_id, title, message, link, is_read, created_at.

### 1.5 ticket_attachments (já existe -- sem mudanças)
**Finalidade**: Anexos vinculados a tickets.
Campos: id, ticket_id, file_name, file_url, file_type, uploaded_by, created_at.

---

## 2. Novas Tabelas

### 2.1 sla_configs
**Finalidade**: Parametrização de SLA por contrato ou empresa. Permite SLAs diferentes para cada cliente.

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| id | uuid PK | Sim | gen_random_uuid() |
| name | text | Sim | Ex: "SLA Premium", "SLA Padrão" |
| company_id | uuid FK → companies | Sim | Dono da config |
| urgent_hours | integer | Sim | Horas para prioridade urgente |
| high_hours | integer | Sim | Horas para prioridade alta |
| medium_hours | integer | Sim | Horas para prioridade média |
| low_hours | integer | Sim | Horas para prioridade baixa |
| business_hours_only | boolean | Sim, default false | Se true, calcula apenas horas úteis |
| business_start | time | Não | Ex: 08:00 |
| business_end | time | Não | Ex: 18:00 |
| created_at | timestamptz | Sim | now() |
| updated_at | timestamptz | Sim | now() |

**Relacionamentos**: N:1 com companies. 1:N com contracts.
**Restrições**: Horas > 0. company_id NOT NULL. RLS por company_id.

### 2.2 contracts
**Finalidade**: Contrato de suporte vinculado a uma empresa-cliente, com SLA e banco de horas.

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| id | uuid PK | Sim | gen_random_uuid() |
| company_id | uuid FK → companies | Sim | Empresa contratante |
| name | text | Sim | Ex: "Contrato Anual 2026" |
| sla_config_id | uuid FK → sla_configs | Não | SLA associado (null = SLA padrão global) |
| monthly_hours | numeric | Não | Banco de horas mensal contratado |
| start_date | date | Sim | Início da vigência |
| end_date | date | Não | Fim (null = indeterminado) |
| is_active | boolean | Sim, default true | |
| notes | text | Não | Observações |
| created_at | timestamptz | Sim | now() |
| updated_at | timestamptz | Sim | now() |

**Relacionamentos**: N:1 com companies, N:1 com sla_configs. 1:N com tickets.
**Restrições**: company_id NOT NULL. start_date NOT NULL. end_date >= start_date (CHECK).

### 2.3 categories
**Finalidade**: Categorias hierárquicas para classificação de tickets (substitui o campo text).

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| id | uuid PK | Sim | gen_random_uuid() |
| name | text | Sim | Ex: "Hardware", "Rede" |
| parent_id | uuid FK → categories | Não | Null = raiz; permite árvore |
| company_id | uuid FK → companies | Sim | Isolamento multi-tenant |
| icon | text | Não | Nome do ícone (lucide) |
| description | text | Não | |
| is_active | boolean | Sim, default true | |
| sort_order | integer | Não, default 0 | Ordenação |
| created_at | timestamptz | Sim | now() |

**Relacionamentos**: Self-referencing (parent_id). N:1 com companies. 1:N com tickets, services.
**Restrições**: name + company_id + parent_id UNIQUE. parent_id != id (evitar ciclo direto).

### 2.4 services (Catálogo de Serviços)
**Finalidade**: Itens de serviço padronizados que podem ser selecionados ao criar um ticket.

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| id | uuid PK | Sim | gen_random_uuid() |
| name | text | Sim | Ex: "Formatação de máquina" |
| description | text | Não | |
| category_id | uuid FK → categories | Não | Categoria associada |
| company_id | uuid FK → companies | Sim | Multi-tenant |
| default_priority | text | Não | Sugestão de prioridade |
| estimated_hours | numeric | Não | Estimativa para planejamento |
| is_active | boolean | Sim, default true | |
| created_at | timestamptz | Sim | now() |
| updated_at | timestamptz | Sim | now() |

**Relacionamentos**: N:1 com companies, categories. 1:N com tickets.
**Restrições**: name + company_id UNIQUE.

### 2.5 ticket_status_history
**Finalidade**: Log imutável de todas as mudanças de status de um ticket, com timestamps exatos.

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| id | uuid PK | Sim | gen_random_uuid() |
| ticket_id | uuid FK → tickets | Sim | |
| old_status | text | Não | Null na criação |
| new_status | text | Sim | |
| changed_by | uuid FK → auth.users | Sim | Quem mudou |
| reason | text | Não | Motivo da mudança |
| created_at | timestamptz | Sim | now() |

**Relacionamentos**: N:1 com tickets.
**Restrições**: ticket_id NOT NULL, new_status NOT NULL. Tabela append-only (sem UPDATE/DELETE via RLS para não-developers).

### 2.6 time_entries (Apontamento de Horas)
**Finalidade**: Registro de tempo trabalhado por técnicos em cada ticket.

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| id | uuid PK | Sim | gen_random_uuid() |
| ticket_id | uuid FK → tickets | Sim | |
| user_id | uuid FK → auth.users | Sim | Técnico que registrou |
| start_time | timestamptz | Sim | Início do trabalho |
| end_time | timestamptz | Não | Null = timer ativo |
| duration_minutes | integer | Não | Calculado ou manual |
| description | text | Não | O que foi feito |
| billable | boolean | Sim, default true | Faturável ou interno |
| created_at | timestamptz | Sim | now() |
| updated_at | timestamptz | Sim | now() |

**Relacionamentos**: N:1 com tickets. N:1 com profiles (user_id).
**Restrições**: ticket_id NOT NULL. start_time NOT NULL. CHECK: end_time >= start_time. CHECK: duration_minutes >= 0. RLS: técnico só edita os próprios; admin vê da empresa.

### 2.7 knowledge_base_articles
**Finalidade**: Base de conhecimento com artigos pesquisáveis, vinculáveis a tickets.

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| id | uuid PK | Sim | gen_random_uuid() |
| title | text | Sim | |
| content | text | Sim | Corpo do artigo (Markdown/HTML) |
| category_id | uuid FK → categories | Não | |
| company_id | uuid FK → companies | Sim | Multi-tenant |
| is_public | boolean | Sim, default false | Visível para clientes? |
| status | text | Sim, default 'draft' | draft, published, archived |
| tags | text[] | Não | Array de tags |
| view_count | integer | Sim, default 0 | |
| created_by | uuid FK → auth.users | Sim | Autor |
| updated_by | uuid FK → auth.users | Não | Último editor |
| search_vector | tsvector | Não | Full-text search |
| created_at | timestamptz | Sim | now() |
| updated_at | timestamptz | Sim | now() |

**Relacionamentos**: N:1 com companies, categories. N:N com tickets (via tabela pivot `ticket_kb_links`).
**Restrições**: title NOT NULL, content NOT NULL, company_id NOT NULL.

### 2.8 ticket_kb_links (pivot)
**Finalidade**: Vincular artigos da KB a tickets.

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| id | uuid PK | Sim |
| ticket_id | uuid FK → tickets | Sim |
| article_id | uuid FK → knowledge_base_articles | Sim |
| linked_by | uuid FK → auth.users | Sim |
| created_at | timestamptz | Sim |

**Restrições**: UNIQUE(ticket_id, article_id).

### 2.9 custom_fields
**Finalidade**: Definição de campos personalizados configuráveis por empresa.

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| id | uuid PK | Sim | |
| company_id | uuid FK → companies | Sim | |
| name | text | Sim | Label do campo |
| field_type | text | Sim | text, number, date, select, checkbox |
| options | jsonb | Não | Opções para tipo select |
| required | boolean | Sim, default false | |
| applies_to | text | Sim | 'ticket' ou 'company' |
| sort_order | integer | Não, default 0 | |
| is_active | boolean | Sim, default true | |
| created_at | timestamptz | Sim | now() |

### 2.10 custom_field_values
**Finalidade**: Valores dos campos personalizados para cada entidade.

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| id | uuid PK | Sim |
| custom_field_id | uuid FK → custom_fields | Sim |
| entity_id | uuid | Sim | ID do ticket ou company |
| entity_type | text | Sim | 'ticket' ou 'company' |
| value | text | Não | Valor armazenado como text |
| created_at | timestamptz | Sim |
| updated_at | timestamptz | Sim |

**Restrições**: UNIQUE(custom_field_id, entity_id).

---

## 3. Diagrama de Relacionamentos (Pseudo-ER)

```text
companies ─────┬──── 1:N ──── profiles (users)
               │                   └── 1:1 ── user_roles
               ├──── 1:N ──── contracts
               │                   └── N:1 ── sla_configs
               ├──── 1:N ──── sla_configs
               ├──── 1:N ──── categories (self-ref parent_id)
               ├──── 1:N ──── services ── N:1 ── categories
               ├──── 1:N ──── knowledge_base_articles
               ├──── 1:N ──── custom_fields
               ├──── 1:N ──── departments
               └──── 1:N ──── canned_responses

tickets ───────┬──── N:1 ──── companies
               ├──── N:1 ──── profiles (user_id = requester)
               ├──── N:1 ──── profiles (assigned_to_user_id)
               ├──── N:1 ──── contracts (nullable)
               ├──── N:1 ──── categories (nullable, novo)
               ├──── N:1 ──── services (nullable, novo)
               ├──── 1:N ──── ticket_updates
               ├──── 1:N ──── ticket_attachments
               ├──── 1:N ──── ticket_status_history
               ├──── 1:N ──── time_entries
               ├──── N:N ──── knowledge_base_articles (via ticket_kb_links)
               └──── 1:N ──── custom_field_values (entity_type='ticket')

plans ─────────── 1:N ──── companies (current_plan_id)
```

---

## 4. Politica de RLS (Diretrizes)

Todas as novas tabelas seguem o padrão existente:
- **Isolamento por company_id**: Cada tabela com `company_id` tem RLS que restringe acesso à empresa do usuário.
- **Master company (Orion System)**: Admins e técnicos da empresa mestre veem todas as empresas.
- **Developers**: Acesso total (padrão existente).
- **ticket_status_history**: Append-only para todos exceto developers.
- **time_entries**: Técnico edita os próprios; admin vê todos da empresa; customer não vê.
- **knowledge_base_articles**: Clientes veem apenas `is_public = true` e `status = 'published'`.

---

## 5. Mapeamento para o Frontend (Lovable/React)

### Tipos TypeScript
Cada tabela gera uma interface no `types.ts` do Supabase (auto-gerado). Hooks customizados seguem o padrão existente:

- `useContracts(companyId?)` -- CRUD de contratos
- `useSlaConfigs(companyId?)` -- CRUD de configurações SLA
- `useCategories(companyId?)` -- Árvore de categorias
- `useServices(companyId?)` -- Catálogo de serviços
- `useTimeEntries(ticketId?)` -- Apontamentos de horas
- `useKnowledgeBase(companyId?)` -- Artigos da KB
- `useTicketStatusHistory(ticketId)` -- Timeline de status
- `useCustomFields(companyId, appliesTo)` -- Campos dinâmicos

### Componentes de UI (futuro)
- **ContractManagement.tsx** -- Admin page para CRUD de contratos
- **CategoryTree.tsx** -- Árvore hierárquica de categorias
- **TimeTracker.tsx** -- Timer flutuante no ticket
- **KnowledgeBase.tsx** -- Listagem e editor de artigos
- **ServiceCatalog.tsx** -- Catálogo com seleção no NewTicket
- **CustomFieldRenderer.tsx** -- Renderização dinâmica de campos

### Migração Gradual
O campo `tickets.category` (text) coexiste com `tickets.category_id` (uuid) durante a transição. Um script futuro migra os valores text para registros na tabela `categories` e popula `category_id`.

---

## 6. Ordem de Implementação Recomendada

1. **sla_configs + contracts** + colunas extras em tickets/companies (fundação para SLA customizado)
2. **categories** (hierárquica) + migração do campo text
3. **ticket_status_history** (trigger automático em mudança de status)
4. **time_entries** (apontamento de horas)
5. **services** (catálogo)
6. **knowledge_base_articles + ticket_kb_links**
7. **custom_fields + custom_field_values** (mais complexo, menor prioridade)

