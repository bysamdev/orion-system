# Relatório 06: Governança de Banco de Dados

## 1. Avaliação de Constraints de Integridade (Foreign Keys)
Foram executadas auditorias para validar o uso de chaves estrangeiras (`FOREIGN KEY REFERENCES`) e integridade referencial nas tabelas mapeadas no Supabase.

### 1.1 Chaves Estrangeiras Faltantes
A varredura detectou as seguintes colunas que indicam relação com outras entidades, mas carecem de uma `FOREIGN KEY` oficial nas migrations:
- **`time_entries.user_id`**: Não possui `REFERENCES auth.users(id)` ou `REFERENCES public.profiles(id)`. Isso permite a inserção de usuários fantasmas (risco alto).
- *Falsos Positivos Avaliados:*
  - `audit_log.record_id` e `custom_field_values.entity_id`: São campos polimórficos (`entity_type` / `table_name` os acompanham), portanto não se aplicam a constraints tradicionais.
  - `monitored_endpoints.uptimerobot_monitor_id`: Refere-se a um ID externo em sistema terceiro, mapeado como `TEXT`.

### 1.2 Integridade de Exclusão em Cascata (ON DELETE)
A maioria dos relacionamentos master-detail foram criados. Entretanto, notou-se inconsistência na aplicação do `ON DELETE CASCADE` ou `ON DELETE SET NULL`:
- As constraints em muitas das junções omitem `ON DELETE CASCADE`, o que pode deixar registros órfãos ou impedir a deleção do registro-pai.
- O mapeamento em `monitored_endpoints` (`company_id UUID REFERENCES companies(id)`) omite qualquer estratégia de remoção em cascata.
- A exclusão de usuários na tabela `auth.users` foi desenhada com deleção em cascata (`ON DELETE CASCADE`) na maior parte das ligações (`profiles`, etc.), mas conexões secundárias (como `assigned_to_user_id` em tickets) não padronizam comportamento claro para inativação vs. exclusão.

---

## 2. Divisão de Lógica: API/Backend vs Triggers/Functions
Como diretriz de arquitetura e escalabilidade, analisamos os scripts em PL/pgSQL na schema `public`:

### 2.1 O que DEVE ser mantido no Banco de Dados (Triggers / Functions)
São rotinas essenciais para segurança de base, integridade isolada e padrões do ecossistema Supabase:
1. **Auditoria (`audit_trigger_function`)**: Mantém a inviolabilidade do histórico (rastreamento de inserts/updates/deletes) impedindo manipulações diretas.
2. **Histórico de Status (`log_ticket_status_change`)**: Garante que o histórico do ticket não perca fases do fluxo.
3. **Handle New User (`handle_new_user`)**: Rotina nativa do Supabase para refletir as criações de `auth.users` em `public.profiles`.
4. **Auto-preenchimento Inviolável**: Funções seguras baseadas em RLS (ex: `set_ticket_update_author` que busca o autor via `auth.uid()`).

### 2.2 O que DEVERIA ir para a API / Backend
Lógicas de negócio mutáveis, pesadas e conexões externas perdem escalabilidade no DB e devem migrar:
1. **Cálculos de Regras de Negócio e SLAs (`calculate_sla_due_date`)**: Lidar com fuso horário, calendário e horários úteis em PL/pgSQL é difícil de manter. Deve ser executado no backend (Node/Python) e o DB só deve persistir o cálculo (Ex: `due_date`).
2. **Workers Baseados em Tempo (`auto_close_resolved_tickets`)**: Triggers ou agendadores no banco para fechar tickets que passaram dias não escalam bem, impactando os locks de DB. Recomenda-se um Job programado no lado da API.
3. **Resoluções Mágicas de Nomes em vez de IDs (`validate_ticket_assignment`)**: Atualmente uma trigger faz query de `full_name` para descobrir o UUID de um atendente (`assigned_to_user_id`). Isso deve ser feito pela UI (passar o UUID) de forma determinística, ao invés da trigger buscar o ID via texto (vulnerável a nomes homônimos).
4. **Checagem de Subscrição (`check_plan_limits_on_user_create`)**: Acopla o faturamento da plataforma (planos e capacidades) dentro de procedures do banco de dados, o que dificulta manutenções ou overrrides manuais da equipe de suporte.

### 2.3 Anti-Patterns: Triggers no lugar de Restrições Nativas (CHECK Constraints)
Foram encontradas múltiplas funções que agem como validação em Triggers, penalizando o tempo de inserção/update. Elas devem ser descartadas e convertidas para simples `CHECK Constraints` declarativas na tabela:
- `validate_company_input` *(Deve ser: `CHECK (length(trim(name)) >= 2)`)*
- `validate_time_entry` *(Deve ser: `CHECK (end_time >= start_time AND duration_minutes >= 0)`)*
- `validate_contract_dates` *(Deve ser: `CHECK (end_date >= start_date)`)*
- `validate_sla_config_hours` *(Deve ser: `CHECK (urgent_hours > 0 AND high_hours > 0 ...)`)*
- `validate_category_parent` *(Deve ser: `CHECK (parent_id != id)`)*

Adicionalmente, validações de autorização contidas em Triggers como `validate_company_assignment` (que validam roles) devem preferencialmente fazer uso do motor natural de **RLS Policies (`WITH CHECK`)** do Supabase.

---
**Conclusão da Governança**: A arquitetura do Orion System exibe certa dependência do banco como camada de "lógica de aplicação". Para ganho de escalabilidade e desacoplamento, a plataforma deve reverter à postura onde o PostgreSQL age como protetor de dados puros, e as regras complexas fluam para serviços isolados no Backend.
