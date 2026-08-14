# Relatório de Auditoria: Exports e Funções Não Utilizadas (Subagente 1)

## Escopo
Varredura em `src/` (TypeScript/React) e handlers Go por exports sem referências em outros arquivos do repositório.

## Achados

### [Low] Export `getStatusLabel` não referenciado
- **Arquivo:Linha**: `src/components/shared/StatusBadge.tsx:64`
- **Descrição**: O símbolo `getStatusLabel` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `BadgeProps` não referenciado
- **Arquivo:Linha**: `src/components/ui/badge.tsx:23`
- **Descrição**: O símbolo `BadgeProps` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `ButtonPrimaryProps` não referenciado
- **Arquivo:Linha**: `src/components/ui/button-primary.tsx:4`
- **Descrição**: O símbolo `ButtonPrimaryProps` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `ButtonProps` não referenciado
- **Arquivo:Linha**: `src/components/ui/button.tsx:36`
- **Descrição**: O símbolo `ButtonProps` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `CalendarProps` não referenciado
- **Arquivo:Linha**: `src/components/ui/calendar.tsx:8`
- **Descrição**: O símbolo `CalendarProps` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `ChartConfig` não referenciado
- **Arquivo:Linha**: `src/components/ui/chart.tsx:9`
- **Descrição**: O símbolo `ChartConfig` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `TextareaProps` não referenciado
- **Arquivo:Linha**: `src/components/ui/textarea.tsx:5`
- **Descrição**: O símbolo `TextareaProps` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `reducer` não referenciado
- **Arquivo:Linha**: `src/hooks/use-toast.ts:71`
- **Descrição**: O símbolo `reducer` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `AutomationLog` não referenciado
- **Arquivo:Linha**: `src/hooks/useAutomation.ts:15`
- **Descrição**: O símbolo `AutomationLog` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `CompanyOption` não referenciado
- **Arquivo:Linha**: `src/hooks/useCompanies.ts:4`
- **Descrição**: O símbolo `CompanyOption` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `DeviceType` não referenciado
- **Arquivo:Linha**: `src/hooks/useDeviceInventory.ts:4`
- **Descrição**: O símbolo `DeviceType` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `DeviceStatus` não referenciado
- **Arquivo:Linha**: `src/hooks/useDeviceInventory.ts:5`
- **Descrição**: O símbolo `DeviceStatus` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `DeviceInventoryItem` não referenciado
- **Arquivo:Linha**: `src/hooks/useDeviceInventory.ts:7`
- **Descrição**: O símbolo `DeviceInventoryItem` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `FALLBACK_DEVICES` não referenciado
- **Arquivo:Linha**: `src/hooks/useDeviceInventory.ts:33`
- **Descrição**: O símbolo `FALLBACK_DEVICES` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

### [Low] Export `UseDeviceInventoryOptions` não referenciado
- **Arquivo:Linha**: `src/hooks/useDeviceInventory.ts:200`
- **Descrição**: O símbolo `UseDeviceInventoryOptions` é exportado mas não possui nenhuma menção ou importação em outros arquivos do frontend.
- **Recomendação**: Remover a cláusula `export` para torná-lo privado ao módulo ou excluir se for código não utilizado.

## RESUMO EXECUTIVO
- **Critical**: 0
- **High**: 0
- **Medium**: 0
- **Low**: 53
- **Total de Achados**: 53
