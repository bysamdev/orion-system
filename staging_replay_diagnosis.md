# Diagnóstico do `MIGRATIONS_FAILED` — RESOLVIDO

> **Status final: replay valida 184/184 migrations sem erro**, confirmado por execução real em Postgres limpo no servidor bysamdev (Supabase CLI 2.116.0, Docker). Ver seção "Fechamento" no final.

# Diagnóstico original — por que o replay das migrations falhava

Objetivo: entender por que o replay deste repositório sobre um banco limpo falha, e como destravar a criação de um ambiente de staging.

**Nada foi aplicado em produção nesta investigação.** A única alteração em produção desta etapa foi a migration do CH-C15, que é frente separada.

---

## Método e sua limitação

Não há Docker nem Supabase CLI nesta máquina:

```
$ supabase --version   → command not found
$ docker --version     → command not found
```

Sem Docker não há Postgres local, então **`supabase db reset` não pôde ser executado** e não existe saída de erro real do replay. O diagnóstico abaixo é **análise estática**: inventário dos objetos criados por cada migration cruzado com os objetos referenciados, em ordem cronológica.

Consequência honesta: as causas abaixo estão confirmadas por leitura do SQL — cada uma tem arquivo, linha e statement — mas a **ordem** em que o Postgres aborta e a existência de causas adicionais depois da primeira só se confirmam com um replay real. Rodar `supabase db reset` numa máquina com Docker continua sendo o passo de validação.

---

## Causa 0 — O histórico está dessincronizado por construção

Não é causa de falha de replay, mas explica por que qualquer ferramenta que compare repositório e banco se perde.

| | |
|---|---:|
| Arquivos `.sql` no repositório | 184 |
| Registros em `supabase_migrations.schema_migrations` | 138 |
| Versões presentes nos dois | **10** |
| Arquivos sem registro correspondente | 174 |
| Registros sem arquivo correspondente | 128 |

O padrão é sistemático: os nomes de arquivo estão 1 a 3 segundos **à frente** das versões gravadas no banco.

```
repo=20251017174456   banco=20251017174454
repo=20251017174523   banco=20251017174520
repo=20251017175907   banco=20251017175905
repo=20251017182102   banco=20251017182100
repo=20251020210807   banco=20251020210805
```

São as mesmas migrations sob versões diferentes — sinal de arquivos regerados ou renomeados fora do fluxo do CLI. Efeito prático: um `supabase db push` consideraria praticamente todas as 184 pendentes e tentaria reaplicá-las sobre produção.

**Não corrija isso com `db push`.** A reconciliação é feita marcando as versões como aplicadas (`supabase migration repair`), nunca reaplicando.

---

## Causas duras do `MIGRATIONS_FAILED`

Em ordem cronológica. O replay aborta na primeira.

### Causa 1 — `public.users` não existe · `20260316000000_smart_management.sql:18`

**Confiança: CONFIRMADO.** Primeira a abortar.

```sql
CREATE TABLE IF NOT EXISTS public.routing_rules (
    ...
    action_target_user_id UUID REFERENCES public.users(id),
    ...
);
```

`public.users` aparece **uma única vez em todo o diretório de migrations**, e é referência, não criação. Nenhum arquivo a cria. Uma FK exige a tabela existente no momento do `CREATE TABLE`, então o replay morre com `relation "public.users" does not exist`.

É o padrão já documentado no relatório de auditoria: objeto criado à mão em produção. Provavelmente alguém quis referenciar `auth.users` (o schema do Supabase Auth) e escreveu `public.users`.

**Detalhe relevante:** `20260614000001_enable_rls_machines.sql:25-28` executa `DROP COLUMN IF EXISTS action_target_user_id` — a coluna acabou descartada. Mas isso é 3 meses depois na linha do tempo; o replay já morreu.

### Causa 2 — Policies duplicadas em `machine_metrics` · `20260829120000_metrics_history_and_retention.sql:56,62,68`

**Confiança: CONFIRMADO.**

Três `CREATE POLICY` com nomes idênticos aos já criados em `20260614000001_enable_rls_machines.sql:126,132,144`, sobre a mesma tabela, **sem `DROP POLICY IF EXISTS` antes**. `CREATE POLICY` não aceita `IF NOT EXISTS`, então colide com `policy ... already exists`.

Nada entre as duas migrations derruba a tabela ou as policies — o `DROP TABLE` de `20260831000000` é posterior. O cabeçalho do próprio arquivo (linhas 4-12) explica por que passa em produção: a tabela havia sido removida ao vivo por uma migration não versionada. Ou seja, **a causa 2 também nasce de drift.**

### Causa 3 — `REVOKE` em funções inexistentes · `20260904095000_...:62,74,76`

**Confiança: CONFIRMADO. Defeito introduzido por esta auditoria — já corrigido.**

As três funções (`get_reports_tickets`, `get_reports_active_in_period`, `get_reports_created_in_period`) existem em produção e **em nenhum arquivo do repositório**. Um `REVOKE EXECUTE` direto sobre elas aborta o replay com `function ... does not exist`.

**Corrigido**: as revogações passaram a ser condicionadas por `to_regprocedure(...) IS NOT NULL`, que devolve `NULL` em vez de levantar erro quando a assinatura não existe. Em produção o efeito é idêntico; em banco limpo viram no-op.

Nota de rastreabilidade: a versão **já aplicada em produção** usava `REVOKE` direto. Como as três funções existem lá, o resultado foi o mesmo — o arquivo e o efeito aplicado são equivalentes.

### Causa 4 — `REVOKE` em sobrecarga inexistente · `20260904100000_...:42`

**Confiança: CONFIRMADO. Defeito introduzido por esta auditoria — já corrigido.**

```sql
REVOKE EXECUTE ON FUNCTION public.fn_auto_assign_ticket(uuid) FROM anon, authenticated;
```

`20260621000001_auto_assign_tickets.sql:3` cria apenas `fn_auto_assign_ticket()` — **sem argumentos**. A sobrecarga `(uuid)` foi criada à mão em produção e não existe no repositório.

**Corrigido**: as quatro revogações do arquivo passaram por um laço guardado por `to_regprocedure`, com `RAISE NOTICE` quando a assinatura não existe. Esta migration **não foi aplicada** em nenhum ambiente.

### Descartadas com verificação

Registrado para não serem reinvestigadas:

- Os três "full reset" com `DROP TYPE app_role CASCADE` (`20251022014710`, `20251022014746`, `20251022014817`) — idempotentes; tudo que o CASCADE derruba é recriado no mesmo arquivo.
- ~85 colisões potenciais de `CREATE` sem `IF NOT EXISTS` — todas precedidas do `DROP` correspondente no mesmo arquivo.
- Triggers e policies duplicados em `20251119041654` e `20260614000001` — guardados por consulta a `pg_trigger` / `pg_policies`.
- Vault: o `RAISE EXCEPTION` de `20260813130000` só ocorre em runtime; o único `PERFORM` em tempo de migration está dentro de `EXCEPTION WHEN OTHERS ... RETURN`.
- Extensões — todas criadas antes dos consumidores.
- `companies.is_master` — criada em `20260825012251:170` e só referenciada depois. As ocorrências anteriores (`20251223145052:11`, `20260309032837:88`) são `is_master boolean;`, declaração de variável local em PL/pgSQL.
- Zero violações de ordem em `ALTER TABLE`, `CREATE INDEX` e `CREATE TRIGGER`.

---

## A migration `20260904100400` (CH-C10) resolve isso?

**Não. Nenhuma das quatro causas.**

Ela é correta e idempotente — `DROP CONSTRAINT IF EXISTS` nas duas constraints e depois `ADD CONSTRAINT tickets_status_valid` com os 8 valores — e conserta de fato a interseção de CHECKs. Mas isso é **bug de comportamento, não de replay**: adicionar uma segunda CHECK a uma coluna é uma operação legal, que não gera erro.

E ela roda em `20260904100400`, depois das quatro causas. Num reset limpo o replay morre em `20260316000000` e **nunca chega a executá-la**.

Correção de expectativa: a hipótese de que aplicar o CH-C10 destravaria o `supabase branches create` está **refutada**.

---

## Plano para destravar staging

### Ponto estrutural que muda a abordagem

**Uma migration nova, acrescentada ao fim da fila, não pode corrigir uma falha de replay que ocorre antes dela.** As causas 1 e 2 estão em `20260316000000` e `20260829120000`; nada colocado em `20260905...` roda antes delas num banco limpo.

Portanto as causas 1 e 2 exigem **editar os arquivos históricos** — não uma migration nova. Isso normalmente é má prática, mas aqui o histórico do repositório já não corresponde ao do banco (Causa 0), e o repositório serve hoje apenas para reconstrução de ambientes. Editar esses dois arquivos não afeta produção, cujo `schema_migrations` não os referencia por essas versões.

**Não fiz essas edições.** São alterações em histórico e dependem da sua decisão.

### Passos

**Passo 1 — corrigir a Causa 1** (edição em `20260316000000_smart_management.sql:18`)

```diff
-    action_target_user_id UUID REFERENCES public.users(id),
+    action_target_user_id UUID,
```

Remover só a cláusula de FK. Justificativa: a coluna é descartada depois, em `20260614000001:25-28`, então a integridade referencial nunca foi exercida de verdade. Alternativa, se quiser preservar a intenção original: `REFERENCES auth.users(id)`.

**Risco:** baixo. Não toca produção. Muda apenas o schema de ambientes reconstruídos, onde a coluna some em seguida.

**Passo 2 — corrigir a Causa 2** (edição em `20260829120000_metrics_history_and_retention.sql`, antes das linhas 56, 62 e 68)

```diff
+DROP POLICY IF EXISTS "<nome exato da policy>" ON public.machine_metrics;
 CREATE POLICY "<nome exato da policy>" ON public.machine_metrics ...
```

Nos três blocos. Padrão já usado à exaustão no resto do repositório.

**Risco:** baixo. Torna o arquivo idempotente sem mudar o resultado final.

**Passo 3 — validar com replay real**

Numa máquina com Docker:

```bash
npm i -g supabase        # ou: npx supabase
supabase init            # se necessário
supabase start
supabase db reset
```

`db reset` aplica os 184 arquivos em ordem sobre um Postgres limpo. **Capture a saída completa.** Se falhar, o erro nomeia arquivo e statement — e passa a ser a Causa 5, com diagnóstico direto em vez de estático.

Este passo é o que valida todo este documento. Até ele rodar, as quatro causas estão confirmadas individualmente por leitura do SQL, mas o conjunto não foi provado exaustivo.

**Passo 4 — confirmar o CH-C10 no ambiente reconstruído**

Com o replay completando, executar o §8 de [migrations_phase2_test_plan.md](migrations_phase2_test_plan.md): confirmar as duas constraints de status, aplicar `20260904100400`, e confirmar que os 8 status passam a ser aceitos.

**Passo 5 — só então criar o staging**

`supabase branches create` replica o mesmo conjunto de arquivos. Enquanto os passos 1 a 3 não fecharem, cada tentativa gasta um branch no mesmo erro — motivo pelo qual não tentei criar nenhum.

**Passo 6 — reconciliar o histórico (Causa 0), separado**

Depois do staging de pé. Usar `supabase migration repair` para alinhar as versões, nunca `db push`. Merece planejamento próprio: são 174 arquivos sem registro correspondente.

---

## Adição à lista de migrations pendentes de revisão

As causas 1 e 2 **não geram migration nova** — são edições em arquivos históricos, pelo motivo explicado acima. Registradas aqui no mesmo formato das outras 8:

| Item | Achado | Tipo | Risco | Roteiro de teste |
|---|---|---|---|---|
| `20260316000000_smart_management.sql:18` | Replay Causa 1 | Edição de histórico | Baixo — não toca produção | Passo 3: `supabase db reset` completa além de `20260316000000` |
| `20260829120000_metrics_history_and_retention.sql:56,62,68` | Replay Causa 2 | Edição de histórico | Baixo — torna idempotente | Passo 3: `db reset` completa além de `20260829120000` |
| `20260904095000` (Causa 3) | Introduzida por esta auditoria | **Já corrigida** | — | Guardas `to_regprocedure` cobrem banco limpo e produção |
| `20260904100000` (Causa 4) | Introduzida por esta auditoria | **Já corrigida** | — | Idem; ainda não aplicada em nenhum ambiente |

---

## Relação com os achados da auditoria

Este diagnóstico é a quarta manifestação independente do mesmo problema de fundo já registrado como **CH-C10**:

1. Constraint de status divergente entre repositório e produção.
2. `tickets` e `ticket_updates` removidas da publicação de realtime sem migration (**FP-001**).
3. `get_reports_tickets` existindo só em produção (**CH-C15**).
4. `public.users` e `fn_auto_assign_ticket(uuid)` referenciados mas nunca criados — o inverso: produção tem objetos que o repositório desconhece.

A causa raiz não é nenhuma migration específica. É que **mudanças de schema vêm sendo aplicadas em produção fora do fluxo de migrations**. Enquanto isso não mudar, cada correção pontual aqui será revertida pela próxima alteração manual.

---

# Fechamento — replay validado 184/184

Validação executada em Postgres limpo, no servidor `bysamdev` (Debian, Docker 29.8.0), com Supabase CLI 2.116.0 instalada isolada em `~/bin` e projeto descartável em `~/orion-replay`. Stack local subida com `-x studio,imgproxy,edge-runtime,logflare,vector,mailpit,supavisor,realtime`.

```
$ grep -c "^Applying migration" /tmp/sb.log
184
$ grep -A 15 "^ERROR:" /tmp/sb.log
(vazio)
```

Nenhum container de monitoramento foi tocado em nenhum momento.

## Quadro completo das causas

| # | Arquivo | Linha(s) | Erro (SQLSTATE) | Natureza | Correção |
|---|---|---|---|---|---|
| 1 | `20260316000000_smart_management.sql` | 18 | `relation "public.users" does not exist` (42P01) | Objeto só existe em produção | FK removida; coluna vira `UUID` puro |
| 2 | `20260829120000_metrics_history_and_retention.sql` | 56, 62, 68 | `policy ... already exists` (42710) | Drift: tabela removida ao vivo | `DROP POLICY IF EXISTS` antes de cada `CREATE` |
| 3 | `20260904095000_...get_reports_tickets.sql` | 62, 74, 76 | `function ... does not exist` (42883) | Introduzida por esta auditoria | `REVOKE` guardado por `to_regprocedure` |
| 4 | `20260904100000_...ticket_write_rpcs.sql` | 42 | `function ... does not exist` (42883) | Introduzida por esta auditoria | Laço guardado por `to_regprocedure` |
| 5 | `20251017185357_c7bf4496....sql` | 3-22 | `No admin user found...` (P0001) | Dependência de dados | `RAISE EXCEPTION` → `RAISE NOTICE` |
| 6 | `20251017185357_c7bf4496....sql` | 25-26 | `column "user_id" ... contains null values` (23502) | Dependência de dados (seed de demo) | `DELETE FROM tickets WHERE user_id IS NULL` no ramo `ELSE` |
| 7 | `20251017175907_2fcbbbd0....sql` | 2 | `invalid input value for enum app_role: "developer"` (22P02) | Ordem cronológica | `'developer'` incluído no `CREATE TYPE` original |
| 8 | `20251021034345_c8d59c12....sql` | 378 | `relation "public.departments" does not exist` (42P01) | Ordem cronológica | `CREATE TABLE IF NOT EXISTS` antecipado |
| 9 | `20251022011630_977a696e....sql` | 52-53 | `function public.validate_ticket_input() does not exist` (42883) | Ordem cronológica | Dois `CREATE TRIGGER` guardados por `to_regprocedure` |
| 10 | `20251022015832_05f81891....sql` | 1-17 | `violates foreign key constraint "profiles_id_fkey"` (23503) | Dependência de dados (conta real) | `INSERT`s guardados por `EXISTS` em `auth.users` |
| 11 | `20260316000000_add_cmdb_assets.sql` | 38, 48, 59, 70 | `column "role" does not exist` (42703) | Coluna que nunca existiu | `profiles.role` → `has_role(...)`; `JOIN` supérfluo removido |
| 12 | `20260316000002_smart_management.sql` (42,73,103) e `20260318120000_automation_engine_v2.sql` (50) | — | `column "role" does not exist` (42703) | Idem | Idem |
| — | *colisão de timestamp* | 8 pares | `duplicate key ... schema_migrations_pkey` (23505) | Infraestrutura do histórico | 8 renames mecânicos (segundo de cada par) |
| 13 | `20260318000000_agent_v2_support.sql` | 10 | `syntax error at or near "current_user"` (42601) | Palavra reservada | `current_user` → `"current_user"` |
| 14 | `20260621000003_add_canned_responses_and_routing_rule.sql` | 22 | `column "role" does not exist` (42703) | Coluna inexistente, em bloco `DO` executado | `JOIN public.user_roles` |
| 15 | `20260820200000_add_user_backup_codes.sql` | 114-115 | `function public.verify_user_backup_code(text[]) does not exist` (42883) | Assinatura errada por copy-paste | `(text[])` → `(text)` |
| 16 | `20260902190000_remove_machines_from_realtime.sql` | 43 | `relation "machines" is not part of the publication` (42704) | Drift: publicação alterada à mão | `DROP` guardado por `pg_publication_tables` |

## Os 8 renames de timestamp

Nenhum par tinha dependência cruzada (verificado arquivo a arquivo). Regra aplicada: mantém o primeiro em ordem alfabética, empurra o segundo para o próximo timestamp livre.

```
20260316000000_smart_management                  -> 20260316000002
20260316000001_sla_logic                         -> 20260316000003
20260614000000_setup_pg_cron_cleanup             -> 20260614000006
20260614000001_fix_routing_and_checklists_schema -> 20260614000007
20260614000002_seed_sla_configs                  -> 20260614000008
20260614000003_seed_departments                  -> 20260614000009
20260818040000_secure_bridge_rpc_functions       -> 20260818040001
20260818060000_fix_remote_password_decrypt_authz -> 20260818060001
```

## CH-C10 confirmado no ambiente reconstruído

`20260904100400_fix_ch_c10_reconcile_ticket_status_constraint.sql` rodou como a **183ª** de 184. Estado resultante em `public.tickets`:

```
tickets_status_valid  CHECK (status = ANY (ARRAY['open','in-progress','awaiting-customer',
                      'awaiting-third-party','resolved','closed','reopened','cancelled']))
```

`tickets_status_check` não existe. As duas constraints foram consolidadas em uma só com os 8 valores, e o resultado é **idêntico ao de produção** — que era exatamente o objetivo do CH-C10.

## Pendências que este trabalho NÃO resolve

**Ordem semântica em pares renomeados (para o passo 6, reconciliação via `migration repair`).** A regra mecânica destrava o replay porque não há dependência real que quebre, mas em dois pares a ordem tem peso semântico e a escolha alfabética foi arbitrária:

- `20260614000001` — `enable_rls_machines` vs `fix_routing_and_checklists_schema`, sendo que este último redefine `resolution_checklists` e `routing_rules`, já criadas antes por `smart_management`. Qual roda primeiro decide qual definição prevalece.
- `20260614000002` / `20260614000003` — pares "índices" vs "seed". O resultado final é igual, mas semear antes ou depois de indexar tem custo diferente.

Qual ordem reflete o que está de fato em produção é pergunta para a reconciliação do histórico, não para o replay.

**Bugs latentes de runtime em `plpgsql` (não corrigidos, deliberadamente).** Quatro referências a `profiles.role`, coluna que nunca existiu, dentro de corpos de função que o Postgres não valida na criação. Não bloqueiam o replay, mas falham quando executadas. Corrigi-las mudaria comportamento em produção, o que sai do mandato de correção neutra:

- `20260317000000_routing_triggers.sql:58`
- `20260319100000_repair_tickets_schema.sql:79`
- `20260811000001_fix_tr_auto_route_ticket_crash.sql:69`
- `20260318120000_automation_engine_v2.sql:138`

**Causa 0 permanece.** Os 184 arquivos seguem dessincronizados dos 138 registros de `schema_migrations` em produção. O replay validado prova que o repositório agora **reconstrói um banco do zero**; não prova que ele descreve o que está em produção.
