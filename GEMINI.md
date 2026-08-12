# Orion System — Contexto (Antigravity / Gemini CLI)

Espelho do `claude.md` para o fork Antigravity (base Gemini/Jetski).

## Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Go
- Banco de dados: Supabase (Postgres)

## Knowledge Graph (Graphify) — contexto compartilhado [GEMINI ATIVO]
Mesmo grafo do Claude Code, em `graphify-out/` (gerado com LLM Gemini).
REGRA OBRIGATÓRIA: antes de qualquer tarefa de código, leia PRIMEIRO
`graphify-out/GRAPH_REPORT.md` e use `graphify query` — NÃO leia arquivos crus
para entender estrutura (economiza ~10-50x tokens por consulta):
- `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades nomeadas, conexões
- `graphify query "<pergunta>"` — subgrafo focado
- `graphify path "<A>" "<B>"` — caminho entre dois módulos/conceitos
- `graphify explain "<conceito>"` — detalha um nó
- Vault Obsidian: `Documents/Obsidian/Orion System/Graphify-Report.md`
- Regenerar após mexer em código: `graphify . --update` (AST, sem custo de API)
- O grafo NÃO deve subir pro GitHub (já está no .gitignore)

## Regras de trabalho
- Commits pequenos e testáveis
- Perguntar antes de tocar em arquivos fora do fluxo de chamados
