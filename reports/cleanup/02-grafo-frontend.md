# Relatório de Limpeza 02 — Grafo de Imports do Frontend

**Subagente**: Subagente 2 (Analisador de Grafo de Dependências e Reachability)  
**Data da Auditoria**: 31 de Agosto de 2026  
**Escopo**: Todos os 187 arquivos em `src/` (TypeScript, TSX, CSS).  

---

## 1. Entrypoints e Mapeamento de Rotas

O grafo de alcançabilidade foi construído a partir dos pontos de entrada oficiais da aplicação:
1. **Entrypoint Raiz**: `index.html` → `src/main.tsx` → `src/App.tsx` + `src/index.css`
2. **Rotas com Code-Splitting (`React.lazy` / `import()` dinâmico)** em `src/App.tsx`:
   - `Index.tsx`, `NewTicket.tsx`, `Settings.tsx`, `Admin.tsx`, `TicketDetails.tsx`, `Auth.tsx`, `SetPassword.tsx`, `NotFound.tsx`, `DebugTools.tsx`, `Reports.tsx`, `InfrastructureDashboard.tsx`, `AlertsDashboard.tsx`, `Monitoring.tsx`, `KnowledgeBase.tsx`, `TicketHistory.tsx`, `Avaliacao.tsx`, `Assets.tsx`, `ClientPortal.tsx`, `Automacoes.tsx`, `PatchManagement.tsx`, `Notifications.tsx`, `WebMonitoring.tsx`.
3. **Sub-imports Dinâmicos**:
   - `src/components/dashboard/WorkloadChart.tsx` (carregado dinamicamente em `TechnicianDashboard.tsx`)
   - `src/components/monitoring/RemoteTerminal.tsx` (carregado dinamicamente em `MachineDrawer.tsx`)
   - `src/lib/reports/exportPdf.ts` e `exportXlsx.ts` (carregados sob demanda ao exportar relatórios)
   - `src/lib/monitoring/exportMachinesXlsx.ts` (carregado sob demanda na tela de máquinas)

---

## 2. Arquivos Inalcançáveis a Partir dos Entrypoints (Código Órfão em `src/`)

Cruzando o grafo completo de 187 nós e 512 arestas, **6 arquivos de código de aplicação** foram identificados como estritamente inalcançáveis a partir de qualquer entrypoint:

| Arquivo Inalcançável | Linhas | Tamanho | Causa / Contexto | Classificação |
| :--- | :---: | :---: | :--- | :--- |
| `src/components/admin/RoutingRulesManagement.tsx` | 567 | 25.4 KB | Substituído por `src/components/automation/RulesTab.tsx` e `RuleForm.tsx`. Não é importado por `Admin.tsx` nem `Automacoes.tsx`. | **CÓDIGO MORTO** |
| `src/lib/routingRuleDisplay.ts` | 36 | 1.1 KB | Helper de mapeamento de nomes de regras, consumido unicamente por `RoutingRulesManagement.tsx`. | **CÓDIGO MORTO** |
| `src/lib/routingRuleDisplay.test.ts` | 32 | 1.0 KB | Teste unitário de `routingRuleDisplay.ts`. Se o helper for removido, o teste perde a razão de existir. | **CÓDIGO MORTO** |
| `src/components/monitoring/WebTelemetryTab.tsx` | 772 | 34.2 KB | Aba legada/órfã de telemetria web. A página `src/pages/WebMonitoring.tsx` implementou os gráficos e cards inline e nunca importou este componente. | **CÓDIGO MORTO** |
| `src/hooks/useHistoricalStats.ts` | 60 | 3.2 KB | Hook de estatísticas históricas que fazia N+1 queries seriais, confirmado na auditoria anterior como sem nenhum importador. | **CÓDIGO MORTO** |
| `src/hooks/useUserProfile.ts` | 6 | 210 B | Proxy re-export de `useUserRole`. Toda a aplicação importa `useUserProfile` diretamente de `@/hooks/useUserRole`. | **CÓDIGO MORTO** |

---

## 3. Componentes Shadcn Sem Consumidor (Registry Preservado)

Os arquivos abaixo não possuem importadores na árvore ativa, mas pertencem ao registry oficial do **shadcn/ui**:
- `src/components/ui/accordion.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/command.tsx`

> **Nota de Auditoria**: Conforme deliberado em `AUDIT.md` (item 5.3), componentes primitivos shadcn não causam overhead no bundle final (são excluídos pelo tree-shaking do Rollup/Vite) e devem ser mantidos como biblioteca de interface para acelerar o desenvolvimento de novas telas.

---

## 4. Arquivos de Teste e Tipos Globais (VIVOS por Definição)

Arquivos que não possuem importação direta via `main.tsx` mas são consumidos pelo runner do **Vitest** ou pelo compilador **TypeScript**:
- `src/vite-env.d.ts` (Ambient types lidos pelo `tsconfig.json`)
- `src/__tests__/mfa.test.ts` (15 testes executados)
- `src/__tests__/stability.test.tsx` (13 testes executados)
- `src/__tests__/userDisplayName.test.ts` (19 testes executados)
- `src/lib/reports/aggregations.test.ts` (5 testes executados)
- `src/lib/testDataDetection.test.ts` (4 testes executados)
- `src/lib/__tests__/lazyWithRetry.test.ts` (2 testes executados)

---

## 5. Ciclos de Dependência Identificados

Dois ciclos leves de importação foram detectados em `src/`:
1. `src/hooks/useTickets.ts` ↔ `src/mocks/tickets.ts`
2. `src/hooks/useTickets.ts` ↔ `src/lib/reports/aggregations.ts`

*Impacto*: Não quebram a execução graças ao hoist de módulos ESM no Vite, mas são pontos de atenção arquitetural para refatorações futuras.
