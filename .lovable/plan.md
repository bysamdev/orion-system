

# Plano: Robustez Operacional -- Validações, Auditoria e RBAC

## Análise do Estado Atual

**Já implementado:**
- RLS completa em todas as tabelas (multi-tenant por company_id, master company override, developer full access)
- Validação Zod no frontend para criação de tickets e updates
- Triggers de banco: `validate_ticket_input`, `set_ticket_company_from_user`, `validate_ticket_assignment`, `log_ticket_status_change`, `log_ticket_initial_status`
- `audit_trigger_function` existe mas **sem triggers ligados** (db-triggers está vazio)
- RBAC no frontend via `canManageTickets` (technician/admin/developer) e `isCustomer`
- Admin page restrita a admin/technician

**Lacunas identificadas:**
1. **Auditoria**: A função `audit_trigger_function` existe mas nenhum trigger a utiliza -- mudanças em tickets não são auditadas
2. **Validação de prioridade no update**: Ao mudar prioridade via TicketDetails, o update vai direto ao Supabase sem validação Zod
3. **RBAC frontend inconsistente**: Reports e Admin não verificam granularidade (ex: technician acessa toda a admin page incluindo gestão de usuários)
4. **Falta validação server-side para prioridade**: Não há trigger validando que `priority` seja um dos valores válidos

---

## Arquivos a Modificar/Criar

### 1. Migration SQL (novo)
**O que**: Ativar triggers de auditoria + validação de prioridade no banco

- Criar trigger `audit_tickets_changes` ligando `audit_trigger_function` à tabela `tickets` (INSERT/UPDATE/DELETE)
- Criar trigger `audit_ticket_updates_changes` ligando à tabela `ticket_updates`
- Criar function `validate_ticket_priority()` que rejeita prioridades inválidas em INSERT/UPDATE
- Criar trigger para validar prioridade

### 2. `src/pages/TicketDetails.tsx`
**O que**: Adicionar validação Zod na mudança de prioridade (atualmente faz update direto sem validação)

- Validar `newPriority` com `ticketPrioritySchema` antes de enviar ao Supabase
- Invalidar query cache após mudança de prioridade

### 3. `src/pages/Admin.tsx`
**O que**: Refinar RBAC -- técnicos veem apenas "Respostas Prontas", não gestão de usuários/empresas/contratos

- Técnicos: apenas tab "Respostas Prontas" visível
- Admin: todas as tabs
- Developer: todas as tabs

### 4. `src/pages/Reports.tsx`
**O que**: Adicionar verificação de role -- clientes não devem acessar relatórios

- Redirecionar customer para `/`

### 5. `src/hooks/useTickets.ts`
**O que**: Adicionar invalidação de queries após mudança de prioridade (para refletir nos KPIs)

### 6. `src/lib/validation.ts`
**O que**: Exportar helper para validar prioridade inline (já existe `ticketPrioritySchema`, apenas garantir uso consistente)

---

## Detalhes Técnicos

### Migration SQL

```sql
-- 1. Audit triggers em tickets
CREATE TRIGGER audit_tickets_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 2. Audit triggers em ticket_updates
CREATE TRIGGER audit_ticket_updates_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_updates
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 3. Validação server-side de prioridade
CREATE OR REPLACE FUNCTION public.validate_ticket_priority()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.priority NOT IN ('urgent', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Prioridade inválida: %. Valores: urgent, high, medium, low', NEW.priority;
  END IF;
  IF NEW.status NOT IN ('open', 'in-progress', 'awaiting-customer', 'awaiting-third-party', 'resolved', 'closed', 'reopened', 'cancelled') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ticket_fields
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_priority();
```

### TicketDetails.tsx (prioridade)
Envolver a mudança de prioridade com validação e cache invalidation:
```typescript
const validated = ticketPrioritySchema.safeParse(newPriority);
if (!validated.success) { toast error; return; }
// then update
```

### Admin.tsx (RBAC granular)
```tsx
// Técnico: apenas tab responses
const isTechnician = role === 'technician';
// Mostrar tabs condicionalmente
```

### Reports.tsx
Adicionar redirect para customers (mesma lógica do Admin.tsx).

---

## Cenários de Teste Manual

1. **Validação de prioridade**: Tentar alterar prioridade de um ticket no TicketDetails -- deve funcionar com valores válidos e rejeitar inválidos
2. **Auditoria**: Após mudar status/prioridade/responsável de um ticket, verificar na tabela `audit_log` se o registro foi criado (via SQL Editor do Supabase)
3. **RBAC Admin**: Logar como técnico → acessar `/admin` → deve ver apenas tab "Respostas Prontas"
4. **RBAC Reports**: Logar como customer → acessar `/relatorios` → deve ser redirecionado para `/`
5. **RBAC Customer**: Logar como customer → não deve ver botões de gestão (status, atribuição, prioridade) na tela do ticket
6. **Validação server-side**: Via SQL Editor, tentar `UPDATE tickets SET priority = 'invalid' WHERE id = '...'` → deve falhar

