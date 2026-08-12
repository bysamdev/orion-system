# Orion System — Contexto (Antigravity / Gemini CLI)

Espelho do `claude.md` para o fork Antigravity (base Gemini/Jetski).

## Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Go
- Banco de dados: Supabase (Postgres)

## Knowledge Graph (Graphify) — contexto compartilhado
Mesmo grafo do Claude Code, em `graphify-out/`. Antes de mexer em código
desconhecido, consultar o grafo (economiza ~71x tokens por query):
- `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, conexões surpreendentes
- `graphify query "<pergunta>"` — subgrafo focado
- `graphify path "<A>" "<B>"` — caminho entre dois módulos/conceitos
- `graphify explain "<conceito>"` — detalha um nó
- Regenerar: `/graphify .` ou `graphify . --update` (AST, sem custo de API)
- O grafo NÃO deve subir pro GitHub (já está no .gitignore)

## Regras de trabalho
- Commits pequenos e testáveis
- Perguntar antes de tocar em arquivos fora do fluxo de chamados
