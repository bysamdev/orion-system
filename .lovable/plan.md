

# Plano de Evolução: Orion System Helpdesk

## 1. Visão Geral do Sistema

### Estado Atual
O Orion System já possui uma base sólida com:
- **Multi-tenancy**: Isolamento por `company_id` com RLS implementado
- **Gestão de tickets**: Criação, listagem, atribuição, SLA automático
- **Papéis**: customer, technician, admin, developer
- **Planos SaaS**: Starter/Business/Enterprise com limite de usuários
- **Respostas prontas**: Templates por empresa
- **Notificações em tempo real**: Via Supabase Realtime
- **Auditoria**: Tabela `audit_log` com triggers
- **Anexos**: Upload de arquivos via Storage

### Visão de Futuro
Transformar o Orion em uma plataforma profissional de helpdesk multi-tenant com:
- Contratos por cliente com SLAs personalizados
- Base de conhecimento e catálogo de serviços
- Apontamento de horas e relatórios avançados
- Integrações com e-mail, WhatsApp e ferramentas de monitoramento

---

## 2. Ajustes de Modelagem de Dados

### 2.1 Novas Tabelas

```text
┌─────────────────┐      ┌─────────────────┐
│    contracts    │──────│   sla_configs   │
│  (por cliente)  │      │ (por contrato)  │
└─────────────────┘      └─────────────────┘

┌─────────────────┐      ┌─────────────────┐
│   categories    │      │    services     │
│  (hierárquica)  │      │   (catálogo)    │
└─────────────────┘      └─────────────────┘

┌─────────────────┐      ┌─────────────────┐
│ time_entries    │      │ knowledge_base  │
│ (apontamentos)  │      │    (artigos)    │
└─────────────────┘      └─────────────────┘

┌─────────────────┐      ┌─────────────────┐
│ custom_fields   │      │ custom_values   │
│  (definições)   │      │   (valores)     │
└─────────────────┘      └─────────────────┘
```

**contracts**: Contratos vinculados a empresas-cliente
- `id`, `company_id`, `name`, `start_date`, `end_date`, `sla_config_id`, `monthly_hours`, `is_active`

**sla_configs**: Configurações de SLA personalizadas
- `id`, `name`, `urgent_hours`, `high_hours`, `medium_hours`, `low_hours`, `business_hours_only`, `company_id`

**categories**: Categorias hierárquicas
- `id`, `name`, `parent_id`, `company_id`, `icon`, `is_active`

**services** (catálogo de serviços):
- `id`, `name`, `description`, `category_id`, `default_priority`, `estimated_hours`, `company_id`

**time_entries**: Apontamento de horas
- `id`, `ticket_id`, `user_id`, `start_time`, `end_time`, `duration_minutes`, `description`, `billable`

**knowledge_base**: Artigos de conhecimento
- `id`, `title`, `content`, `category_id`, `company_id`, `is_public`, `view_count`, `created_by`

**custom_fields**: Campos personalizados por cliente
- `id`, `company_id`, `name`, `field_type` (text, select, date, number), `options`, `required`, `applies_to` (ticket/profile)

**custom_values**: Valores dos campos personalizados
- `id`, `custom_field_id`, `entity_id`, `entity_type`, `value`

### 2.2 Ajustes em Tabelas Existentes

**tickets**: Adicionar colunas
- `contract_id` → FK para contratos
- `service_id` → FK para catálogo de serviços
- `resolution_notes` → Resumo da resolução
- `satisfaction_rating` → NPS do cliente (1-5)
- `scheduled_date` → Para agendamentos

**companies**: Adicionar colunas
- `cnpj`, `phone`, `address`, `logo_url`, `settings` (JSONB)

### 2.3 Fluxo de Status Padronizado

```text
[Aberto] → [Em Atendimento] → [Aguardando Cliente] ↔
              ↑                [Aguardando Terceiro]
              ↓
        [Resolvido] → [Fechado]
              ↑
        [Cancelado]
        
[Fechado] → [Reaberto] → volta para [Em Atendimento]
```

Adicionar status:
- `awaiting-customer` (aguardando cliente)
- `awaiting-third-party` (aguardando terceiro)
- `cancelled` (cancelado)

---

## 3. Ajustes de UX/Fluxo de Trabalho

### 3.1 Dashboard do Técnico
- **Timer flutuante**: Botão "Iniciar Trabalho" que contabiliza tempo no ticket atual
- **Visão Kanban**: Opção de alternar entre lista e board com drag-and-drop
- **Filtros persistentes**: Salvar filtros favoritos por usuário
- **Atalhos de teclado**: K(anban), T(abela), N(ovo ticket), /(busca)

### 3.2 Tela de Detalhes do Ticket
- **Sidebar fixa**: Informações do solicitante, empresa, contrato e SLA sempre visíveis
- **Timeline unificada**: Comentários + mudanças de status + anexos em timeline única
- **Quick actions**: Botões de ação rápida no topo (Resolver, Escalar, Transferir)
- **Integração KB**: Sugerir artigos relacionados automaticamente
- **Campos customizados**: Renderizar dinamicamente conforme configuração do cliente

### 3.3 Portal do Cliente
- **Auto-serviço**: Busca na base de conhecimento antes de abrir ticket
- **Acompanhamento visual**: Timeline simplificada do chamado
- **Pesquisa de satisfação**: Modal após fechamento do ticket

### 3.4 Filas e Distribuição
- **Fila inteligente**: Ordenar por SLA restante, não por data de criação
- **Auto-atribuição**: Opção de distribuição automática round-robin
- **Escalação automática**: Mover para coordenador se SLA em risco

---

## 4. Novos Módulos e Funcionalidades

### 4.1 Base de Conhecimento (KB)
- Editor WYSIWYG para artigos
- Categorização e tags
- Busca full-text
- Vinculação de artigos a tickets
- Métricas de utilização

### 4.2 Catálogo de Serviços
- Lista de serviços oferecidos por empresa
- Tempo estimado e prioridade padrão
- Formulários dinâmicos por serviço
- SLA específico por serviço

### 4.3 Contratos e SLA Personalizado
- Cadastro de contratos por cliente
- SLA customizado por contrato (horas diferentes)
- Opção de calcular apenas dias úteis
- Banco de horas contratado vs. consumido

### 4.4 Apontamento de Horas
- Start/Stop no ticket ou entrada manual
- Relatório de horas por cliente/período
- Horas faturáveis vs. internas
- Exportação para faturamento

### 4.5 Relatórios Gerenciais
- Dashboard executivo: SLA%, TMR, volume
- Relatório de produtividade por técnico
- Análise de categorias mais recorrentes
- Exportação PDF/Excel
- Agendamento de relatórios por e-mail

### 4.6 Campos Personalizados
- Configuração no admin por empresa
- Tipos: texto, seleção, data, número, checkbox
- Obrigatórios ou opcionais
- Exibição condicional

---

## 5. Segurança, Permissões e Auditoria

### 5.1 Papéis Expandidos
Manter tabela `user_roles` separada (já existe). Adicionar:
- **coordinator**: Pode ver relatórios da equipe, escalar tickets
- Permissões granulares via tabela `permissions`:
  - `can_delete_tickets`, `can_manage_contracts`, `can_view_billing`, etc.

### 5.2 Auditoria Expandida
- Já existe `audit_log` com trigger em tabelas críticas
- Adicionar: Retenção configurável (ex: 90 dias)
- Tela de visualização de logs no admin
- Filtros por usuário, ação, período

### 5.3 Segurança Adicional
- **2FA**: Autenticação em dois fatores para admins
- **IP allowlist**: Restringir acesso por IP (config por empresa)
- **Session timeout**: Logout automático após inatividade
- **Política de senhas**: Configurável por empresa

---

## 6. Integrações e Automações

### 6.1 Email-to-Ticket
- Endpoint Supabase Edge Function para receber e-mails (via webhook Resend/SendGrid)
- Parser de e-mail para extrair: remetente, assunto, corpo
- Criar ticket ou adicionar comentário se já existir

### 6.2 Notificações Multicanal
- **E-mail transacional**: Já preparado com Resend
- **WhatsApp**: Integração via API oficial ou Twilio
- **Telegram**: Bot para notificações e comandos básicos
- Configuração de preferências por usuário

### 6.3 API/Webhooks
- Endpoints REST para CRUD de tickets (já via Supabase)
- Webhooks de saída: `ticket.created`, `ticket.resolved`, `sla.breached`
- Integração com Zabbix/PRTG: Criar ticket via alerta

### 6.4 Automações (Rules Engine)
- Regras configuráveis: "Se categoria = X, atribuir a técnico Y"
- Ações: auto-atribuir, mudar prioridade, notificar
- Triggers: criação, mudança de status, SLA em risco

---

## 7. Roadmap em Etapas

### Fase 1: MVP Produção (4-6 semanas)
Consolidar o que já existe + ajustes críticos:
1. Expandir status do ticket (awaiting-customer, awaiting-third-party, cancelled)
2. Implementar catálogo de categorias hierárquicas
3. Adicionar campo `resolution_notes` e pesquisa de satisfação
4. Criar tela de gestão de planos por empresa no admin
5. Melhorias de UX: filtros persistentes, atalhos de teclado
6. Testes E2E com Playwright para fluxos críticos

### Fase 2: Funcionalidades Core (6-8 semanas)
1. Contratos e SLA personalizado por cliente
2. Apontamento de horas (timer no ticket)
3. Base de conhecimento básica
4. Catálogo de serviços
5. Relatórios de produtividade e SLA

### Fase 3: Personalização e Automação (4-6 semanas)
1. Campos personalizados por cliente
2. Motor de regras/automação básico
3. Dashboard executivo com KPIs avançados
4. Exportação de relatórios (PDF/Excel)
5. Agendamento de relatórios por e-mail

### Fase 4: Integrações (6-8 semanas)
1. Email-to-ticket
2. Webhooks de saída
3. Integração WhatsApp (Twilio/API oficial)
4. API REST documentada com Swagger
5. Integração Zabbix para alertas

### Fase 5: Enterprise (ongoing)
1. 2FA e políticas de segurança avançadas
2. Multi-idioma (i18n)
3. White-label completo
4. App mobile (React Native)
5. IA para sugestão de artigos e classificação automática

---

## Resumo Técnico

| Área | Complexidade | Prioridade |
|------|--------------|------------|
| Status expandidos | Baixa | Alta |
| Categorias hierárquicas | Média | Alta |
| Contratos/SLA custom | Alta | Alta |
| Apontamento de horas | Média | Alta |
| Base de conhecimento | Média | Média |
| Campos personalizados | Alta | Média |
| Email-to-ticket | Média | Média |
| Motor de automação | Alta | Baixa |
| Integrações WhatsApp | Alta | Baixa |

