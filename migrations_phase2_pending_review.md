# Migrations da Fase 2 — aguardando aplicação manual

Seis migrations foram **geradas e não aplicadas**. Nenhuma foi executada em produção, nem via `supabase migration up`, nem via MCP. Nenhum código de produção foi alterado.

Aplicar na ordem numérica do timestamp. Cada arquivo traz, no rodapé, a query de verificação pós-aplicação.

| # | Arquivo | Achado | Severidade |
|---|---|---|---|
| 1 | `20260904100000_fix_ch_c12_revoke_anon_execute_on_ticket_write_rpcs.sql` | CH-C12 | P1 |
| 2 | `20260904100100_fix_ch_c07_scope_ticket_ratings_select_by_company.sql` | CH-C07 | P1 |
| 3 | `20260904100200_fix_ch_c04_lock_customer_reopen_columns.sql` | CH-C04 | P1 |
| 4 | `20260904100300_fix_ch_c06_lock_ticket_id_on_update_edit.sql` | CH-C06 | P1 |
| 5 | `20260904100400_fix_ch_c10_reconcile_ticket_status_constraint.sql` | CH-C10 | P2 |
| 6 | `20260904100500_fix_ch_c11_drop_duplicate_tickets_audit_trigger.sql` | CH-C11 | P2 |

---

## 1. CH-C12 — revogar execução anônima das RPCs de escrita

`REVOKE EXECUTE` de `anon` e `authenticated` em `auto_close_resolved_tickets()`, `update_all_tickets_sla_status()` e nas duas variantes de `fn_auto_assign_ticket`. Eram três funções `SECURITY DEFINER` com owner `postgres` que escrevem em `tickets` sem checagem de autorização, chamáveis por `POST /rest/v1/rpc/...` sem token.

**Dependência de cron verificada antes de escrever:** os jobs 1 (`auto-close-resolved-tickets`, de hora em hora) e 6 (`sla-status-recalc`, a cada 15 min) rodam como `username=postgres`, que é o owner e mantém EXECUTE. O agendamento não é afetado. `fn_auto_assign_ticket` não tem nenhum chamador — nem cron, nem corpo de função, nem `.rpc()` no frontend ou no Go.

**Risco de aplicação:** baixo. Só remove privilégio; `service_role` e `postgres` seguem podendo executar.

## 2. CH-C07 — escopar `ticket_ratings` por empresa

Substitui a policy de SELECT que checava apenas se o usuário tinha papel technician/admin/developer — sem nenhum predicado de empresa — por uma que usa `is_equipe_interna()` mais `ticket_belongs_to_user_company()`, o mesmo par usado no resto do domínio.

Antes, qualquer técnico de qualquer empresa lia `rating`, `comment` (texto livre do cliente) e `user_id` de todos os tenants. Depois, equipe interna segue vendo tudo (modelo MSP já vigente) e admin/técnico de empresa comum vê só a própria empresa.

**Risco de aplicação:** médio-baixo. É restrição de leitura: se algum relatório dependia da visão global sem ser equipe interna, ele passa a ver menos. Vale conferir os painéis de satisfação depois de aplicar.

## 3. CH-C04 — travar colunas privilegiadas na reabertura pelo cliente

Cria `enforce_customer_ticket_immutability()` e o trigger `aa_enforce_customer_ticket_immutability` em `BEFORE UPDATE ON tickets`, restaurando `company_id`, `priority`, `assigned_to`, `assigned_to_user_id`, `sla_due_date`, `sla_status`, `ticket_number` e `user_id` ao valor anterior quando quem atualiza é o dono do chamado e não é equipe interna.

**Desvio consciente do pedido:** foi solicitado apertar o `WITH CHECK` da policy comparando com o valor OLD. Isso não é implementável — uma policy RLS não enxerga `OLD`; USING avalia a linha antiga, WITH CHECK avalia a nova, e não há sintaxe para relacioná-las. Só um trigger `BEFORE UPDATE` tem as duas. A policy foi deixada intacta e a imutabilidade vive no trigger. O efeito pretendido é o mesmo.

O prefixo `aa_` no nome é deliberado: triggers `BEFORE` da mesma tabela disparam em ordem alfabética, e este precisa rodar antes de `trigger_update_sla_on_priority_change`, senão o SLA seria recalculado a partir da prioridade adulterada.

**Risco de aplicação:** médio. É o único que muda comportamento de escrita. As colunas são restauradas em silêncio, não geram erro, justamente para não quebrar a reabertura pela UI, que reenvia o registro inteiro. Testar uma reabertura real depois de aplicar.

## 4. CH-C06 — travar `ticket_id` na edição de comentário

Cria `enforce_ticket_update_ticket_id_immutability()` e trigger homônimo em `BEFORE UPDATE ON ticket_updates`, levantando erro `42501` quando alguém tenta mudar `ticket_id`.

Mesmo desvio do item anterior, pela mesma razão: `WITH CHECK` não consegue comparar com `OLD`.

**Isenção necessária:** `fn_merge_tickets` e `merge_user_data` movem `ticket_updates` entre chamados legitimamente. Confirmado lendo `pg_proc.prosrc`. Por isso a regra isenta `is_equipe_interna()` e as sessões sem `auth.uid()` (cron, service_role, backend Go). O que ela fecha é o caminho do cliente autor, que é o vetor do achado.

**Risco de aplicação:** baixo-médio. Se o merge for executado por alguém que não é equipe interna, passará a falhar — vale confirmar quem opera merge hoje.

## 5. CH-C10 — reconciliar a constraint de status com produção

Dropa `tickets_status_check` e `tickets_status_valid` e recria uma única `tickets_status_valid` com os 8 valores, igual ao que produção já tem.

Existe porque o banco foi editado fora do histórico de migrations. Reaplicar este repositório do zero produz duas constraints cuja interseção são 4 valores, rejeitando `awaiting-customer`, `awaiting-third-party`, `reopened` e `cancelled`. Produção funciona; staging, DR e máquinas de dev novas nascem com o ciclo de vida do chamado quebrado.

**Risco de aplicação:** baixo em efeito, mas o `ADD CONSTRAINT` revalida a tabela inteira sob `ACCESS EXCLUSIVE` momentâneo. Aplicar fora do pico. Em produção o resultado é semanticamente idêntico ao atual.

## 6. CH-C11 — remover o gatilho de auditoria duplicado

`DROP TRIGGER audit_tickets_trigger`. `tickets` tinha dois gatilhos byte a byte idênticos apontando para `audit_trigger_function`, e é a única tabela do schema nessa situação.

**Qual dos dois sai:** o sufixo dominante no schema é `_changes` (`audit_companies_changes`, `audit_profiles_changes`, `audit_user_roles_changes`), então fica `audit_tickets_changes`. `ticket_updates` usa `_trigger` e não foi tocada — renomear seria cosmético.

Além do armazenamento, `audit_log` está na publicação `supabase_realtime` com `REPLICA IDENTITY FULL`, então cada linha duplicada duplicava também o payload de realtime — incide direto no custo de egress.

**Risco de aplicação:** baixo. Não remove dados; as linhas duplicadas já gravadas permanecem. O arquivo traz uma query de contagem para dimensionar uma limpeza retroativa, caso você queira fazê-la depois.

---

## Sem migration, por decisão

**CH-C01 (P2)** — Go e RLS divergem sobre o escopo de technician: `lib/db.go:159` trata todo papel diferente de `customer` como global, enquanto o RLS restringe technician de empresa não-master à própria empresa. Não é corrigível por migration: são dois modelos de autorização mantidos em sincronia manualmente. O que falta é um teste de paridade Go↔RLS. Registrado como dívida técnica.

**CH-A01 (P2)** — `tickets.remote_password` é coletado pelo formulário, criptografado por trigger, e não existe nenhum caminho autorizado de leitura (`get_decrypted_remote_password` tem zero chamadores e está revogada de `anon`/`authenticated`). Sem exploração confirmada. Precisa de decisão de produto: remover o campo do formulário ou construir o caminho de leitura autorizado. Não gerei migration porque as duas saídas são incompatíveis entre si.

---

## Suíte de testes após a geração

Idêntica ao baseline — nenhuma regressão introduzida.

| Check | Baseline | Após geração |
|---|---|---|
| Frontend (vitest) | 66/66 PASS | 66/66 PASS |
| Go `orion-api` | `handler` ok, `lib` ok | `handler` ok, `lib` ok |
| Go `orion-agent` | 10 pacotes ok, 1 FAIL | 10 pacotes ok, 1 FAIL |

A falha em `orion-agent/shortcut` (`TestCriarAtalhoEm_ApontaParaOIconeRealDoOrion`) é anterior a esta auditoria e não tem relação com chamados: `gravarIconeOrion` está fixado em `C:\Orion`, caminho que não existe em máquina de desenvolvimento.

As migrations são arquivos SQL e não participam de nenhuma das suítes, então o resultado idêntico era o esperado — a execução serviu apenas para confirmar que a geração não tocou em nada mais.
