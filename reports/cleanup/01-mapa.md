# Relatório de Limpeza 01 — Mapa Completo do Repositório

**Subagente**: Subagente 1 (Mapeador de Arquivos e Metadados)  
**Data da Auditoria**: 31 de Agosto de 2026  
**Escopo**: Varredura exaustiva de toda a árvore do repositório (excluindo `node_modules/`, `dist/`, `.git/` e caches de IDE).  

---

## 1. Resumo do Inventário de Arquivos

O repositório possui **1.128 arquivos ativos** sob gestão de código e configuração, distribuídos nas seguintes categorias:

| Categoria | Descrição | Contagem de Arquivos | % do Total |
| :--- | :--- | :---: | :---: |
| **Código de Aplicação (Frontend/Backend/Agent)** | `src/`, `handler/`, `lib/`, `api/`, `orion-agent/`, `cmd/` | 247 | 21.9% |
| **Banco de Dados / Migrations** | `supabase/migrations/`, `supabase/functions/`, configs | 125 | 11.1% |
| **Assets Estáticos** | `public/`, imagens, ícones, SVGs | 8 | 0.7% |
| **Configurações de Build & Tooling** | `package.json`, `tsconfig*.json`, `vite.config.ts`, etc. | 22 | 1.9% |
| **Documentação Técnica** | `*.md` raiz, `docs/` | 38 | 3.4% |
| **Relatórios de Auditoria** | `reports/`, `audit-reports/` | 42 | 3.7% |
| **Artefatos Gerados (Knowledge Graph)** | `graphify-out/` (AST, JSONs de análise e grafos) | 632 | 56.0% |
| **Scripts Avulsos & QA** | `scripts/`, scripts `.py`, `.mjs`, `.sh` na raiz | 14 | 1.2% |
| **TOTAL GERAL** | | **1.128** | **100%** |

---

## 2. Arquivos Sem Commits Há Mais de 6 Meses (< 2026-03-01)

A maior parte dos arquivos do Orion System recebeu manutenção ativa nos últimos 30 dias (especialmente durante as fases de hardening de segurança e RMM). No entanto, **41 arquivos** permanecem intocados desde outubro de 2025/janeiro de 2026:

| Caminho do Arquivo | Tamanho | Último Commit | Status / Natureza |
| :--- | :---: | :---: | :--- |
| `public/placeholder.svg` | 384 B | 2025-10-05 | Asset estático padrão do Vite |
| `src/components/ui/accordion.tsx` | 1.1 KB | 2025-10-05 | Componente Shadcn sem consumidor ativo |
| `src/components/ui/calendar.tsx` | 2.1 KB | 2025-10-05 | Componente Shadcn sem consumidor ativo |
| `src/components/ui/dropdown-menu.tsx` | 4.8 KB | 2025-10-05 | Componente Shadcn sem consumidor ativo |
| `src/components/ui/command.tsx` | 3.5 KB | 2025-10-05 | Componente Shadcn sem consumidor ativo |
| `src/hooks/useHistoricalStats.ts` | 3.2 KB | 2025-10-18 | Hook órfão (superado por RPC/useReports) |
| `docs/relatorios-refinamento-proposta.md` | 8.4 KB | 2025-11-12 | Documento de refinamento de proposta |
| `docs/tasks/automacoes-task.md` | 4.2 KB | 2025-12-03 | Documento histórico de spec |
| `supabase/migrations/20251017*` (12 arquivos) | ~45 KB | 2025-10-17 | Migrações iniciais do banco |

---

## 3. Arquivos com Sufixos Suspeitos ou Nomes Temporários

Varredura de sufixos `*.old`, `*.bak`, `*-copy`, `*.orig`, `*_v2`, `*-new`, `temp*`, `*.tmp` e arquivos espúrios na raiz:

| Arquivo / Caminho | Tamanho | Data Git | Diagnóstico |
| :--- | :---: | :---: | :--- |
| `delete` (na raiz) | 12 B | Recente | **Espúrio**: Artefato de comando CLI de teste (`OrionAgent`) |
| `query` (na raiz) | 12 B | Recente | **Espúrio**: Artefato de comando CLI de teste (`OrionAgent`) |
| `start` (na raiz) | 12 B | Recente | **Espúrio**: Artefato de comando CLI de teste (`OrionAgent`) |
| `stop` (na raiz) | 12 B | Recente | **Espúrio**: Artefato de comando CLI de teste (`OrionAgent`) |
| `server.exe` (na raiz) | 20.8 MB | Untracked | **Binário**: Executável Windows de desenvolvimento local |
| `supabase/migrations/20260318120000_automation_engine_v2.sql` | 14.8 KB | 2026-03-18 | **Migration ativa**: Nome `_v2` legítimo de versão do motor |
| `supabase/.temp/linked-project.json` | 88 B | 2026-08-11 | Arquivo de link do CLI Supabase |

---

## 4. Pastas com um Único Arquivo (Single-File Directories)

Diretórios folha contendo apenas um arquivo que poderiam ser consolidados ou indicam módulos incompletos:

| Diretório | Arquivo Único | Finalidade |
| :--- | :--- | :--- |
| `api/` | `router.go` | **Entrypoint Vercel Serverless** (necessário pela convenção da Vercel) |
| `cmd/server/` | `main.go` | Entrypoint local para subir o backend Go fora da Vercel |
| `orion-agent/cmd/agent/` | `main.go` | Entrypoint do binário do agente RMM |
| `orion-agent/installer/` | `main.go` | Entrypoint do instalador do agente |
| `supabase/functions/create-new-user/` | `index.ts` | **Edge Function Obsoleta** (substituída por `create-user-credentials`) |
| `supabase/functions/whatsapp-webhook/` | `index.ts` | **Edge Function Stub** (sem implementação ativa) |
| `src/contexts/` | `AuthContext.tsx` | Contexto de autenticação global |

---

## 5. Conclusão do Subagente 1

1. O repositório está majoritariamente limpo em termos de branches mortas de código, mas acumula resíduos na raiz (`delete`, `query`, `start`, `stop`, `server.exe`) gerados por testes locais.
2. Os diretórios da Vercel (`api/`) e do Supabase (`supabase/functions/`) possuem estrutura single-file por imposição das plataformas de deploy.
3. Não existem arquivos de backup acidentais (`.bak`, `.old`, `_copy`) no código-fonte do frontend ou backend Go.
