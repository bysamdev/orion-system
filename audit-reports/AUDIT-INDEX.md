# AUDIT-INDEX — Orion System Comprehensive Audit Report

**Data da Auditoria**: 2026-08-14
**Orquestrador**: Subagente 0 (Antigravity Synthesizer)
**Escopo**: Repositório `orion-system` (Frontend React 18 + Vite + Tailwind + shadcn/ui; Backend Go + Chi no Vercel Edge; Supabase Postgres com RLS e Edge Functions; Site em Produção https://orion.bysam.dev/).

---

## 1. Tabela Consolidada de Achados Critical & High

| Severidade | Categoria | Achado | Arquivo / Alvo | Relatório de Origem |
| :--- | :--- | :--- | :--- | :--- |
| 🔴 **Critical** | RLS / Segurança | Funções SECURITY DEFINER sem `SET search_path = public` | `supabase/migrations/*.sql` | [08-rls-rbac-audit.md](file:///c:/Users/suporte.ti/Documents/orion-system/audit-reports/08-rls-rbac-audit.md) |
| 🟠 **High** | RLS / Disponibilidade | Políticas RLS dependentes de funções sem GRANT EXECUTE | `supabase/migrations/` | [08-rls-rbac-audit.md](file:///c:/Users/suporte.ti/Documents/orion-system/audit-reports/08-rls-rbac-audit.md) |
| 🟠 **High** | Dependências | `vite@6.0.7` com vulnerabilidade de Path Traversal (GHSA-fx2h-pf6j-xcff) | `package.json` | [07-dependency-vulns.md](file:///c:/Users/suporte.ti/Documents/orion-system/audit-reports/07-dependency-vulns.md) |
| 🟠 **High** | Segurança / Edge | Headers de Segurança ausentes em Produção (CSP, X-Frame-Options, HSTS) | `vercel.json` / Produção | [10-cors-auth-headers.md](file:///c:/Users/suporte.ti/Documents/orion-system/audit-reports/10-cors-auth-headers.md) |
| 🟠 **High** | Backend / API | Endpoints Go com JSON Decode sem limite de Payload (MaxBytesReader) | `handler/tickets.go` | [09-input-validation.md](file:///c:/Users/suporte.ti/Documents/orion-system/audit-reports/09-input-validation.md) |
| 🟠 **High** | Backend / Proteção | Ausência de Rate Limiting em rotas sensíveis e Webhooks | `handler/main.go` | [12-rate-limiting.md](file:///c:/Users/suporte.ti/Documents/orion-system/audit-reports/12-rate-limiting.md) |
| 🟠 **High** | Banco de Dados | Consultas sem paginação obrigatória em tabelas de grande volume | `src/hooks/useTickets.ts` | [15-db-performance.md](file:///c:/Users/suporte.ti/Documents/orion-system/audit-reports/15-db-performance.md) |
| 🟠 **High** | Credenciais | Uso de Service Role Key em ambiente Serverless | `handler/main.go` | [06-secrets-scan.md](file:///c:/Users/suporte.ti/Documents/orion-system/audit-reports/06-secrets-scan.md) |

---

## 2. Contagem Total de Achados por Categoria e Severidade

| Relatório / Área | Critical | High | Medium | Low | Total |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **01. Exports não utilizados** | 0 | 0 | 0 | 12 | 12 |
| **02. Arquivos órfãos** | 0 | 0 | 3 | 0 | 3 |
| **03. Dependências não utilizadas** | 0 | 0 | 0 | 4 | 4 |
| **04. Código comentado** | 0 | 0 | 0 | 15 | 15 |
| **05. Duplicação de código** | 0 | 0 | 2 | 1 | 3 |
| **06. Segredos e credenciais** | 0 | 1 | 0 | 1 | 2 |
| **07. Vulnerabilidades de dependências** | 0 | 1 | 1 | 0 | 2 |
| **08. Auditoria RLS / RBAC** | 1 | 1 | 1 | 0 | 3 |
| **09. Validação de input (Go)** | 0 | 1 | 1 | 0 | 2 |
| **10. CORS & Headers de segurança** | 0 | 1 | 1 | 0 | 2 |
| **11. Padrões assíncronos** | 0 | 0 | 1 | 1 | 2 |
| **12. Rate limiting** | 0 | 1 | 0 | 0 | 1 |
| **13. Bundle & Build** | 0 | 0 | 1 | 1 | 2 |
| **14. Re-renders & React Perf** | 0 | 0 | 2 | 0 | 2 |
| **15. DB Performance & N+1** | 0 | 1 | 0 | 1 | 2 |
| **16. Auditoria em Produção** | 0 | 0 | 1 | 1 | 2 |
| **17. TypeScript Coverage** | 0 | 0 | 0 | 18 | 18 |
| **18. Dependências circulares** | 0 | 0 | 0 | 1 | 1 |
| **19. Acessibilidade (a11y)** | 0 | 0 | 14 | 0 | 14 |
| **20. Higiene Git & TODOs** | 0 | 0 | 0 | 16 | 16 |
| **TOTAL GERAL** | **1** | **7** | **28** | **72** | **108** |

---

## 3. TOP 10 AÇÕES PRIORITÁRIAS

*(Prompts prontos para execução em sessões futuras)*

### Prompt 1: Atualização de Segurança do Vite
```
Atualize o pacote `vite` e subdependências no package.json para resolver as vulnerabilidades GHSA-fx2h-pf6j-xcff e GHSA-67mh-4wv8-2f99 apontadas no relatório 07-dependency-vulns.md, garantindo que o build continue passando sem quebras.
```

### Prompt 2: Headers de Segurança no Vercel Edge
```
Configure no `vercel.json` os cabeçalhos de segurança recomendados no relatório 10-cors-auth-headers.md: Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin e Permissions-Policy.
```

### Prompt 3: Blindagem de Funções SECURITY DEFINER no Postgres
```
Crie uma migração SQL no Supabase que aplique `ALTER FUNCTION ... SET search_path = public;` em todas as funções SECURITY DEFINER existentes no schema public, conforme documentado no relatório 08-rls-rbac-audit.md.
```

### Prompt 4: Proteção de Payload e MaxBytesReader no Backend Go
```
Adicione no backend Go (`handler/`) um middleware de limite de tamanho de payload com `http.MaxBytesReader(w, r.Body, 10 << 20)` (10MB) e validação de schema para prevenir ataques de negação de serviço por payloads desproporcionais (relatório 09-input-validation.md).
```

### Prompt 5: Rate Limiting nas Rotas Sensíveis
```
Implemente middleware de rate limiting com token bucket nas rotas de autenticação, recuperação de senha e webhooks no backend Go ou Edge Middleware do Vercel, conforme indicado no relatório 12-rate-limiting.md.
```

### Prompt 6: Paginação Padrão em Consultas de Tickets e Auditoria
```
Refatore os hooks `useTickets` e o endpoint Go correspondente para impor paginação obrigatória com limite de 50 registros por página e suporte a paginação infinita / cursor no TanStack Query (relatório 15-db-performance.md).
```

### Prompt 7: Atualização do `robots.txt` para Bloquear Rotas Administrativas
```
Edite o arquivo `public/robots.txt` para proibir explicitamente o rastreamento de crawlers em rotas administrativas e privadas (`Disallow: /admin`, `Disallow: /dashboard`, `Disallow: /tickets`), conforme relatório 16-production-audit.md.
```

### Prompt 8: Dynamic Import para Bibliotecas Pesadas (PDF & Canvas)
```
Refatore `src/components/reports/exportPdf.ts` para carregar `jspdf` e `html2canvas` dinamicamente com `const { jsPDF } = await import('jspdf')` sob demanda ao clicar no botão de exportação, reduzindo o bundle inicial (relatório 13-bundle-analysis.md).
```

### Prompt 9: Acessibilidade em Botões de Ícone (`aria-label`)
```
Adicione o atributo `aria-label` descritivo em todos os botões de ícone identificados no relatório 19-accessibility.md para cumprir os padrões WCAG 2.1 AA.
```

### Prompt 10: Limpeza de Código Comentado e Exports Órfãos
```
Execute a limpeza dos blocos de código comentados com mais de 3 linhas identificados no relatório 04-commented-code.md e torne privados os exports sem referências do relatório 01-dead-exports.md.
```

---

## 4. PRECISA DECISÃO DO DONO (NEEDS_MANUAL_REVIEW)

1. **Política de Rastreamento de Robôs (`robots.txt`)**: Decidir se a landing page e a página de autenticação devem permanecer públicas para indexação de motores de busca ou se o sistema deve ser 100% fechado via `Disallow: /`.
2. **Estratégia de Cache e Revalidação do Supabase**: Definir o tempo ideal de `staleTime` para tickets em tempo real no TanStack Query (atualmente 5 minutos no padrão vs eventos de Realtime).
3. **Tratamento de Tokens de Teste em Desenvolvimento**: Confirmar se o bypass `?testAuth=1` em `AuthContext.tsx` deve ser mantido para testes E2E/mock locais ou substituído por testes autenticados com usuários de staging.

---

## 5. DIVERGÊNCIAS LOCAL vs PRODUÇÃO

| Item | Ambiente Local | Produção (https://orion.bysam.dev/) | Impacto / Risco |
| :--- | :--- | :--- | :--- |
| **Headers de Segurança** | Vite dev server com headers padrão | Servidor Vercel sem CSP, sem X-Frame-Options | Alto (exposição a clickjacking em produção) |
| **CORS** | Localhost permitido | `Access-Control-Allow-Origin: *` na raiz | Médio (CORS permissivo no HTML inicial) |
| **Sitemap** | Arquivo não gerado localmente | Retorna HTML da SPA com HTTP 200 | Baixo (SEO / Indexação) |
| **Source Maps** | Habilitados no Vite | Não expostos publicamente em `dist` | Positivo (código de produção ofuscado) |

---
*Relatório consolidado gerado e indexado em `audit-reports/` pelo Subagente 0.*
