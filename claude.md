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

## Knowledge Graph (Graphify) — contexto compartilhado
Há um grafo do projeto em `graphify-out/`. Antes de mexer em código desconhecido,
consultar o grafo em vez de ler arquivos crus (economiza ~71x tokens por query):
- `graphify-out/GRAPH_REPORT.md` — god nodes, comunidades, conexões surpreendentes
- `graphify query "<pergunta>"` — subgrafo focado (menor que grep cru)
- `graphify path "<A>" "<B>"` — caminho entre dois módulos/conceitos
- `graphify explain "<conceito>"` — detalha um nó
- `graphify-out/wiki/index.md` — navegação ampla por comunidade
- Regenerar: `/graphify .` (nos agentes) ou `graphify . --update` (AST, sem custo de API)
- O grafo NÃO deve subir pro GitHub (já está no .gitignore)

## Regras de trabalho
- Nunca misturar refino visual com mudança de lógica de backend no mesmo commit
- Sempre medir antes/depois (tempo de query, bundle size, re-renders) antes
  de declarar algo "otimizado"
- Commits pequenos e testáveis
- Perguntar antes de tocar em arquivos fora do fluxo de chamados