# Relatório de Limpeza 07 — Raiz, Assets, Configs e Documentação

**Subagente**: Subagente 7 (Auditor de Raiz, Assets Públicos e Documentação)  
**Data da Auditoria**: 31 de Agosto de 2026  
**Escopo**: Raiz do repositório, pasta `public/`, scripts utilitários e documentação técnica.  

---

## 1. Scripts e Arquivos Espúrios na Raiz

Varredura de scripts e artefatos soltos na raiz do projeto:

| Arquivo na Raiz | Tamanho | Origem / Diagnóstico | Ação Proposta |
| :--- | :---: | :--- | :--- |
| `delete` | 12 B | Arquivo de texto criado por engano ao rodar comando `sc` ou similar do Windows | **REMOVER** (Lixo) |
| `query` | 12 B | Arquivo de texto criado por engano ao rodar comando `sc` ou similar do Windows | **REMOVER** (Lixo) |
| `start` | 12 B | Arquivo de texto criado por engano ao rodar comando `sc` ou similar do Windows | **REMOVER** (Lixo) |
| `stop` | 12 B | Arquivo de texto criado por engano ao rodar comando `sc` ou similar do Windows | **REMOVER** (Lixo) |
| `server.exe` | 20.8 MB | Binário Go compilado localmente em Windows (deve ser ignorado pelo git) | **REMOVER DO REPO** + Adicionar ao `.gitignore` |
| `qa_comprehensive.py` | 10.2 KB | Script Playwright em Python para QA funcional | **ARQUIVAR / MOVER** para `scripts/qa/` |
| `qa_ux_validation.py` | 20.7 KB | Script Playwright em Python para validação de UI/UX | **ARQUIVAR / MOVER** para `scripts/qa/` |

---

## 2. Assets Estáticos (`public/`)

| Asset | Tamanho | Referências no Código | Diagnóstico |
| :--- | :---: | :--- | :--- |
| `public/favicon.ico` | 1.1 KB | Navegadores / Padrão Web | **MANTER** (Obrigatório) |
| `public/favicon.png` | 1.4 KB | `index.html`, `manifest.json` | **MANTER** (Obrigatório) |
| `public/manifest.json` | 462 B | `index.html` (PWA/Metadados) | **MANTER** (Obrigatório) |
| `public/robots.txt` | 134 B | Crawlers e Indexadores Web | **MANTER** (Obrigatório) |
| `public/placeholder.svg` | 384 B | Asset padrão do Vite | **MANTER / BAIXO RISCO** |

---

## 3. Configurações e Variáveis de Ambiente

- Todas as variáveis de ambiente necessárias para a execução do frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.) e do backend Go (`DATABASE_URL`, `RESEND_API_KEY`, etc.) estão devidamente documentadas em `README.md` e `.env`.
- As configurações de build (`vite.config.ts`, `postcss.config.js`, `eslint.config.js`, `tsconfig.json`, `vercel.json`) estão limpas e operacionais.

---

## 4. Documentação e Relatórios Históricos

Os seguintes relatórios de sessões anteriores na raiz trazem histórico detalhado e podem ser organizados ou mantidos para referência:
- `revisao-completa-2026-08-28.md`
- `route-translation-report.md`
- `varredura-geral-report.md`
