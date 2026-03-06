# Orion System

Plataforma de helpdesk e gerenciamento de tickets desenvolvida para equipes modernas. O Orion System simplifica fluxos de suporte, gerenciamento de chamados e colaboração entre times numa interface limpa e responsiva.

## Tecnologias

- **Frontend:** React + TypeScript + Vite
- **Estilização:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Deploy:** Vercel

## Funcionalidades

- Criação e gerenciamento de tickets
- Controle de acesso por função (RBAC)
- Atualizações em tempo real
- Dashboard com métricas
- Design responsivo

## Como rodar localmente

### Pré-requisitos

- Node.js 18+
- npm ou bun

### Instalação

```sh
git clone https://github.com/bysamdev/orion-system-main-alpha.git
cd orion-system-main-alpha
npm install
npm run dev
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as credenciais do Supabase:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

## Licença

MIT
