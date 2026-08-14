# Relatório de Auditoria: Arquivos Órfãos (Subagente 2)

## Escopo
Varredura de arquivos em `src/`, `handler/` e `lib/` que não são importados nem referenciados em nenhuma rota ou configuração.

## Achados

### [Medium] Arquivo potencialmente órfão `src/components/ui/accordion.tsx`
- **Arquivo**: `src/components/ui/accordion.tsx`
- **Adicionado em**: Sun Oct 5 19:56:26 2025 +0000 (10 months ago)
- **Descrição**: O arquivo não é referenciado em nenhum import ou rota do projeto.
- **Recomendação**: Avaliar se deve ser removido ou conectado à aplicação.

### [Medium] Arquivo potencialmente órfão `src/components/ui/calendar.tsx`
- **Arquivo**: `src/components/ui/calendar.tsx`
- **Adicionado em**: Sun Oct 5 19:56:26 2025 +0000 (10 months ago)
- **Descrição**: O arquivo não é referenciado em nenhum import ou rota do projeto.
- **Recomendação**: Avaliar se deve ser removido ou conectado à aplicação.

### [Medium] Arquivo potencialmente órfão `src/components/ui/dropdown-menu.tsx`
- **Arquivo**: `src/components/ui/dropdown-menu.tsx`
- **Adicionado em**: Sun Oct 5 19:56:26 2025 +0000 (10 months ago)
- **Descrição**: O arquivo não é referenciado em nenhum import ou rota do projeto.
- **Recomendação**: Avaliar se deve ser removido ou conectado à aplicação.

### [Medium] Arquivo potencialmente órfão `src/hooks/useHistoricalStats.ts`
- **Arquivo**: `src/hooks/useHistoricalStats.ts`
- **Adicionado em**: Sat Oct 18 04:03:06 2025 +0000 (10 months ago)
- **Descrição**: O arquivo não é referenciado em nenhum import ou rota do projeto.
- **Recomendação**: Avaliar se deve ser removido ou conectado à aplicação.

## RESUMO EXECUTIVO
- **Critical**: 0
- **High**: 0
- **Medium**: 4
- **Low**: 0
- **Total de Achados**: 4
