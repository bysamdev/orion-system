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

## Regras de trabalho
- Nunca misturar refino visual com mudança de lógica de backend no mesmo commit
- Sempre medir antes/depois (tempo de query, bundle size, re-renders) antes
  de declarar algo "otimizado"
- Commits pequenos e testáveis
- Perguntar antes de tocar em arquivos fora do fluxo de chamados