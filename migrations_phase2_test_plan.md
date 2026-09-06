# Roteiro de teste das migrations da Fase 2

Complemento de [migrations_phase2_pending_review.md](migrations_phase2_pending_review.md) e [AUDITORIA-CHAMADOS-2026-09-04.md](AUDITORIA-CHAMADOS-2026-09-04.md).

**Estado atual: nenhuma das 8 migrations foi aplicada, em nenhum ambiente.**

---

## Bloqueador: não existe ambiente de staging

A aplicação isolada do CH-C15 em staging não foi executada porque não há staging.

| Verificação | Resultado |
|---|---|
| `supabase/config.toml` | `project_id = "kcxwealimsfxqstoprdg"` — produção, único apontamento do repo |
| Arquivos `.env` | Nenhum |
| Referência a staging/homolog/sandbox | Nenhuma em todo o repositório |
| `.github/` | Não existe |
| Projetos Supabase `ACTIVE_HEALTHY` | Apenas "Orion System" (produção) |
| Outros projetos da org | `sam.dev`, `bysam.dev`, `tura-hub`, `dojo-pib-system` — todos `INACTIVE`, produtos distintos |
| Branches Supabase | Uma, `main`, com `project_ref` = o próprio projeto de produção |

### Informação nova e relevante

A branch `main` está com **`status: "MIGRATIONS_FAILED"`**.

O sistema de branching do Supabase tentou replicar este repositório sobre um banco limpo e o replay das migrations falhou. Isso é confirmação independente do **CH-C10**: o histórico não apenas diverge de produção, ele nem aplica até o fim.

**Consequência prática:** montar staging via `supabase branches create` provavelmente falhará pelo mesmo motivo. O caminho é diagnosticar a falha do replay primeiro. A migration `20260904100400` (CH-C10) endereça uma causa conhecida — a dupla constraint de status — mas pode não ser a única.

### Correção de método no roteiro de reprodução

O roteiro pedido descrevia a chamada anônima como "sem nenhum header de autenticação". **Isso testaria a coisa errada.** O gateway do Supabase rejeita qualquer requisição sem `apikey` com `401 {"message":"No API key found in request"}`, antes de o PostgREST avaliar permissão de função. O resultado seria idêntico antes e depois da migration, produzindo um falso positivo de correção.

A reprodução fiel do papel `anon` é: **enviar a chave publishable no header `apikey` e nenhum `Authorization`.** É exatamente o que o navegador de um visitante deslogado envia, e é o que faz o PostgREST assumir o papel `anon`.

Os roteiros abaixo usam esse formato. Base: `https://kcxwealimsfxqstoprdg.supabase.co`. A chave publishable é a mesma já exposta no bundle do frontend (`VITE_SUPABASE_ANON_KEY` no painel da Vercel) — não é segredo, mas não a versionei aqui.

```bash
export ORION_URL="https://kcxwealimsfxqstoprdg.supabase.co"
export ANON_KEY="<VITE_SUPABASE_ANON_KEY>"
export SERVICE_KEY="<service_role key — nunca versionar, nunca usar no navegador>"
```

---

## Tabela geral

| Migration | Achado | Roteiro | Quem executa |
|---|---|---|---|
| `20260904095000` | CH-C15 (P0) | §1 | Você — precisa de staging que não existe |
| `20260904095000` | CH-C16 | §2 | Você — mesma migration |
| `20260904095100` | CH-C17 | §3 | Você |
| `20260904100000` | CH-C12 | §4 | Você |
| `20260904100100` | CH-C07 | §5 | **Precisa de 2 tenants e 2 usuários** — QA com contas de teste |
| `20260904100200` | CH-C04 | §6 | **Precisa de conta `customer` real** — QA |
| `20260904100300` | CH-C06 | §7 | **Precisa de conta `customer` + conta equipe interna** — QA |
| `20260904100400` | CH-C10 | §8 | Você — banco local/efêmero, não toca produção |
| `20260904100500` | CH-C11 | §9 | Você — só observável após escrita real em `tickets` |

Nenhum roteiro exige alteração de código.

---

## §1 — CH-C15 (P0): dump anônimo de chamados

### Antes da migration

```bash
curl -s -w '\n[HTTP %{http_code}]\n' \
  -X POST "$ORION_URL/rest/v1/rpc/get_reports_tickets" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_mode":"all","p_start_date":"2000-01-01T00:00:00Z","p_end_date":"2100-01-01T00:00:00Z"}'
```

Note a ausência deliberada de `Authorization` e a omissão de `p_company_id`.

**Esperado antes:** `HTTP 200` com um array de chamados. A confirmação do achado é encontrar **mais de um `company_id` distinto** na resposta:

```bash
# ... | jq '[.[].company_id] | unique | length'   # > 1 confirma cross-tenant
```

Ressalva: `public.tickets` tem 5 linhas hoje. Se todas pertencerem à mesma empresa, o resultado será `1` e **isso não refuta o achado** — a ausência do filtro está no corpo da função, não no dado. Nesse caso, a confirmação alternativa é comparar a contagem retornada com o `count(*)` total da tabela: se forem iguais, não houve filtro de tenant.

### Depois da migration

Mesma requisição, exatamente.

**Esperado depois:** `HTTP 404` com corpo do PostgREST semelhante a:

```json
{"code":"PGRST202","message":"Could not find the function public.get_reports_tickets(...) in the schema cache"}
```

**Atenção ao interpretar.** O PostgREST responde `404 PGRST202` (função não encontrada no schema cache), não `403`, quando o papel perde `EXECUTE` — ele deixa de enxergar a função. Um `42501` só apareceria em chamada direta ao Postgres. Em qualquer dos dois casos, o critério é: **não pode ser `200` com lista vazia.** Lista vazia significaria que o filtro pegou, não que o acesso foi revogado — exatamente a distinção pedida.

### Controle: `service_role` continua funcionando

```bash
curl -s -w '\n[HTTP %{http_code}]\n' \
  -X POST "$ORION_URL/rest/v1/rpc/get_reports_tickets" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_mode":"all","p_start_date":"2000-01-01T00:00:00Z","p_end_date":"2100-01-01T00:00:00Z"}'
```

**Esperado:** `HTTP 200` com dados. Confirma que a função não foi removida, só o acesso de `anon`/`authenticated`.

### Verificação no catálogo

```sql
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS svc_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_reports_tickets';
```

**Antes:** `t / t / t` · **Depois:** `f / f / t`

---

## §2 — CH-C16: métricas agregadas de todos os tenants

Mesma migration do §1.

```bash
for FN in get_reports_active_in_period get_reports_created_in_period; do
  echo "--- $FN ---"
  curl -s -w '\n[HTTP %{http_code}]\n' \
    -X POST "$ORION_URL/rest/v1/rpc/$FN" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d '{"p_start_date":"2000-01-01T00:00:00Z","p_end_date":"2100-01-01T00:00:00Z"}'
done
```

**Antes:** `HTTP 200` com json contendo `total`, `abertos`, `resolvidos`, `cancelados`, `sla_estourado`, `tempo_medio_horas` — agregando **todos os tenants**, porque `p_company_id` omitido vira `NULL` e desliga o filtro.

Para provar que é cross-tenant: compare o `total` retornado com o total de uma empresa só, passando `p_company_id`. Se o primeiro for maior, o agregado atravessa tenants.

**Depois:** `HTTP 404 PGRST202` nas duas.

---

## §3 — CH-C17: limpeza de auditoria sem autenticação

**Este roteiro apaga dados.** Executar somente em ambiente descartável, nunca em produção — nem no "antes".

```bash
curl -s -w '\n[HTTP %{http_code}]\n' \
  -X POST "$ORION_URL/rest/v1/rpc/cleanup_audit_logs" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{}'
```

**Antes:** `HTTP 204`. Confirmação sem destruir nada em produção — apenas o catálogo:

```sql
SELECT has_function_privilege('anon', 'public.cleanup_audit_logs()', 'EXECUTE');  -- true = achado confirmado
```

**Depois:** `HTTP 404 PGRST202`, e a query acima retorna `false`.

**Controle do cron:** `has_function_privilege('postgres', 'public.cleanup_audit_logs()', 'EXECUTE')` deve continuar `true`. O job 2 (`cleanup-old-logs-daily`, `0 3 * * *`) roda como `postgres`.

---

## §4 — CH-C12: três RPCs de escrita sem autenticação

**Também escrevem.** Só em ambiente descartável.

```bash
for FN in auto_close_resolved_tickets update_all_tickets_sla_status; do
  echo "--- $FN ---"
  curl -s -w '\n[HTTP %{http_code}]\n' -X POST "$ORION_URL/rest/v1/rpc/$FN" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{}'
done

curl -s -w '\n[HTTP %{http_code}]\n' \
  -X POST "$ORION_URL/rest/v1/rpc/fn_auto_assign_ticket" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_ticket_id":"<uuid de um chamado sem responsável>"}'
```

**Antes:** `200` com um inteiro (contagem de linhas afetadas) para as duas primeiras; `204` para a terceira. **Depois:** `404 PGRST202` nas três.

Verificação sem escrever, válida também em produção:

```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('auto_close_resolved_tickets','update_all_tickets_sla_status','fn_auto_assign_ticket');
```

**Antes:** 4 linhas com `anon_exec = true` · **Depois:** as 4 com `false`.

**Controle do cron:** jobs 1 e 6 rodam como `postgres`. Depois de aplicar, confirmar na execução seguinte que `cron.job_run_details` registra sucesso.

---

## §5 — CH-C07: `ticket_ratings` entre tenants

**Precisa de duas empresas e dois usuários.** Não é executável só com curl e chave anônima.

### Pré-requisitos

| Item | Descrição |
|---|---|
| Empresa A, Empresa B | Duas linhas em `companies`, ambas com `is_master = false` |
| Usuário T-A | Papel `technician`, `profiles.company_id` = Empresa A |
| Chamado B-1 | Chamado da Empresa B |
| Avaliação B-1 | Uma linha em `ticket_ratings` para B-1, com `comment` reconhecível |

**Importante:** T-A não pode ser de empresa `is_master`, senão `is_equipe_interna()` devolve `true` e o acesso global é o comportamento correto e esperado.

### Execução

Autenticar como T-A, obter o access token, e:

```bash
curl -s -w '\n[HTTP %{http_code}]\n' \
  "$ORION_URL/rest/v1/ticket_ratings?select=id,ticket_id,rating,comment" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_T_A"
```

**Antes:** `200` com a avaliação de B-1 presente — o achado.
**Depois:** `200` com array que **não** contém B-1.

### Regressão a não perder

- T-A **continua** vendo avaliações de chamados da Empresa A.
- Um `developer` ou admin de empresa master continua vendo tudo.

### Defeito conhecido que este roteiro vai expor

O **dono do chamado continua sem SELECT** — não há policy para ele, antes nem depois. `useTicketRating` sempre volta vazio para o cliente, que é a causa de `UX-020` (formulário de avaliação exibido para sempre). Está fora do escopo desta migration, deliberadamente. Se aparecer no teste, **não é regressão.**

---

## §6 — CH-C04: mass assignment na reabertura

**Precisa de conta `customer` real.**

### Pré-requisitos

Chamado C-1 com `user_id` = o cliente, `status` em `('closed','resolved')`. Anote antes: `company_id`, `priority`, `assigned_to`, `assigned_to_user_id`.

### Ataque

```bash
curl -s -w '\n[HTTP %{http_code}]\n' \
  -X PATCH "$ORION_URL/rest/v1/tickets?id=eq.<uuid C-1>" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_CLIENTE" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"status":"reopened","priority":"urgent","company_id":"<uuid de OUTRA empresa>"}'
```

**Antes:** `200`, e o corpo retornado mostra `priority = "urgent"` e o `company_id` trocado — achado confirmado.

**Depois:** `200` com `status = "reopened"`, mas `priority` e `company_id` **iguais aos originais**. O trigger restaura em silêncio, não levanta erro — decisão deliberada, para não quebrar a reabertura pela interface, que reenvia o registro inteiro.

Use `Prefer: return=representation` — sem ele o PostgREST devolve `204` e não dá para inspecionar o resultado.

### Regressão obrigatória

1. **Reabertura legítima pela interface** — abrir C-1 na aplicação, clicar em reabrir, confirmar que o status vira `reopened` normalmente.
2. **Equipe interna não foi afetada** — como técnico, alterar `priority` de um chamado da própria empresa e confirmar que a alteração persiste. Se não persistir, a isenção `is_equipe_interna()` está errada.
3. **Ordem dos triggers** — o SLA precisa ser recalculado a partir da prioridade **original**:

```sql
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.tickets'::regclass AND NOT tgisinternal
  AND (tgtype::int & 2) = 2 AND (tgtype::int & 16) = 16
ORDER BY tgname;
```

`aa_enforce_customer_ticket_immutability` deve aparecer **primeiro**.

---

## §7 — CH-C06: comentário reapontado

**Precisa de conta `customer` e de conta de equipe interna.**

### Pré-requisitos

Chamado C-1 do cliente e chamado X-1 de outro tenant (anote o UUID). Como cliente, postar um comentário em C-1 — a janela de edição é de **15 minutos**, então o teste tem prazo.

### Ataque

```bash
curl -s -w '\n[HTTP %{http_code}]\n' \
  -X PATCH "$ORION_URL/rest/v1/ticket_updates?id=eq.<uuid do comentário>" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_CLIENTE" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"ticket_id":"<uuid X-1>"}'
```

**Antes:** `200` e o comentário passa a pertencer a X-1 — achado confirmado.

**Depois:** erro com `code` `42501` e mensagem `ticket_id de um comentário não pode ser alterado (comentário ..., chamado ... -> ...)`. Aqui a mensagem é explícita, diferente do §6 — o trigger levanta exceção em vez de restaurar.

### Regressão crítica

**O merge de chamados precisa continuar funcionando.** `fn_merge_tickets` e `merge_user_data` movem `ticket_updates` entre chamados legitimamente, e a isenção depende de `is_equipe_interna()`.

1. Como equipe interna, executar um merge real pela interface (`MergeTicketDialog`) e confirmar que os comentários migram.
2. **Se quem opera merge aí não for equipe interna** — por exemplo um admin de empresa comum — o merge vai quebrar. Este é o ponto de decisão sinalizado na revisão: confirme o papel de quem opera merge antes de aplicar.

Edição legítima de comentário (corrigir o texto dentro dos 15 min, sem mexer em `ticket_id`) deve continuar funcionando.

---

## §8 — CH-C10: reconstrução do schema do zero

Não toca produção nem staging. Roda em banco local ou efêmero.

```bash
supabase start                      # Postgres local
supabase db reset                   # replica TODAS as migrations do repositório
```

### Antes da migration `20260904100400`

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.tickets'::regclass AND contype = 'c' AND conname LIKE '%status%';
```

**Esperado antes:** **duas** linhas — `tickets_status_valid` com 4 valores e `tickets_status_check` com 8. É a interseção que quebra o ciclo de vida.

Prova funcional:

```sql
INSERT INTO public.tickets (title, description, status, priority, category, user_id, company_id, requester_name)
VALUES ('teste ch-c10', 'descricao com mais de dez caracteres', 'awaiting-customer',
        'medium', 'outros', '<uuid>', '<uuid>', 'QA');
```

**Esperado antes:** falha com violação de `tickets_status_valid`.
**Esperado depois:** uma única constraint com os 8 valores, e o INSERT passa. Repetir para `awaiting-third-party`, `reopened` e `cancelled`.

### Observação que provavelmente vai aparecer primeiro

A branch Supabase `main` está em `MIGRATIONS_FAILED`, então **`supabase db reset` pode falhar antes de chegar nesse ponto**. Se isso acontecer, o erro do replay é informação mais valiosa que o teste em si — é o diagnóstico do CH-C10 na origem. Registre a saída completa.

---

## §9 — CH-C11: trigger de auditoria duplicado

### Antes

```sql
SELECT c.relname AS tabela, t.tgname
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal AND p.proname='audit_trigger_function'
ORDER BY 1, 2;
```

**Esperado antes:** duas linhas para `tickets` (`audit_tickets_changes` e `audit_tickets_trigger`).
**Esperado depois:** uma só, `audit_tickets_changes`.

### Prova funcional — exige escrita real

Só é observável depois de uma mutação em `tickets`.

```sql
-- 1. contagem antes
SELECT count(*) FROM public.audit_log
WHERE table_name = 'tickets' AND record_id = '<uuid do chamado de teste>';

-- 2. gerar uma escrita: alterar o chamado pela interface (ex.: trocar prioridade)

-- 3. contagem depois
SELECT count(*) FROM public.audit_log
WHERE table_name = 'tickets' AND record_id = '<uuid do chamado de teste>';
```

**Antes da migration:** o delta é **2** por escrita.
**Depois:** o delta é **1**.

Panorama do passivo já acumulado (somente leitura, seguro em produção):

```sql
SELECT count(*) AS grupos_duplicados FROM (
  SELECT record_id, action, changed_at
  FROM public.audit_log WHERE table_name = 'tickets'
  GROUP BY 1,2,3 HAVING count(*) > 1
) d;
```

Medido durante a auditoria: 720 mutações geraram 1.484 linhas — fator 2,06, com 764 redundantes. A migration **não** remove o passivo; limpeza retroativa é decisão separada.

---

## Decisões de produto — nada implementado

Nenhuma das duas virou código ou migration, conforme instruído.

### FP-001 / CH-C10 #2 — realtime morto

**Informação nova desta etapa:** a branch `main` em `MIGRATIONS_FAILED` reforça que a divergência entre repositório e produção é sistêmica, não pontual. Isso desloca um pouco a pergunta: mesmo que a remoção de `tickets` e `ticket_updates` da publicação tenha sido deliberada, ela integra um padrão de mudanças aplicadas fora do histórico — e é esse padrão que precisa de decisão, não só o caso do realtime.

Nada além disso mudou. As duas opções seguem de pé: restaurar a publicação, ou remover o código cliente de realtime.

### CH-A01 — `remote_password`

Nenhuma informação nova nesta etapa. As duas opções seguem incompatíveis entre si: remover o campo do formulário, ou construir o caminho de leitura autorizado.
