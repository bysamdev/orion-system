# Relatório de Auditoria: Tamanho e Otimização do Bundle (Subagente 13)

## Escopo
Análise de `vite.config.ts`, `package.json` e distribuição compilada em `dist/`.

## Achados

### [Medium] Chunks Grandes de Bibliotecas de Exportação (jspdf / html2canvas)
- **Arquivo:Linha**: `src/components/reports/exportPdf.ts` -> `jspdf.es.min.js` (~384 kB / 125 kB gzip)
- **Descrição**: Bibliotecas de geração de PDF e captura de tela são carregadas e aumentam o peso de assets.
- **Recomendação**: Assegurar importação dinâmica `import('jspdf')` sob demanda apenas quando o usuário clicar em "Exportar PDF".

### [Low] Otimização de Chunks já Implementada via Rollup ManualChunks
- **Arquivo:Linha**: `vite.config.ts:35`
- **Descrição**: O projeto já possui divisão inteligente de chunks (`vendor-react`, `vendor-ui`, `vendor-query`, `vendor-supabase`).
- **Recomendação**: Manter a configuração e monitorar novos pacotes adicionados.

## RESUMO EXECUTIVO
- **Critical**: 0
- **High**: 0
- **Medium**: 1
- **Low**: 1
- **Total de Achados**: 2
