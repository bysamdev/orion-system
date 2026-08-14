# Relatório de Auditoria: Vulnerabilidades de Dependências (Subagente 7)

## Escopo
Auditoria via `npm audit` e varredura de CVEs conhecidas em `package.json` e `go.mod`.

## Achados

### [High] vite@6.0.7 — GHSA-fx2h-pf6j-xcff (Path Traversal / FS Deny Bypass)
- **Versão instalada**: 6.0.7
- **Versão corrigida**: >= 6.4.3 ou 8.x
- **Severidade**: High (CVSS: 7.5)
- **Descrição**: Vulnerabilidade no servidor de desenvolvimento do Vite que pode permitir bypass de `server.fs.deny` em caminhos alternativos do Windows.
- **Recomendação**: Atualizar o `vite` no `package.json` para a versão mais recente (`npm update vite`).

### [Medium] esbuild@0.24.2 — GHSA-67mh-4wv8-2f99 (Dev Server Request Forgery)
- **Versão instalada**: 0.24.2 (subdependência do Vite)
- **Versão corrigida**: >= 0.25.0
- **Severidade**: Moderate (CVSS: 5.3)
- **Descrição**: O servidor de desenvolvimento pode permitir requisições não autorizadas de websites terceiros.
- **Recomendação**: A atualização do Vite resolverá a versão empacotada do esbuild.

## RESUMO EXECUTIVO
- **Critical**: 0
- **High**: 1
- **Medium**: 1
- **Low**: 0
- **Total de Achados**: 2
