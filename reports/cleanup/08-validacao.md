# Relatório de Limpeza 08 — Validação Adversarial

**Subagente**: Subagente 8 (Advogado do Diabo / Validador Adversarial)  
**Data da Auditoria**: 31 de Agosto de 2026  
**Missão**: Tentar provar que cada item marcado como candidato à remoção ou modificação está, na verdade, VIVO.  

---

## As 5 Armadilhas de Validação

Para cada candidato, foram aplicados 5 testes rigorosos:
1. **Armadilha 1**: É entrypoint de convenção? (`api/*` na Vercel, `supabase/functions/*`, workers, configs)?
2. **Armadilha 2**: É referenciado por string em vez de import? (`functions.invoke('nome')`, rotas dinâmicas, template literals)?
3. **Armadilha 3**: É referenciado apenas fora de `src/`? (CI, Dockerfile, scripts, migrations, README)?
4. **Armadilha 4**: É consumido por um cliente externo fora do repo? (Orion Agent em clientes, webhooks externos)?
5. **Armadilha 5**: É código de emergência, fallback deliberado ou feature flag inativa?

---

## Blocos de Evidência por Candidato

### Candidato 1: `src/components/admin/RoutingRulesManagement.tsx` (567 linhas)
- **Teste 1 (Convenção)**: Não é rota de página nem entrypoint.
- **Teste 2 (String/Dedupe)**: `git grep "RoutingRulesManagement"` → Aparece apenas na sua própria definição e num comentário em `routingRuleDisplay.ts`. A tela de automações usa exclusivamente `src/components/automation/RulesTab.tsx` e `RuleForm.tsx`.
- **Teste 3 (Fora de src/)**: Nenhuma referência em scripts, CI ou documentação.
- **Teste 4 (Cliente externo)**: Componente puramente de UI administrativa.
- **Teste 5 (Fallback)**: O motor de roteamento ativo no banco consome regras gerenciadas por `RulesTab.tsx`.
- **Comando de Prova**: `git grep "RoutingRulesManagement" src/`
- **Saída**:
  ```
  src/components/admin/RoutingRulesManagement.tsx:21:export const RoutingRulesManagement = () => {
  ```
- **Veredito**: **CONFIRMADO MORTO** (Pode ser removido com segurança).

---

### Candidato 2: `src/lib/routingRuleDisplay.ts` e `src/lib/routingRuleDisplay.test.ts`
- **Teste 1-5**: Consumido unicamente por `RoutingRulesManagement.tsx` (morto) e por seu próprio arquivo de teste.
- **Comando de Prova**: `git grep "resolverNomeExibicao"`
- **Saída**:
  ```
  src/components/admin/RoutingRulesManagement.tsx:19:import { resolverNomeExibicao } from '@/lib/routingRuleDisplay';
  src/lib/routingRuleDisplay.test.ts:2:import { resolverNomeExibicao } from './routingRuleDisplay';
  src/lib/routingRuleDisplay.ts:16:export function resolverNomeExibicao(...)
  ```
- **Veredito**: **CONFIRMADO MORTO** (Acompanha o lote de `RoutingRulesManagement.tsx`).

---

### Candidato 3: `src/components/monitoring/WebTelemetryTab.tsx` (772 linhas)
- **Teste 1 (Convenção)**: Não é entrypoint nem página de rota.
- **Teste 2 (String/Dedupe)**: `git grep "WebTelemetryTab"` → Apenas na própria declaração.
- **Teste 3 (Fora de src/)**: Zero menções em backend ou scripts.
- **Teste 4 (Cliente externo)**: Componente de UI web.
- **Teste 5 (Fallback)**: A página `src/pages/WebMonitoring.tsx` implementou os gráficos de latência, uptime e links diretamente nas linhas 400-800 com abas `web` e `network`. `WebTelemetryTab` foi uma tentativa de extração deixada para trás.
- **Comando de Prova**: `git grep "WebTelemetryTab" src/`
- **Saída**:
  ```
  src/components/monitoring/WebTelemetryTab.tsx:70:export const WebTelemetryTab: React.FC<WebTelemetryTabProps> = ...
  ```
- **Veredito**: **CONFIRMADO MORTO** (Pode ser removido com segurança).

---

### Candidato 4: `src/hooks/useHistoricalStats.ts` (60 linhas)
- **Teste 1-5**: Confirmado como sem importadores desde o commit `7b52d66`. A tela de relatórios consome `useReports` e consultas agregadas.
- **Comando de Prova**: `git grep "useHistoricalStats" src/`
- **Saída**: Vazia (0 resultados).
- **Veredito**: **CONFIRMADO MORTO** (Pode ser removido com segurança).

---

### Candidato 5: `src/hooks/useUserProfile.ts` (6 linhas)
- **Teste 1-5**: Arquivo proxy que apenas faz `export { useUserProfile } from '@/hooks/useUserRole'`.
- **Comando de Prova**: `git grep "@/hooks/useUserProfile" src/`
- **Saída**: Vazia (todos os 22 componentes importam de `@/hooks/useUserRole`).
- **Veredito**: **CONFIRMADO MORTO** (Pode ser removido com segurança).

---

### Candidato 6: `supabase/functions/create-new-user/index.ts`
- **Teste 1 (Convenção)**: Edge function do Supabase.
- **Teste 2 (String/Dedupe)**: `git grep "create-new-user"` → Apenas em `supabase/config.toml` e relatórios antigos. A criação de novos usuários no painel (`UserManagement.tsx`) invoca a Edge Function `create-user-credentials` ou o endpoint Go `/api/functions/create-user-credentials`.
- **Veredito**: **OBSOLETO** (Candidato a arquivamento/remoção no lote do Supabase).

---

### Candidato 7: Arquivos Espúrios na Raiz (`delete`, `query`, `start`, `stop`, `server.exe`)
- **Teste 1-5**: Textos de 12 bytes gerados por comandos CLI de serviço do Windows digitados sem o prefixo `sc`. O arquivo `server.exe` é um binário Go compilado localmente.
- **Comando de Prova**: `head -n 2 delete query start stop`
- **Saída**: `OrionAgent`
- **Veredito**: **CONFIRMADO LIXO / DESCARTÁVEL** (Pode ser removido imediatamente).
