# Orion System — Contexto do Projeto

## Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Go
- Banco de dados: Supabase (Postgres)
- Skills disponíveis: awesome-claude-skills (ComposioHQ), ui-ux-pro-max

## Objetivo atual
Transformar o Orion em um MVP de helpdesk com abertura de chamados
totalmente funcional. Escopo fechado do MVP:
- Formulário de abertura de chamado (título, descrição, categoria, prioridade)
- Atribuição de responsável
- Status: aberto / em andamento / fechado
- Notificação básica de mudança de status

Fora do escopo do MVP (não mexer sem autorização explícita):
- Dashboards avançados / relatórios
- Automações e regras de SLA
- Integrações externas

## Knowledge Graph (Graphify) — contexto compartilhado [GEMINI ATIVO]
Há um grafo completo do projeto em `graphify-out/` (gerado com LLM Gemini).
REGRA OBRIGATÓRIA: antes de qualquer tarefa de código, leia PRIMEIRO
`graphify-out/GRAPH_REPORT.md` e use `graphify query` — NÃO leia arquivos crus
para entender estrutura (economiza ~10-50x tokens por consulta):
- `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades nomeadas, conexões
- `graphify query "<pergunta>"` — subgrafo focado (ex: "onde está a lógica de SLA?")
- `graphify path "<A>" "<B>"` — caminho entre dois módulos/conceitos
- `graphify explain "<conceito>"` — detalha um nó
- Vault Obsidian: `Projetos/Obsidian-vault/Orion System/Graphify-Report.md` (espelho)
- Regenerar após mexer em código: `graphify . --update` (AST, sem custo de API)
- O grafo NÃO deve subir pro GitHub (já está no .gitignore)

## Regras de trabalho
- Nunca misturar refino visual com mudança de lógica de backend no mesmo commit
- Sempre medir antes/depois (tempo de query, bundle size, re-renders) antes
  de declarar algo "otimizado"
- Commits pequenos e testáveis
- Perguntar antes de tocar em arquivos fora do fluxo de chamados