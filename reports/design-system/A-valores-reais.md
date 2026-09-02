# Relatório de Auditoria — Fonte de Verdade dos Valores Reais do Sistema

**Subagente:** Subagente A — Fonte de Verdade dos Valores Reais  
**Projeto:** Orion System  
**Data:** 31/08/2026  
**Escopo:** Auditoria de Enums, Tipos TypeScript, Constraints de Banco de Dados, Constantes de Aplicação e Mapeamento de Divergências (Fase 1: Read-Only).  
**Arquivo de Saída:** `reports/design-system/A-valores-reais.md`

---

## 1. Resumo Executivo & Metodologia

Este documento estabelece o mapeamento autoritativo de **todos os estados, status, prioridades e severidades** em execução no Orion System. A análise inspecionou:
- Definições de esquema Supabase/PostgreSQL em `supabase/migrations/*.sql`
- Esquema gerado em `src/integrations/supabase/types.ts`
- Tipagens e esquemas Zod em `src/lib/validation.ts` e `src/hooks/`
- Lógica de backend Go em `lib/monitoring.go` e `handler/*.go`
- Componentes e páginas de interface em `src/components/` e `src/pages/`

---

## 2. Dimensões Primárias: Sistema de Chamados & SLA

### 2.1. Status de Chamado (`tickets.status`)

* **Definição no Banco:** Coluna `status TEXT NOT NULL DEFAULT 'open'` na tabela `public.tickets`.
* **Constraint Atual no Banco (`20260320000000_fix_ticket_status_enum.sql`):**
  ```sql
  CHECK (status IN ('open', 'in-progress', 'awaiting-customer', 'awaiting-third-party', 'resolved', 'closed', 'reopened', 'cancelled'))
  ```
* **Tipo TypeScript Exato:** `TicketStatus` em `src/lib/validation.ts` e `Ticket['status']` em `src/hooks/useTickets.ts`:
  ```typescript
  type TicketStatus = 'open' | 'in-progress' | 'awaiting-customer' | 'awaiting-third-party' | 'resolved' | 'closed' | 'reopened' | 'cancelled';
  ```
* **Mapeamento de Valores e Comportamento na UI (`src/components/shared/StatusBadge.tsx`):**

| Valor String (`status`) | Rótulo UI (`label`) | Dot Color | Badge Styling Atual | Descrição do Estado |
| :--- | :--- | :--- | :--- | :--- |
| `open` | Aberto | `bg-blue-500` | `bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400` | Chamado recém-criado na fila, aguardando início de atendimento. |
| `in-progress` | Em Atendimento | `bg-yellow-500` | `bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400` | Técnico iniciou o trabalho ativo no ticket (SLA em contagem regressiva ativa). |
| `awaiting-customer` | Aguard. Cliente | `bg-purple-500` | `bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400` | Aguardando resposta ou validação do cliente (**SLA pausado**). |
| `awaiting-third-party` | Aguard. Terceiro | `bg-indigo-500` | `bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-400` | Aguardando fornecedor/operadora/garantia externa (**SLA pausado**). |
| `resolved` | Resolvido | `bg-green-500` | `bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400` | Solução aplicada pelo técnico; aguarda fechamento automático ou avaliação. |
| `closed` | Concluído | `bg-muted-foreground` | `bg-muted text-muted-foreground border-border` | Chamado finalizado em definitivo; histórico consolidado. |
| `reopened` | Reaberto | `bg-orange-500` | `bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400` | Cliente ou técnico reativou um chamado resolvido/fechado por reincidência. |
| `cancelled` | Cancelado | `bg-destructive` | `bg-destructive/10 text-destructive border-destructive/20` | Chamado descartado, duplicado ou cancelado pelo solicitante/gestor. |

---

### 2.2. Níveis de Prioridade (`tickets.priority`)

* **Definição no Banco:** Coluna `priority TEXT NOT NULL DEFAULT 'medium'` na tabela `public.tickets`.
* **Constraint Atual no Banco (`20251022014710_2d6838e4-0e09-4289-87f3-314868a573c1.sql`):**
  ```sql
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
  ```
* **Tipo TypeScript Exato:** `TicketPriority` em `src/lib/validation.ts` e `Ticket['priority']` em `src/hooks/useTickets.ts`:
  ```typescript
  type TicketPriority = 'urgent' | 'high' | 'medium' | 'low';
  ```
* **Mapeamento de Valores e Comportamento na UI (`src/components/shared/PriorityBadge.tsx`):**

| Valor String (`priority`) | Rótulo UI (`label`) | Badge Styling Atual | Descrição do Nível |
| :--- | :--- | :--- | :--- |
| `urgent` | Urgente | `bg-destructive/10 text-destructive border-destructive/30` | Incidente crítico com parada total de operação ou impacto em massa. |
| `high` | Alta | `bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30` | Incidente de alto impacto em setor vital ou com degradação severa. |
| `medium` | Média | `bg-warning/10 text-warning border-warning/30` | Falha moderada ou solicitação operacional com contorno disponível. |
| `low` | Baixa | `bg-muted text-muted-foreground border-border` | Dúvida simples, melhoria cosmética ou solicitação de rotina sem urgência. |

---

### 2.3. Estados de SLA (`tickets.sla_status`, Datas e Violação)

* **Definição no Banco:** Coluna `sla_status TEXT DEFAULT 'ok'` na tabela `public.tickets`.
* **Constraint no Banco (`20260622000000_fix_sla_status_constraint.sql`):**
  ```sql
  CHECK (sla_status IN ('ok', 'warning', 'attention', 'breached'))
  ```
* **Tipo TypeScript Exato:** `Ticket['sla_status']` e `calculateSlaStatus` em `src/lib/ticket-helpers.ts` e `src/components/dashboard/SLABadge.tsx`:
  ```typescript
  type SLAStatus = 'ok' | 'warning' | 'attention' | 'breached' | null;
  ```
* **Regras de Negócio e Limiares de Tempo:**
  1. `breached` (Vencido): `NOW() > sla_due_date`
  2. `attention` (Crítico): `% restante <= 10%` OU `tempo restante <= 2 horas (7200 segundos)`
  3. `warning` (Atenção): `% restante <= 25%`
  4. `ok` (No prazo): `% restante > 25%`
* **Mecanismo de Pausa de SLA:**
  - Status que pausam o SLA: `awaiting-customer` e `awaiting-third-party`.
  - Campos de controle: `sla_paused_at` (timestamp da pausa) e `sla_accumulated_pause_minutes` (minutos acumulados em pausa compensados ao reativar).
* **Mapeamento de Valores e Comportamento na UI (`src/components/dashboard/SLABadge.tsx`):**

| Valor String (`sla_status`) | Rótulo UI (`label`) | Ícone | Dot Color | Badge Styling Atual |
| :--- | :--- | :--- | :--- | :--- |
| `ok` | No prazo | `Clock` | `bg-success` | `bg-success/15 text-success border-success/30` |
| `warning` | Atenção | `Clock` | `bg-warning` | `bg-warning/15 text-warning border-warning/30` |
| `attention` | Crítico | `AlertTriangle` | `bg-warning` | `bg-warning/20 text-warning border-warning/40` |
| `breached` | Vencido | `AlertCircle` | `bg-destructive` | `bg-destructive/15 text-destructive border-destructive/30` |

---

## 3. Dimensões Secundárias da Plataforma Orion

### 3.1. Status de Máquina (RMM & Monitoring)

O subsistema de monitoramento RMM opera com dois eixos de status: o **Status Operacional de Conectividade** e o **Approval Gate (Aprovação)**.

#### A) Status Operacional (`machines.status` / `DeviceStatus`)
* **Banco de Dados (`public.machines`):** Coluna `status TEXT NOT NULL DEFAULT 'offline'`.
* **Valores Persistidos / Aceitos no Backend Go & Frontend:**
  * `online`: Agente enviando métricas em tempo real (`last_seen > NOW() - INTERVAL '5 minutes'`).
  * `offline`: Agente sem contato recente.
  * `alerta`: Máquina conectada com alertas críticos ou avisos não resolvidos de hardware/antivírus/disco/CPU.
* **Tipo TypeScript Exato (`src/hooks/useMonitoring.ts` e `src/hooks/useDeviceInventory.ts`):**
  ```typescript
  type DeviceStatus = 'online' | 'offline' | 'alerta';
  ```

#### B) Approval Gate de Agentes (`machines.approval_status`)
* **Banco de Dados (`20260821150000_add_machine_approval_gate.sql`):**
  ```sql
  CHECK (approval_status IN ('pending', 'approved', 'rejected'))
  ```
* **Valores:**
  * `pending`: Máquina recém-instalada aguardando homologação pelo técnico/gestor.
  * `approved`: Máquina autorizada e monitorada ativamente.
  * `rejected`: Instalação rejeitada/bloqueada.

---

### 3.2. Status de Ativos de Hardware & CMDB (`assets.status` e `assets.type`)

* **Definição no Banco (`public.assets` em `20260316000000_add_cmdb_assets.sql`):**
  * `status TEXT NOT NULL DEFAULT 'active'`
  * `type TEXT NOT NULL DEFAULT 'Hardware'`
* **Valores de Status no Banco (Patrimonial):**
  * `active` (Ativo / Em uso)
  * `maintenance` (Em manutenção)
  * `retired` (Desativado / Descarte)
  * `lost` (Extraviado)
* **Valores de Tipo de Ativo no Banco:**
  * `Hardware`, `Software`, `License`, `Network`
* **Campos Complementares de Conectividade:** `os`, `internal_ip`, `hostname`, `last_check`.
* **Tipo TypeScript Exato no Inventário Unificado (`src/hooks/useDeviceInventory.ts`):**
  * O frontend funde ativos patrimoniais e máquinas RMM sob `DeviceItem`, onde o status exibido na interface adota o status operacional `online | offline | alerta`.

---

### 3.3. Status de Contratos (`contracts`)

* **Definição no Banco (`public.contracts`):**
  * Coluna booleana `is_active BOOLEAN NOT NULL DEFAULT true`.
  * Parâmetros temporais: `start_date DATE NOT NULL`, `end_date DATE NULL`.
  * Controle de cotas: `tickets_limit INT NULL`, `tickets_used INT NULL DEFAULT 0`, `monthly_hours INT NULL`.
* **Tipo TypeScript Exato (`src/hooks/useContracts.ts`):**
  ```typescript
  export interface Contract {
    id: string;
    company_id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    tickets_limit: number | null;
    tickets_used: number | null;
    monthly_hours: number | null;
    sla_config_id: string | null;
  }
  ```
* **Estados de Interface (`src/components/admin/ContractManagement.tsx`):**
  * **Vigência:**
    * `Ativo`: `is_active === true` (`Badge variant="default"`)
    * `Inativo`: `is_active === false` (`Badge variant="secondary"`)
  * **Consumo de Franquia / Cotas:**
    * Normal (< 80% do limite): `bg-primary`
    * Alerta (>= 80% e < 100%): `bg-warning` com ícone `AlertTriangle`
    * Excedido (>= 100%): `bg-destructive` com `AlertTriangle` em animação `animate-pulse`

---

### 3.4. Status de Usuários, Roles, Convites & Agentes

#### A) Roles do Sistema (`public.user_roles.role` / `app_role` Enum)
* **Enum PostgreSQL (`types.ts`):** `['customer', 'technician', 'admin', 'developer']`
* **Mapeamento na Interface (`src/components/admin/UserManagement.tsx`):**
  * `customer` -> "Colaborador" (Usuário final da empresa cliente)
  * `technician` -> "Técnico" (Operador de suporte e monitoramento)
  * `admin` -> "Gestor" (Administrador da empresa)
  * `developer` -> Role mestre global (sistema/sustentação, não selecionável no combo comum)

#### B) Status do Usuário na Gestão
* **Interface / Payload (`admin-update-user`):**
  * `active`: "Ativo"
  * `inactive`: "Inativo"
* **Contas Criadas Automaticamente pelo Agente (Ghost Accounts):**
  * Padrão de e-mail: `machine-[^@]+@orion\.internal`
  * Badge visual na UI: `"agente"` (`bg-muted text-muted-foreground text-[10px]`)

#### C) Convites (`public.invite_tokens`)
* **Estados Calculados:**
  * `Pendente`: `used_at IS NULL AND expires_at > now()`
  * `Utilizado`: `used_at IS NOT NULL`
  * `Expirado`: `used_at IS NULL AND expires_at <= now()`

---

### 3.5. Tipos e Severidades de Alerta (`machine_alerts`)

* **Definição no Banco (`public.machine_alerts`):**
  * `type TEXT`: Tipo do componente gerador do alerta.
  * `severity TEXT`: Nível de criticidade.
  * `resolved BOOLEAN DEFAULT false`: Estado de resolução.
* **Tipo TypeScript Exato (`src/hooks/useMonitoring.ts`):**
  ```typescript
  export interface CriticalAlertItem {
    alert_type: 'offline' | 'disk' | 'cpu' | 'antivirus' | 'firewall' | 'updates' | 'alert' | string;
    severity: 'critical' | 'warning' | string;
    message: string;
    resolved: boolean;
  }
  ```
* **Mapeamento de Severidades & Cores na UI (`src/pages/AlertsDashboard.tsx`):**
  * `critical` (Crítico): Badge `bg-destructive text-destructive-foreground` + ícone pulsante (`animate-pulse`).
  * `warning` (Atenção): Badge `bg-warning text-warning-foreground`.
* **Tipos de Alerta Suportados:**
  * `antivirus`: Alerta de proteção Endpoint ausente ou desativada (`ShieldAlert`, vermelho).
  * `firewall`: Alerta de firewall desativado (`ShieldAlert`, vermelho).
  * `offline`: Máquina desconectada há mais de 30 minutos (`WifiOff`, vermelho).
  * `disk`: Uso de partição principal > 90% (`HardDrive`, âmbar/laranja).
  * `cpu`: Carga contínua elevada (`Cpu`, âmbar).
  * `updates`: Atualizações críticas do Windows pendentes (`RotateCcw`, âmbar).

---

### 3.6. Monitoramento Web & Links de Rede (`monitored_endpoints`)

* **Tipo TypeScript Exato (`src/hooks/useWebMonitoring.ts`):**
  ```typescript
  export interface MonitoredEndpoint {
    status: 'online' | 'offline' | 'pending' | 'paused' | string;
  }
  ```
* **Mapeamento na Interface (`src/pages/WebMonitoring.tsx`):**
  * `online`: ONLINE (`bg-emerald-500/10 text-emerald-600 border-emerald-500/30`)
  * `offline`: OFFLINE (`bg-rose-500/10 text-rose-600 border-rose-500/30`)
  * `pending`: PENDENTE (`bg-amber-500/10 text-amber-600 border-amber-500/30`)
  * `paused`: PAUSADO (`bg-muted text-muted-foreground border-border`)

---

### 3.7. Patch Management & Implantação de Pacotes (`package_deployments`)

* **Definição no Banco & TypeScript (`src/hooks/usePatchManagement.ts`):**
  ```typescript
  export interface PackageDeployment {
    status: 'pending' | 'dispatched' | 'completed' | 'failed';
  }
  ```
* **Mapeamento na Interface (`src/pages/PatchManagement.tsx`):**
  * `pending`: "Pendente" (`bg-amber-500/10 text-amber-600 border-amber-500/30`)
  * `dispatched`: "Despachado" (`bg-blue-500/10 text-blue-600 border-blue-500/30`)
  * `completed`: "Concluído" (`bg-green-500/10 text-green-600 border-green-500/30`)
  * `failed`: "Falhou" (`bg-red-500/10 text-red-600 border-red-500/30`)

---

### 3.8. Base de Conhecimento (`knowledge_base_articles`)

* **Definição no Banco (`public.knowledge_base_articles`):**
  * `status TEXT NOT NULL DEFAULT 'draft'`
  * `is_public BOOLEAN NOT NULL DEFAULT false`
* **Mapeamento na Interface (`src/pages/KnowledgeBase.tsx`):**
  * `draft`: "Rascunho"
  * `published`: "Publicado"

---

## 4. Mapeamento Completo de Divergências Encontradas

A auditoria identificou divergências pontuais entre o Banco de Dados, Tipos TypeScript e Renderização na UI que devem ser normalizadas:

### ⚠️ Divergência 1: Formato de Status de Chamado (`in_progress` vs `in-progress`) em `src/pages/Assets.tsx`
* **Localização:** `src/pages/Assets.tsx`, linha 1085:
  ```tsx
  ticket.status === "resolved" || ticket.status === "closed"
    ? "success"
    : ticket.status === "in_progress"
    ? "warning"
    : "info"
  ```
* **Problema:** A checagem busca `in_progress` (com underscore). No entanto, o banco de dados (`20260320000000_fix_ticket_status_enum.sql`), o validador Zod (`validation.ts`) e o hook `useTickets.ts` utilizam estritamente `in-progress` (com hífen).
* **Impacto:** Chamados em atendimento vinculados a um ativo na gaveta de detalhes caem indevidamente no fallback `"info"` em vez de exibirem o estilo `"warning"`.

---

### ⚠️ Divergência 2: Nomenclatura de Prioridades Inexistentes (`critica`, `alta`) em `src/pages/Assets.tsx`
* **Localização:** `src/pages/Assets.tsx`, linha 1096:
  ```tsx
  ticket.priority === "critica" || ticket.priority === "urgent" || ticket.priority === "alta"
    ? "destructive"
    : "secondary"
  ```
* **Problema:** O código verifica strings em português `"critica"` e `"alta"`. No schema do sistema, os valores canônicos são `'urgent'`, `'high'`, `'medium'`, `'low'`.
* **Impacto:** Chamados com prioridade `'high'` (Alta) não recebem a variante `"destructive"` ou destaque adequado, caindo em `"secondary"`.

---

### ℹ️ Divergência 3: Duplo Modelo de Status em Ativos (Patrimonial CMDB vs Operacional RMM)
* **Localização:** `supabase/migrations/20260316000000_add_cmdb_assets.sql` vs `src/pages/Assets.tsx`.
* **Problema:** O banco modela a tabela `assets` com status patrimonial (`active`, `maintenance`, `retired`, `lost`). Porém, a UI em `Assets.tsx` e o hook `useDeviceInventory.ts` unificam máquinas e ativos apresentando status operacional (`online`, `offline`, `alerta`).
* **Recomendação para a arquitetura de tokens:** Separar conceitualmente nos tokens:
  1. *Status Operacional de Dispositivo* (`online` / `offline` / `alerta`)
  2. *Status Patrimonial / Ciclo de Vida do Ativo* (`active` / `maintenance` / `retired` / `lost`)

---

### ℹ️ Divergência 4: Representação de Status de Contrato (Booleano vs Estados de Negócio)
* **Localização:** `public.contracts` vs `src/components/admin/ContractManagement.tsx`.
* **Problema:** A tabela de contratos não possui uma coluna enum de status, operando com `is_active: boolean` + `start_date`/`end_date`. A UI infere estados como "Ativo", "Inativo" e o nível de consumo de cotas (Normal, Atenção 80%, Excedido 100%).
* **Recomendação:** Garantir que o Design System possua tokens semânticos claros para barras de progresso e badges de limites de cota.

---

## 5. Tabela de Referência Rápida para o Design System

Esta tabela consolida os valores autoritativos que servirão de base para a padronização das cores de estado e tokens semânticos (Fases 2 e seguintes):

```
┌─────────────────────────┬───────────────────────────────┬──────────────────────┬────────────────────────────┐
│ Dimensão                │ Valores Canônicos             │ Rótulo UI em PT-BR   │ Semântica de Cor           │
├─────────────────────────┼───────────────────────────────┼──────────────────────┼────────────────────────────┤
│ Ticket Status           │ open                          │ Aberto               │ Info / Azul                │
│                         │ in-progress                   │ Em Atendimento       │ Warning / Amarelo          │
│                         │ awaiting-customer             │ Aguard. Cliente      │ Accent / Roxo              │
│                         │ awaiting-third-party          │ Aguard. Terceiro     │ Secondary / Índigo         │
│                         │ resolved                      │ Resolvido            │ Success / Verde            │
│                         │ closed                        │ Concluído            │ Muted / Cinza Neutro       │
│                         │ reopened                      │ Reaberto             │ Warning / Laranja          │
│                         │ cancelled                     │ Cancelado            │ Destructive / Vermelho     │
├─────────────────────────┼───────────────────────────────┼──────────────────────┼────────────────────────────┤
│ Ticket Priority         │ urgent                        │ Urgente              │ Destructive / Vermelho     │
│                         │ high                          │ Alta                 │ Warning / Laranja          │
│                         │ medium                        │ Média                │ Warning / Amarelo          │
│                         │ low                           │ Baixa                │ Muted / Cinza Neutro       │
├─────────────────────────┼───────────────────────────────┼──────────────────────┼────────────────────────────┤
│ SLA Status              │ ok                            │ No prazo             │ Success / Verde            │
│                         │ warning                       │ Atenção              │ Warning / Amarelo          │
│                         │ attention                     │ Crítico              │ Warning-High / Laranja     │
│                         │ breached                      │ Vencido              │ Destructive / Vermelho     │
├─────────────────────────┼───────────────────────────────┼──────────────────────┼────────────────────────────┤
│ Machine / Device Status │ online                        │ Online / Estável     │ Success / Verde (Emerald)  │
│                         │ offline                       │ Offline              │ Destructive / Vermelho     │
│                         │ alerta                        │ Alerta               │ Warning / Âmbar            │
│ Machine Approval        │ pending / approved / rejected │ Pendente/Aprov/Rejeit│ Amarelo / Verde / Vermelho │
├─────────────────────────┼───────────────────────────────┼──────────────────────┼────────────────────────────┤
│ Alert Severity          │ critical                      │ Crítico              │ Destructive / Vermelho     │
│                         │ warning                       │ Atenção              │ Warning / Âmbar            │
├─────────────────────────┼───────────────────────────────┼──────────────────────┼────────────────────────────┤
│ Package Deployment      │ pending / dispatched /        │ Pendente / Despachado│ Âmbar / Azul /             │
│                         │ completed / failed            │ Concluído / Falhou   │ Verde / Vermelho           │
├─────────────────────────┼───────────────────────────────┼──────────────────────┼────────────────────────────┤
│ Contract Status         │ active / inactive             │ Ativo / Inativo      │ Primary / Muted            │
│ Cota de Franquia        │ normal / warning / exceeded   │ <80% / >=80% / 100%  │ Primary / Warning / Destr. │
└─────────────────────────┴───────────────────────────────┴──────────────────────┴────────────────────────────┘
```

---
*Relatório gerado em modo estritamente read-only pelo Subagente A.*
