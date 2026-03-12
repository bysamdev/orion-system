# Orion System      

Plataforma de helpdesk e gerenciamento de tickets desenvolvida para equipes modernas. O Orion System simplifica fluxos de suporte, gerenciamento de chamados e colaboração entre times numa interface limpa e responsiva.

## Tecnologias

- **Frontend:** React + TypeScript + Vite
- **Estilização:** Tailwind CSS + shadcn/ui
- **Backend (Dados/Auth):** Supabase (PostgreSQL + Auth + Storage)
- **Backend (API):** Go (opcional, para regras de negócio/escala)
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
- Go 1.22+ (para o backend em Go)

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

# Opcional: habilita o backend em Go (com fallback para Supabase Edge Functions se não estiver definido)
VITE_API_URL=http://localhost:8080
```

### Backend em Go (opcional, recomendado)

O frontend já está preparado para usar a API em Go com fallback automático.

1) Configure o arquivo `backend-go/.env` (veja `backend-go/.env.example`).

2) Rode a API:

```sh
cd backend-go
go mod tidy
go run ./cmd/api
```

3) Com `VITE_API_URL` configurado, o frontend passa a chamar `POST /functions/*` na API Go.

---
*Deploy Update: Triggering new Vercel build.*
