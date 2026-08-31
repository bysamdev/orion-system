# PLANO DE LIMPEZA DO REPOSITÓRIO — ORION SYSTEM

**Data**: 31 de Agosto de 2026  
**Status**: FASE 1 CONCLUÍDA (100% READ-ONLY) · **AGUARDANDO APROVAÇÃO (GATE)**  
**Repositório**: `github.com/bysamdev/orion-system`  

---

## A. Números Consolidados

* **Total de Arquivos Auditados**: 1.128 arquivos
* **Arquivos Ativos & Vivos**: 1.114 arquivos (98.8%)
* **Candidatos a Remoção / Arquivamento**: 14 itens
* **Linhas de Código Morto a Eliminar**: **~1.450 linhas de TypeScript/React**
* **Espaço em Disco Liberado**: **~20.9 MB** (destaque para o binário `server.exe` de 20.8 MB na raiz)
* **Impacto Estimado no Bundle JS**: Redução imediata na superfície de manutenção e eliminação de tipos órfãos, com build 100% limpo e sem quebras.

---

## B. Classificação de Cada Candidato

| Item / Caminho | Linhas / Tamanho | Classificação | Justificativa / Evidência |
| :--- | :---: | :---: | :--- |
| `delete`, `query`, `start`, `stop` (raiz) | 48 B | `REMOVER` | Resíduos de comandos CLI acidentais no Windows contendo string 'OrionAgent'. |
| `server.exe` (raiz) | 20.8 MB | `REMOVER` | Binário Go compilado localmente; não deve residir no controle de versão. |
| `src/components/admin/RoutingRulesManagement.tsx` | 567 linhas | `REMOVER` | Componente órfão; substituído por `src/components/automation/RulesTab.tsx`. |
| `src/lib/routingRuleDisplay.ts` | 36 linhas | `REMOVER` | Helper exclusivo do componente morto `RoutingRulesManagement.tsx`. |
| `src/lib/routingRuleDisplay.test.ts` | 32 linhas | `REMOVER` | Teste unitário exclusivo do helper morto acima. |
| `src/components/monitoring/WebTelemetryTab.tsx` | 772 linhas | `REMOVER` | Componente órfão de telemetria; tela `WebMonitoring.tsx` implementou gráficos inline. |
| `src/hooks/useHistoricalStats.ts` | 60 linhas | `REMOVER` | Hook sem consumidores (confirmado em AUDIT.md pós-correção). |
| `src/hooks/useUserProfile.ts` | 6 linhas | `REMOVER` | Proxy re-export órfão; toda a base consome `@/hooks/useUserRole`. |
| `qa_comprehensive.py` | 10.2 KB | `ARQUIVAR` | Script QA Playwright da raiz; mover para `scripts/qa/`. |
| `qa_ux_validation.py` | 20.7 KB | `ARQUIVAR` | Script QA Playwright da raiz; mover para `scripts/qa/`. |
| `supabase/functions/create-new-user/` | 1 pasta | `DECISÃO NECESSÁRIA` | Edge Function obsoleta; substituída por `create-user-credentials`. |
| `supabase/functions/whatsapp-webhook/` | 1 pasta | `DECISÃO NECESSÁRIA` | Stub incompleto de webhook do WhatsApp (sem lógica de negócio). |
| `src/components/ui/*` (5 arquivos shadcn) | ~12 KB | `MANTER` | Componentes do registry Shadcn mantidos por política deliberada de UI. |
| `public/placeholder.svg` | 384 B | `MANTER` | Asset estático inofensivo padrão do ecossistema Vite. |

---

## C. Lotes de Execução (Ordenados por Risco Crescente)

Cada lote é estritamente independente e revertível isoladamente:

| Lote | Escopo / Ação | Arquivos Impactados | Risco | Procedimento de Verificação |
| :---: | :--- | :--- | :---: | :--- |
| **Lote 1** | **Resíduos e Binários da Raiz** | `delete`, `query`, `start`, `stop`, `server.exe` + atualizar `.gitignore` | **Mínimo** | `git status` limpo; nenhum build depende deles. |
| **Lote 2** | **Arquivos e Hooks Órfãos em `src/`** | `RoutingRulesManagement.tsx`, `routingRuleDisplay.ts`, `routingRuleDisplay.test.ts`, `WebTelemetryTab.tsx`, `useHistoricalStats.ts`, `useUserProfile.ts` | **Baixo** | `npx tsc --noEmit` → `npm run build` → `npm test` (62 testes devem continuar passando). |
| **Lote 3** | **Limpeza de Exports Mortos** | Tornar privados exports em `StatusBadge.tsx` (`getStatusLabel`), `use-toast.ts` (`reducer`) e limpar tipos mock em `useDeviceInventory.ts` | **Baixo** | `npx tsc --noEmit` → `npm run build`. |
| **Lote 4** | **Organização de Scripts de QA** | Mover `qa_comprehensive.py` e `qa_ux_validation.py` da raiz para a pasta `scripts/qa/` | **Baixo** | Verificar presença em `scripts/qa/`. |
| **Lote 5** | **Edge Functions Obsoletas (Opcional)** | Remover pasta `supabase/functions/create-new-user/` se aprovado | **Médio** | Verificar que `create-user-credentials` atende a criação de usuários. |

---

## D. Perguntas Abertas para Decisão do Sam

1. **Edge Function `create-new-user`**:
   * *Opção A (Recomendada)*: Remover a pasta `supabase/functions/create-new-user/` pois a criação de credenciais é realizada com sucesso por `create-user-credentials` e pelo endpoint Go.
   * *Opção B*: Manter a pasta como legado histórico.

2. **Edge Function `whatsapp-webhook`**:
   * *Opção A (Recomendada)*: Manter no repositório como placeholder/stub para implementação futura da integração de WhatsApp.
   * *Opção B*: Remover agora e recriar quando a funcionalidade for priorizada no roadmap.

3. **Execução dos Lotes de Limpeza**:
   * Podemos prosseguir para a **Fase 2 (Execução)** aplicando os Lotes 1, 2, 3 e 4 na branch `chore/cleanup-dead-code` com a tag `pre-cleanup`?

---

## 🛑 GATE — PARE AQUI

A Fase 1 (Auditoria Read-Only) está concluída com sucesso.  
**Aguardando sua aprovação explícita para avançar para a Fase 2.**
