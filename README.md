# Orion System 🚀

Plataforma de helpdesk e monitoramento inteligente projetada para equipes de TI modernas. O Orion System combina um sistema de chamados robusto com monitoramento de ativos em tempo real através de um agente nativo.

## ✨ Diferenciais Visual & UX
- **Interface Premium**: Design baseado em *glassmorphism* com efeitos de profundidade e transparência.
- **Feedback Visual**: Indicadores de status com brilho radiante (*glow*) para rápida identificação de problemas.
- **Navegação Inteligente**: Sidebar compacta e intuitiva com micro-animações de alta fidelidade.

## 🛠️ Tecnologias
- **Frontend:** React + TypeScript + Vite + Tailwind CSS (Design System Customizado).
- **Backend Unificado:** Go (Chi) rodando em Serverless (Vercel) para máxima performance e baixa latência.
- **Banco de Dados:** Supabase (PostgreSQL + Auth + Real-time).
- **Agente de Monitoramento:** Orion Agent (Go) - Binário nativo para Windows que coleta métricas e executa comandos remotos.

## 📦 Funcionalidades Principais
- **Helpdesk ITSM**: Gestão de tickets com Wizard de abertura, SLA progressivo e automações.
- **Monitoramento em Tempo Real**: Coleta de CPU, RAM e Disco via agente.
- **Comandos Remotos**: Execução de comandos no terminal das máquinas diretamente pelo portal.
- **Acesso Sem Senha**: Login no portal de chamados via atalho seguro gerado pelo agente.
- **RBAC**: Controle de acesso por funções (Admin, Técnico, Gestor, Cliente).

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 20+
- Go 1.22+
- Chaves de API do Supabase

### Instalação
```sh
# Clone o repositório
git clone https://github.com/bysamdev/orion-system.git
cd orion-system

# Instale as dependências
npm install

# Rode em modo dev
npm run dev
```

### Variáveis de Ambiente (.env)
```env
VITE_SUPABASE_URL=seu_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
VITE_API_URL=seu_url_api_go (Vercel ou Local)
```

## 🤖 Orion Agent
O agente de monitoramento é um componente crítico para o inventário e acesso remoto.
Para instruções detalhadas de como compilar e instalar o agente nas máquinas dos clientes, consulte o guia dedicado:
👉 **[Guia do Orion Agent](file:///c:/Users/suporte.ti/Documents/orion-system/orion-system/AGENT_GUIDE.md)**

---
*Orion System - Desenvolvido para simplificar a TI.*
