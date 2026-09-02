# Relatório de Limpeza 03 — Exports e Símbolos Sem Consumidor

**Subagente**: Subagente 3 (Auditor de Exports e Dead Code em Nível de Símbolo)  
**Data da Auditoria**: 31 de Agosto de 2026  
**Escopo**: Varredura de todos os exports declarados em `src/` cruzados contra o uso no repositório inteiro.  

---

## 1. Metodologia de Confirmação

Cada símbolo exportado foi verificado através de regex word-boundary (`\b<Symbol>\b`) em toda a base de código (frontend, backend, scripts e testes). Símbolos que aparecem apenas na própria declaração foram classificados como **exports sem consumidor**.

---

## 2. Exports Sem Consumidor (Código de Aplicação / Não-Shadcn)

Os seguintes símbolos são exportados publicamente mas não possuem nenhum importador externo no projeto:

| Arquivo | Símbolo Exportado | Tipo | Diagnóstico / Recomendação |
| :--- | :--- | :---: | :--- |
| `src/components/shared/StatusBadge.tsx` | `getStatusLabel` | Função | Usada apenas internamente no próprio arquivo. Remover a cláusula `export` (tornar privada). |
| `src/components/ui/button-primary.tsx` | `ButtonPrimaryProps` | Interface | Interface de prop não consumida externamente. Tornar privada ou unificar com `ButtonProps`. |
| `src/components/ui/badge.tsx` | `BadgeProps` | Interface | Interface de prop shadcn não referenciada externamente. Manter ou tornar privada. |
| `src/components/ui/textarea.tsx` | `TextareaProps` | Interface | Interface vazia que causa aviso de lint. Tornar privada ou remover export. |
| `src/hooks/useAutomation.ts` | `AutomationLog` | Interface | Tipo de retorno/log antigo não consumido em componentes. Manter no arquivo de tipos. |
| `src/hooks/useCompanies.ts` | `CompanyOption` | Interface | Tipo auxiliar não importado fora do hook. |
| `src/hooks/useDeviceInventory.ts` | `DeviceType` | Tipo | Tipo legado não consumido externamente. |
| `src/hooks/useDeviceInventory.ts` | `DeviceStatus` | Tipo | Tipo legado não consumido externamente. |
| `src/hooks/useDeviceInventory.ts` | `DeviceInventoryItem` | Interface | Interface de mock não referenciada. |
| `src/hooks/useDeviceInventory.ts` | `FALLBACK_DEVICES` | Constante | Constante de mock legada. |
| `src/hooks/useDeviceInventory.ts` | `UseDeviceInventoryOptions` | Interface | Interface de options não consumida. |
| `src/hooks/use-toast.ts` | `reducer` | Função | Reducer interno do toast, exportado acidentalmente. Remover `export`. |
| `src/lib/routingRuleDisplay.ts` | `resolverNomeExibicao` | Função | Função associada a componente morto (`RoutingRulesManagement.tsx`). |

---

## 3. Exports Shadcn UI (Preservados por Padrão)

Exports em componentes `src/components/ui/*` (como `CalendarProps`, `ChartConfig`, `DropdownMenuProps`) são interfaces canônicas fornecidas pela especificação do Radix/Shadcn.
* **Decisão**: Manter sem alterações para preservar a compatibilidade de API com a documentação do Shadcn UI.

---

## 4. Resumo de Ações para Fase 2

1. Tornar privadas as funções `getStatusLabel` (em `StatusBadge.tsx`) e `reducer` (em `use-toast.ts`).
2. Limpar os 5 tipos/constantes de mock não utilizados em `src/hooks/useDeviceInventory.ts`.
