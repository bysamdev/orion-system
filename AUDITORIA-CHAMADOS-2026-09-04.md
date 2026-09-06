# Orion — Auditoria do Módulo de Chamados

Data: 2026-09-04 · Escopo: módulo de chamados ponta a ponta (React/TS, Go `orion-api`, Supabase/Postgres, Edge Functions, Orion Agent)

Nenhum código de produção foi alterado. Nenhuma migration foi aplicada. `git status` ao final da auditoria mostra apenas arquivos novos: 8 migrations `.sql` e 2 `.md`.

---

## 1. Resumo executivo

O módulo de chamados **funciona**, mas não está pronto para produção sem as correções preparadas. O quadro geral tem três eixos.

**Segurança.** Um achado P0 e cinco P1. O P0 é `public.get_reports_tickets`, uma função `SECURITY DEFINER` executável **sem autenticação** que devolve `SETOF tickets` de todos os tenants. Os P1 restantes são da mesma família — funções privilegiadas expostas ao papel `anon` — mais duas policies RLS que permitem ao cliente alterar colunas que não deveria e mover comentários entre chamados, e uma tabela (`ticket_ratings`) sem escopo de empresa.

**Divergência entre o repositório e a produção.** Este é o achado estrutural mais importante e apareceu **três vezes de forma independente**: a constraint de status, a publicação de realtime, e a própria existência de `get_reports_tickets`. O banco de produção foi editado fora do histórico de migrations em pelo menos três ocasiões. A consequência prática é que **reconstruir o ambiente a partir do repositório não reproduz produção** — staging, DR e máquinas novas nascem diferentes, em um caso com o ciclo de vida do chamado quebrado.

**Realtime.** O realtime do módulo está morto em produção. `tickets` e `ticket_updates` não estão na publicação `supabase_realtime`, embora as migrations mandem adicioná-las e nenhuma migration as remova. O que mantém a interface atualizada é o refetch de 120 s.

Sobre os riscos que motivaram a auditoria: **não há vazamento cross-tenant pela interface**. As leituras do frontend passam por `supabase-js` e o RLS as contém corretamente. Os vazamentos confirmados estão em caminhos que não passam pela interface — RPCs expostas ao PostgREST e uma policy sem escopo em `ticket_ratings`.

**Readiness:** não recomendo considerar o módulo pronto para produção enquanto CH-C15 não for corrigido. É a única correção que classifico como urgente; as demais podem seguir o ritmo normal de revisão.

---

## 2. Baseline

| Check | Antes | Depois |
|---|---:|---:|
| Frontend (vitest) | 66/66 PASS | 66/66 PASS |
| Backend Go `orion-api` | `handler` ok, `lib` ok | `handler` ok, `lib` ok |
| Agent Go `orion-agent` | 10 pacotes ok, 1 FAIL | 10 pacotes ok, 1 FAIL |
| Typecheck | PASS | PASS |
| Build | PASS | PASS |
| Lint | FAIL (207 erros, 18 warnings) | FAIL (207 erros, 18 warnings) |

Sem regressão. As duas falhas são anteriores à auditoria:

- `orion-agent/shortcut` → `TestCriarAtalhoEm_ApontaParaOIconeRealDoOrion`: `gravarIconeOrion` está fixado em `C:\Orion`, caminho inexistente em máquina de desenvolvimento. Sem relação com chamados.
- Lint: 207 erros pré-existentes em todo o repositório, majoritariamente `@typescript-eslint/no-explicit-any` nas Edge Functions.

**Ressalva sobre o número 66/66.** Ele superestima a cobertura. Dos 66 testes verdes, **9 não referenciam nenhum código de produção**, e 4 dos 5 testes rotulados como "lifecycle de realtime" nunca importam o hook — asseguram o próprio mock. Não existe suíte e2e apesar de `playwright` estar em `devDependencies`, e não há `.github/`, portanto nada roda em CI.

`node_modules` estava ausente no início; foi instalado com `npm ci` para obter o baseline.

---

## 3. Tabela geral de achados

### P0

| ID | Área | Status | Descrição |
|---|---|---|---|
| CH-C15 | Segurança | CONFIRMED | `get_reports_tickets` devolve `SETOF tickets` de todos os tenants sem autenticação |

### P1

| ID | Área | Status | Descrição |
|---|---|---|---|
| CH-C12 | Segurança | CONFIRMED | 3 RPCs de escrita em `tickets` executáveis por `anon` |
| CH-C16 | Segurança | CONFIRMED | 2 RPCs de relatório expõem métricas de todos os tenants a `anon` |
| CH-C04 | RBAC | CONFIRMED | Cliente altera `company_id`, `priority` e `assigned_to` no UPDATE de reabertura |
| CH-C06 | RBAC | CONFIRMED | Autor reaponta comentário para qualquer `ticket_id` em 15 min |
| CH-C07 | RBAC | CONFIRMED | `ticket_ratings` legível por técnico de qualquer empresa |
| CH-A02 | Funcional | CONFIRMED | `useTickets`/`useTicket` servem mock sob `build:dev` |
| FP-001 | Performance | CONFIRMED | Realtime de chamados morto: tabelas fora da publicação |
| FP-002 | Performance | CONFIRMED | Gatilho de auditoria duplicado: 2,06x linhas em `audit_log` |
| FP-004 | Performance | CONFIRMED | 24 índices sobre heap de 8 kB; planejamento até 38x a execução |
| FP-005 | Performance | CONFIRMED | 7 índices de `tickets` com `idx_scan = 0` |
| UX-004 | UX | CONFIRMED | Insert de anexo sem checar erro: anexo some sem aviso |
| UX-010 | UX | CONFIRMED | `ResolutionDialog` limpa `notes` antes do `await`; falha perde a resolução |
| UX-016 | UX | CONFIRMED | Rollback da reabertura bloqueado pela própria policy; mensagem mente |
| UX-018 | UX | CONFIRMED | `/avaliacao/:id` deslogado mostra "Chamado não encontrado" |
| UX-020 | UX | CONFIRMED | Cliente vê o formulário de avaliação para sempre |
| UX-023 | UX | CONFIRMED | Rollback sem trava de concorrência → lost update |
| UX-024 | UX | CONFIRMED | Rollback restaura `assigned_to` e não `assigned_to_user_id` |
| UX-025 | UX | CONFIRMED | Rollback não falha em voz alta: `update()` sem `.select()` |
| UX-026 | UX | CONFIRMED | Timeline não atualiza sozinha (zero realtime em `ticket_updates`) |

### P2

| ID | Área | Status | Descrição |
|---|---|---|---|
| CH-C10 | Infra | CONFIRMED | Migrations do repositório não reproduzem o schema de produção |
| CH-C11 | Infra | CONFIRMED | Gatilho de auditoria duplicado em `tickets` |
| CH-C17 | Segurança | CONFIRMED | `cleanup_audit_logs` apaga `audit_log` e `notifications` sem autenticação |
| CH-C01 | RBAC | CONFIRMED | Go e RLS divergem sobre escopo de `technician`, sem teste de paridade |
| CH-A01 / DC-001 | Dívida | CONFIRMED | `remote_password` coletado, criptografado e nunca lido |
| CH-A04 / DC-016 | Dados | CONFIRMED | `category` sem constraint, 6 vocabulários incompatíveis |
| CH-A05 | Dados | CONFIRMED | `'open'` expande para 4 status em um hook e 2 em outro |
| CH-A06 | Funcional | CONFIRMED | Chave de invalidação `ticketUpdates` vs `ticket-updates` |
| CH-A07 | Robustez | CONFIRMED | Validação de upload ausente em 2 dos 3 caminhos |
| CH-A08 | Dados | CONFIRMED | Seletor de técnico sem filtro de empresa, exclui `developer` |
| CH-E01 | Testes | CONFIRMED | 9 de 66 testes não exercitam produção; realtime testa o próprio mock |
| DC-002 | Dívida | CONFIRMED | Papel `gestor` fora do enum; 8 checagens mortas em Go |
| DC-003 | Dívida | CONFIRMED | `fn_auto_assign_ticket` sem nenhum chamador |
| DC-005 | Dívida | CONFIRMED | Full-text search construído e nunca usado |
| DC-006 | Testes | CONFIRMED | 9 testes vestigiais, 165 linhas |
| DC-009 | Dívida | CONFIRMED | 6 colunas mortas em `tickets` |
| DC-013 | Dívida | LIKELY | `/avaliacao/:id` órfã: zero navegação, zero link |
| DC-015 | Dívida | CONFIRMED | Caminho real de query nunca roda em desenvolvimento |
| FP-007 | Performance | CONFIRMED | `metadata->>` não usa o GIN `jsonb_ops` |
| FP-008..FP-018 | Performance | CONFIRMED | `select('*')`, N+1, waterfalls, invalidação excessiva |
| UX-005..UX-032 | UX | CONFIRMED | Anexo órfão, submit mudo, rascunho perdido, estados de erro |

### P3

`CH-C05` (INSERT sem `company_id`, mitigado por trigger), `CH-C14` (oráculos anônimos `get_ticket_company_id` e `ticket_belongs_to_user_company`), `CH-A03` (rota `/avaliacao/:id` sem guard), `DC-004`, `DC-007`, `DC-008`, `DC-011`, `DC-012`, `DC-014`, `DC-017`, `DC-018`, `FP-019`..`FP-023`, `UX-002`, `UX-009`, `UX-012`, `UX-015`, `UX-017`, `UX-021`, `UX-022`, `UX-028`, `UX-031`, `UX-033`.

### Descartados

| ID | Status | Por quê |
|---|---|---|
| CH-C02 | FALSE POSITIVE | A dupla CHECK de status existe no histórico de migrations, **não** em produção |
| CH-C13 | FALSE POSITIVE | `search_tickets` tem filtro interno de tenant; devolve zero linhas para `anon` |
| CH-A03 | Rebaixado a P3 | `anon` não lê `tickets`: todo ramo da policy colapsa com `auth.uid()` nulo |
| CH-C05 | Mitigado | `trigger_set_ticket_company` sobrescreve `company_id` no INSERT |
| CH-D01 | N/A | O Orion Agent não participa do fluxo de chamados |

---

## 4. Detalhamento dos principais problemas

### CH-C15 — Dump de chamados de todos os tenants sem autenticação

**Severidade:** P0 · **Status:** CONFIRMED · **Migration:** `20260904095000`

**Causa raiz.** `public.get_reports_tickets` é `SECURITY DEFINER` com owner `postgres`, portanto executa sem RLS. O corpo é um `SELECT * FROM tickets` com filtros opcionais e **nenhuma checagem de identidade**. O parâmetro `p_company_id` tem `DEFAULT NULL`, e a cláusula `(p_company_id IS NULL OR company_id = p_company_id)` transforma o `NULL` em "sem filtro". A função tem `EXECUTE` concedido a `anon`.

**Impacto.** `POST /rest/v1/rpc/get_reports_tickets` sem token, com intervalo de datas amplo e sem `p_company_id`, devolve todas as colunas de todos os chamados de todos os tenants: título, descrição, `requester_name`, `company_id`, `remote_id`.

**Evidência.**

```
prosecdef = true · owner = postgres
has_function_privilege('anon', oid, 'EXECUTE') = true
RETURNS SETOF tickets
corpo: SELECT * FROM tickets WHERE (...) AND (p_company_id IS NULL OR company_id = p_company_id)
```

A função **não existe em nenhuma migration deste repositório** — `grep -rn "get_reports_tickets" supabase/migrations` retorna vazio.

**Alcance real hoje.** `public.tickets` tem **5 linhas**. O volume exposto neste momento é mínimo. A severidade é estrutural: é um endpoint de dump anônimo ativo, cujo alcance cresce com a base.

**Por que não foi reproduzido ao vivo.** Executar a função via MCP a executaria como `service_role`, o que não demonstraria o caminho anônimo. A prova é a cadeia: `anon` tem EXECUTE, é `SECURITY DEFINER` com owner privilegiado, e o corpo não tem checagem. O contraste com `search_tickets` — mesma exposição, mas **com** filtro interno — confirma que a diferença é a ausência do filtro, não a exposição em si.

**Correção preparada.** `REVOKE EXECUTE ... FROM anon, authenticated`. Não altera nem remove a função, porque ela não está versionada e pode ter consumidor externo não mapeado.

---

### CH-C12 / CH-C16 / CH-C17 — Funções privilegiadas expostas ao PostgREST

**Severidade:** P1 / P1 / P2 · **Status:** CONFIRMED · **Migrations:** `20260904100000`, `20260904095000`, `20260904095100`

Mesma raiz do CH-C15: funções `SECURITY DEFINER` com owner `postgres`, sem checagem interna, com `EXECUTE` para `anon`.

| Função | O que faz | Severidade |
|---|---|---|
| `auto_close_resolved_tickets()` | `UPDATE tickets SET status='closed'` em todos os tenants | P1 |
| `update_all_tickets_sla_status()` | `UPDATE tickets SET sla_status` + `INSERT INTO notifications` | P1 |
| `fn_auto_assign_ticket(uuid)` | Atribui qualquer chamado por UUID | P1 |
| `get_reports_active_in_period(...)` | Métricas agregadas de todos os tenants | P1 |
| `get_reports_created_in_period(...)` | Idem | P1 |
| `cleanup_audit_logs()` | `DELETE` em `audit_log` e `notifications` | P2 |

**Contenção honesta.** As de escrita executam apenas o que o cron faria; chamadas repetidas afetam zero linhas. As de relatório vazam métricas de negócio (total, abertos, SLA estourado, tempo médio) e não conteúdo. `cleanup_audit_logs` apaga só o que já passou da janela de retenção. O defeito é a **ausência do controle**, não destruição arbitrária.

**Dependência de cron verificada antes de revogar.** Os jobs 1, 2 e 6 rodam como `username=postgres`, que é o owner e mantém `EXECUTE`. O revoke não afeta o agendamento. `fn_auto_assign_ticket` não tem chamador algum.

---

### CH-C04 — Mass assignment do cliente na reabertura

**Severidade:** P1 · **Status:** CONFIRMED · **Migration:** `20260904100200`

**Causa raiz.** A policy `"Customers can reopen own tickets"` tem `WITH CHECK ((user_id = auth.uid()) AND (status = 'reopened'))`. Restringe duas colunas; as demais ficam livres.

**Verificação adversarial.** Descartei mitigação por trigger antes de confirmar: `set_ticket_company_from_user` re-deriva `company_id`, mas é **BEFORE INSERT apenas**; `validate_ticket_fields` só valida o conjunto de valores, não quem altera; `validate_ticket_assignment` resolve o técnico por nome **sem predicado de empresa**.

**Impacto.** Em um único UPDATE que também define `status='reopened'`, o cliente pode mover o chamado para outro tenant, elevar a prioridade (disparando recálculo de SLA) e atribuí-lo a qualquer técnico de qualquer empresa.

**Não alcançável pela interface** — exige chamada direta ao PostgREST com o JWT do próprio usuário. O banco é o único controle e não restringe essas colunas.

**Nota de implementação.** Foi pedido apertar o `WITH CHECK` comparando com `OLD`. **Isso não é implementável**: uma policy RLS não enxerga `OLD` — `USING` avalia a linha antiga, `WITH CHECK` a nova, sem sintaxe para relacioná-las. A correção é um trigger `BEFORE UPDATE`, único lugar onde as duas coexistem. A policy foi deixada intacta.

---

### CH-C06 — Comentário reapontado para qualquer chamado

**Severidade:** P1 · **Status:** CONFIRMED · **Migration:** `20260904100300`

`"Authors can edit recent updates"` tem `WITH CHECK` nulo, então o Postgres reutiliza o `USING`, e nenhum dos dois restringe `ticket_id`. Em até 15 minutos o autor move o próprio comentário para qualquer UUID da plataforma.

**Encadeamento.** `GET /api/tickets/resolve/{id}` entrega a qualquer técnico o UUID de chamado de outro tenant (consequência do CH-C01), que é exatamente a entrada necessária.

**Isenção necessária.** `fn_merge_tickets` e `merge_user_data` movem `ticket_updates` entre chamados legitimamente — confirmado em `pg_proc.prosrc`. Um travamento cego quebraria o merge. A regra isenta equipe interna e sessões sem `auth.uid()`.

---

### CH-C07 — `ticket_ratings` sem escopo de empresa

**Severidade:** P1 · **Status:** CONFIRMED · **Migration:** `20260904100100`

A policy de SELECT verificava apenas se o usuário tem papel `technician`/`admin`/`developer`, sem nenhum predicado de empresa e sem join de volta em `tickets`. Qualquer técnico de qualquer empresa lê `rating`, `comment` (texto livre do cliente) e `user_id` de todos os tenants.

Todas as demais tabelas do domínio escopam com `ticket_belongs_to_user_company()` ou `get_ticket_company_id()`. Esta ficou de fora.

**Defeito funcional adjacente, não corrigido.** Não existe policy de SELECT para o **dono** do chamado. O cliente não consegue reler a própria avaliação, e `useTicketRating` é usado por `Avaliacao.tsx` justamente para detectar avaliação já enviada — sempre volta vazio. Isso produz `UX-020`: o cliente vê o formulário para sempre e o reenvio falha depois de já ter dado certo. Não foi corrigido para manter a migration restrita ao achado de segurança.

---

### CH-C10 e FP-001 — Produção divergiu do repositório, três vezes

**Severidade:** P2 e P1 · **Status:** CONFIRMED · **Migration:** `20260904100400` (parcial)

Três divergências independentes, encontradas por caminhos distintos:

| # | Objeto | Repositório | Produção |
|---|---|---|---|
| 1 | Constraint de status | `tickets_status_valid` (4 valores) **e** `tickets_status_check` (8) | Uma só, `tickets_status_valid`, com 8 |
| 2 | Publicação realtime | `tickets` e `ticket_updates` adicionadas em `20251020210807:35-36`, nunca removidas | Nenhuma das duas; só `audit_log` |
| 3 | `get_reports_tickets` | Não existe | Existe |

**Consequência da #1.** O Postgres aplica `AND` entre todas as CHECK da mesma coluna. Um banco reconstruído a partir do repositório teria como conjunto efetivo a interseção — 4 valores — rejeitando `awaiting-customer`, `awaiting-third-party`, `reopened` e `cancelled`. Produção funciona; staging, DR e máquinas de dev novas nascem com pausa de SLA, reabertura e cancelamento quebrados. O sintoma nunca aparece onde se olha.

**Consequência da #2.** O realtime do módulo está morto. `useRealtimeTickets` abre canal assinando `postgres_changes` em `public.tickets` e não recebe evento algum. O refetch de 120 s é o que mantém a tela atualizada — e `UX-026` registra que a timeline, que não tem refetch equivalente, simplesmente não atualiza sozinha.

**Pergunta aberta que só a equipe responde:** a remoção da publicação foi deliberada (corte de egress — `machines` recebeu o mesmo tratamento, mas **com** migration, em `20260902190000` / commit `9fbcbbf`) ou acidental? Se deliberada, o código cliente de realtime é peso morto a remover. Se acidental, a atualização ao vivo regrediu em silêncio.

**A migration preparada cobre apenas a #1.** As #2 e #3 exigem decisão antes de qualquer SQL.

---

### CH-C01 — Go e RLS discordam, sem teste de paridade

**Severidade:** P2 · **Status:** CONFIRMED · **Sem migration — é dívida técnica**

`lib/db.go:159` define `Global() { return s.Role != "customer" }`: todo papel diferente de `customer` enxerga todas as empresas. O RLS restringe `technician`/`admin` de empresa não-master à própria empresa, liberando cross-tenant só via `is_master_company_user()` (hoje `companies.is_master = true OR role = 'developer'`).

**Retratação registrada.** Em uma etapa intermediária afirmei que a concessão cross-tenant vinha de `ILIKE` no nome da empresa. Estava errado: eu havia lido a penúltima das cinco definições da função. A versão atual (`20260825012251:176-190`) usa a coluna booleana `is_master`. A correção por nome **foi** aplicada ao banco, uma migration depois da correção equivalente no Go.

**O que resta.** Dois modelos de autorização mantidos em sincronia manualmente. `lib/scope_test.go` fixa o comportamento MSP-global como correto, então estruturalmente **não consegue** detectar uma divergência. Exposição prática limitada: o único endpoint Go do domínio é o resolver read-only, que vira oráculo de existência e divulgação de UUID.

**Recomendação:** um teste de paridade que compare a decisão do Go com a da policy para a mesma tupla (papel, empresa, chamado).

---

### CH-A02 — Mock servido por um script de build publicável

**Severidade:** P1 · **Status:** CONFIRMED · **Sem migration — é código de aplicação**

`useTickets.ts:70` e `:117` retornam `src/mocks/tickets.ts` sob `import.meta.env.DEV`. O `package.json` define `"build:dev": "vite build --mode development"` — um build **publicável** onde `DEV` é verdadeiro. Um deploy feito com ele serve chamados inventados parecendo funcional.

Efeito colateral: `useTicketUpdates` não tem esse gate, então em desenvolvimento a timeline é real e o chamado é falso. E o caminho real de query nunca roda em desenvolvimento (`DC-015`), o que torna vazio qualquer teste futuro de busca de chamados que não neutralize a variável.

---

### UX-023/024/025 — O rollback compensatório é o mesmo desenho errado, cinco vezes

**Severidade:** P1 · **Status:** CONFIRMED

Não há optimistic update no domínio; as mutations fazem rollback manual quando o insert em `ticket_updates` falha. O padrão se repete em `useTickets.ts:331, 438, 617, 722, 873` e tem três defeitos simultâneos:

- **UX-023:** o rollback não repete a trava de concorrência (`.eq()`) do UPDATE de ida → lost update.
- **UX-024:** restaura `assigned_to` mas não `assigned_to_user_id` → o chamado fica com o nome de um técnico e na fila de outro.
- **UX-025:** usa `update()` sem `.select()`, então zero linhas afetadas retorna 204 e o código conclui que deu certo.

**UX-016** é o caso agudo: na reabertura pelo cliente, o rollback é barrado pela própria policy, afeta zero linhas sem erro, e a interface informa que a operação foi "revertida" quando não foi.

---

## 5. Segurança e RBAC

| Vetor testado | Resultado |
|---|---|
| Cliente lê chamado de outro cliente | **Contido.** `select_tickets` cobre corretamente |
| Cliente altera chamado de outro cliente | **Contido** |
| Cliente altera campos protegidos do próprio chamado | **FALHA — CH-C04** |
| Técnico acessa chamado de outro tenant pela interface | **Contido** pelo RLS |
| Técnico resolve `ticket_number` de outro tenant | **FALHA parcial — CH-C01**, oráculo de existência + UUID |
| Técnico lê avaliações de outro tenant | **FALHA — CH-C07** |
| Injeção de comentário em chamado alheio | **FALHA — CH-C06** |
| Leitura anônima de chamados pela interface | **Contido.** `auth.uid()` nulo colapsa toda a policy |
| Leitura anônima via RPC | **FALHA — CH-C15, CH-C16** |
| Escrita anônima via RPC | **FALHA — CH-C12, CH-C17** |
| Mass assignment no INSERT | **Contido** por `trigger_set_ticket_company` |
| Upload: MIME e tamanho | **Contido no storage** — bucket privado, teto de 10 MiB, allowlist de 11 MIMEs |
| `search_path` mutável em função do domínio | **Nenhuma.** Todos os helpers têm `search_path` explícito |

**Sobre validação no frontend.** Não foi contada como controle em nenhum momento. Todos os vereditos acima vêm do schema, das policies e dos corpos de função lidos em produção.

**Advisors do Supabase:** 129 findings (5 ERROR, 121 WARN, 3 INFO). Nenhum tem como sujeito uma tabela do domínio de chamados. Os 118 findings de `SECURITY DEFINER` executável foram triados manualmente: a maioria é função de trigger, que o Postgres recusa chamar via RPC. O que sobrou virou CH-C12, CH-C15, CH-C16 e CH-C17.

---

## 6. Performance

Medições em produção. **Ressalva que atravessa toda esta seção:** `public.tickets` tem **5 linhas** e heap de **8 kB**. Nesse tamanho, sequential scan é a escolha correta do planejador. O achado não é o scan.

| Métrica | Antes | Depois | Observação |
|---|---:|---:|---|
| `tickets`: linhas / heap / índices | 5 / 8 kB / 480 kB | não alterado | Proporção 60:1 entre índice e dado |
| `tickets`: UPDATEs acumulados | 8.208 | — | Sobre 5 linhas; 4,7% HOT |
| Índices em `tickets` | 24 | não alterado | 7 com `idx_scan = 0` |
| `useMeusTickets`: planning / execution | 5,224 ms / 1,056 ms | não medido | Planejamento custa 5x a execução |
| `useTechnicianStats` #2: planning / execution | 2,516 ms / 0,066 ms | não medido | **38x**; roda 4x a cada 30 s |
| `audit_log`: linhas / tamanho | 14.235 / 16 MB | não alterado | 2,06x inflado pelo gatilho duplicado |
| Auditoria: mutações → linhas | 720 → 1.484 | não alterado | 764 linhas redundantes |
| Bundle eager (antes de qualquer rota) | 746,9 kB raw / 216,4 kB gz | não alterado | vendor-ui 275,8 + vendor-supabase 215,2 + entry 176,8 |
| Chunk `TicketDetails` | 82,9 kB / 23,1 kB gz | não alterado | Puxa 52,15 kB de zod para schema de 2 linhas |
| Chunk `NewTicket` | 70,6 kB / 23,2 kB gz | não alterado | zod + DOMPurify via `validation` |

**Nenhuma coluna "depois" foi medida** porque nenhuma correção de performance foi aplicada — esta auditoria não alterou código nem aplicou migrations. Os valores "não alterado" refletem o estado atual do banco.

**Diagnóstico principal.** O gargalo mensurável não é execução de query, é **custo de planejamento** causado por 24 índices sobre uma tabela minúscula. Comparação isolando a variável: `ticket_updates` (6 índices) consome 189 buffers de planejamento, `notifications` (5 índices) 181, contra 455–583 de `tickets`. **Nenhum índice novo se justifica.** O caminho é remover os 7 nunca usados e as duplicatas (`assigned_to_user_id` ×2, `ticket_number` ×2).

**Único seq scan estrutural:** `lib/monitoring.go:1501` e `:1573` filtram por `metadata->>'machine_id'`, que o índice GIN `jsonb_ops` existente não atende — `idx_scan = 0`. Esse índice precisaria ser `jsonb_path_ops` ou um índice de expressão.

**Outros:** `useTechnicianStats` faz 4 queries sequenciais `select('id')` e conta com `.length`; `enrichTicketsWithCompany` cria waterfall `profiles → companies` em 6 hooks; `TicketDetails` dispara 14 queries com profundidade 3 e busca `companies` duas vezes; anexos fazem N chamadas `createSignedUrl`; até 25 invalidações de query por evento (13 da mutation + 12 do canal) — que hoje nunca disparam, porque o realtime está morto.

**Full-text search:** `search_vector`, índice GIN e trigger são mantidos e pagos a cada escrita, mas a busca da interface usa `ILIKE`. O FTS nunca é exercitado (`idx_scan = 0`).

---

## 7. Código morto

**Nada foi removido.** Esta seção é uma lista para remoção posterior, sob sua revisão.

| Item | Onde | Motivo | Linhas |
|---|---|---|---:|
| 9 testes vestigiais | `src/__tests__/`, `src/lib/__tests__/` | Não referenciam código de produção | 165 |
| Checagens do papel `gestor` | `handler/installer_handlers.go:34`, `grafana_sync_handlers.go:37,91` + teste | `gestor` não existe no enum `app_role` | 8 edições parciais |
| `TicketUUIDByNumber` | `lib/db.go:340` | Sem chamador (e sem filtro de tenant) | ~10 |
| `fn_auto_assign_ticket` (2 variantes) | banco | Sem trigger, cron ou chamador | objeto |
| `fn_auto_route_ticket()` | banco | Substituída por `tr_auto_route_ticket` | objeto |
| `search_tickets` + `search_vector` + trigger + GIN | banco | FTS nunca exercitado | objetos |
| 6 colunas de `tickets` | banco | `service_id`, `custom_fields`, `scheduled_date`, `satisfaction_rating`, `satisfaction_comment`, `category_id` | colunas |
| `audit_tickets_trigger` | banco | Duplicata exata | objeto |
| Índice duplicado `assigned_to_user_id` | banco | Um dos dois com `idx_scan = 0` | objeto |
| `playwright` | `package.json` | Nenhuma suíte e2e | dependência |

**Total contado, não estimado:** **186 linhas CONFIRMED** + 20 objetos de banco. Mais **503 linhas** em NEEDS VERIFICATION. Máximo teórico 689.

**Veredito do fluxo de senha temporária (CH-A01 / DC-001).** Órfão de leitura, confirmado. O ciclo é `usuário digita → trigger criptografa → ninguém lê`. `get_decrypted_remote_password` tem zero chamadores em `src/ api/ handler/ lib/ cmd/ supabase/functions/ scripts/` e é executável apenas por `service_role`, que nenhum código invoca. Duas linhas em produção guardam ciphertext inacessível.

**`remote_id`, ao contrário, tem consumidor legítimo** — exibido e copiável em `TicketDetails.tsx:740-751`. Não remover.

**Falsos positivos evitados.** Os 12 componentes de `src/components/ticket/` e `tickets/`, os 4 hooks suspeitos (`useTicketCopilot`, `useTicketPresence`, `useTimerGuard`, `useKBSuggestions`), `testDataDetection.ts` e `state-tokens.ts` **têm consumidor** — nada ali é morto. `get_ticket_company_id` e `ticket_belongs_to_user_company` são invisíveis ao grep mas usadas em 16 policies RLS.

---

## 8. Migrations preparadas — aguardando aplicação manual

Oito arquivos em `supabase/migrations/`. **Nenhum foi aplicado.** Detalhamento e riscos em [migrations_phase2_pending_review.md](migrations_phase2_pending_review.md).

| Ordem | Arquivo | Achado | Risco de aplicar |
|---|---|---|---|
| 1 | `20260904095000_fix_ch_c15_revoke_anon_on_get_reports_tickets.sql` | CH-C15 (P0) + CH-C16 | Baixo |
| 2 | `20260904095100_fix_ch_c17_revoke_anon_on_cleanup_audit_logs.sql` | CH-C17 | Baixo |
| 3 | `20260904100000_fix_ch_c12_revoke_anon_execute_on_ticket_write_rpcs.sql` | CH-C12 | Baixo |
| 4 | `20260904100100_fix_ch_c07_scope_ticket_ratings_select_by_company.sql` | CH-C07 | Médio-baixo |
| 5 | `20260904100200_fix_ch_c04_lock_customer_reopen_columns.sql` | CH-C04 | **Médio** |
| 6 | `20260904100300_fix_ch_c06_lock_ticket_id_on_update_edit.sql` | CH-C06 | Baixo-médio |
| 7 | `20260904100400_fix_ch_c10_reconcile_ticket_status_constraint.sql` | CH-C10 | Baixo, revalida a tabela |
| 8 | `20260904100500_fix_ch_c11_drop_duplicate_tickets_audit_trigger.sql` | CH-C11 | Baixo |

Cada arquivo traz no rodapé a query de verificação pós-aplicação. Duas exigem teste manual depois de aplicadas: a #5 (fazer uma reabertura real) e a #6 (confirmar quem opera merge de chamados hoje).

**Sem migration, por decisão:** CH-C01 precisa de um teste de paridade Go↔RLS, não de SQL. CH-A01 precisa de decisão de produto — remover o campo `remote_password` do formulário ou construir o caminho de leitura autorizado; as duas saídas são incompatíveis.

---

## 9. Itens pendentes

### Decisão de produto

- **CH-A01** — `remote_password`: remover o campo ou construir leitura autorizada.
- **FP-001 / CH-C10 #2** — a remoção de `tickets` e `ticket_updates` da publicação de realtime foi deliberada ou acidental? Define se o código cliente de realtime é removido ou se a publicação é restaurada.
- **CH-C01** — manter o modelo MSP-global no Go? Se sim, o RLS deveria refleti-lo; se não, o Go deveria escopar.
- **CH-A04 / DC-016** — unificar o vocabulário de `category`. **Esta é a única com janela fechando:** corrigir antes de o RMM abrir chamados em volume, senão vira backfill.

### Verificação manual necessária

- Rodar as 8 migrations em staging e executar as queries de verificação.
- Reabertura real de chamado após a migration #5.
- Confirmar quem opera merge de chamados (migration #6).
- **CH-C15**: identificar o consumidor de `get_reports_tickets` antes de decidir entre corrigir o corpo ou remover a função.
- `DC-013`/`DC-014`: confirmar se `/avaliacao/:id` e os 13 aliases de rota têm entrada externa (e-mail, QR) antes de tratá-los como mortos.

### Fora do escopo

Registrados separadamente por não pertencerem ao domínio de chamados:

- **OOS-07 (ERROR)** — RLS **desabilitada** em `machine_metrics_history_20260902` a `_20260906`. Partições de métricas de máquina.
- **OOS-08** — RLS habilitada sem política em `bridge_secrets`, `egress_diario`, `rate_limit_counters`.
- **OOS-09** — `public.silencio_tolerado` com `search_path` mutável (única função do banco nessa condição).
- **OOS-10** — extensão `pg_net` no schema `public`.
- **OOS-11** — proteção contra senha vazada desabilitada no Auth.
- **OOS-12** — funções anônimas fora do domínio: `cleanup_expired_invite_tokens`, `cleanup_monitoring_history`, `count_company_active_agents`, `check_index_health`, `check_table_bloat`.
- **Orion Agent** — `agent_key` é segredo compartilhado por tenant em `agent.yaml` (0644); token de login de máquina trafega em query string e é gravado no `.url` (0644); identidade de máquina é auto-enrolada sem handshake; `POST /api/monitoring/self-heal-event` sem chamador vivo.
- **Terminal PTY (pendência conhecida (a))** — **fora do escopo, verificado.** `RemoteTerminal.tsx` não tem handler de Escape nem navegação; o Esc é do Radix no `<Sheet>` de `MachineDrawer.tsx:603`. O terminal só é montado em `MachineDrawer` e `Assets.tsx:1032`. `TicketDetails` toca máquina apenas via `TicketAssetContext` (`:1205`), que **não monta o terminal**. Não é alcançável a partir de um chamado.
- **Rotas (pendência conhecida (b))** — **fora do escopo, verificado.** `/sistemas-e-alertas` **não existe**: o alias real é `/sistemas-alertas`, sem o "e" (`App.tsx:146`), então a variante com "e" cai no catch-all e dá 404. `/inventario` **existe** e redireciona para `/ativos` (`App.tsx:155`). São rotas de infraestrutura. Os aliases do domínio de chamados (`App.tsx:117-131`) estão todos íntegros.

### Risco residual

- Nenhum teste cobre RLS, transições de status, RBAC de chamados ou o ciclo de vida. As correções preparadas **não vêm com teste automatizado** porque a infraestrutura não existe: `vitest` roda em `environment: 'node'` sem setup, `@testing-library/*` não está instalado, os handlers Go não têm seam de banco, e não há harness SQL.
- Sem CI, nada impede uma regressão futura.
- A divergência repositório↔produção pode ter outras instâncias além das três encontradas. Não fiz varredura exaustiva.

---

## 10. Conclusão

**O módulo está funcional?** Sim, com defeitos. O fluxo de abertura, atribuição, transição de status e notificação funciona. Os defeitos funcionais confirmados (`UX-004`, `UX-010`, `UX-016`, `UX-020`, `UX-023/024/025`) degradam casos de erro e de borda, não o caminho feliz.

**O RBAC está seguro?** Não completamente. Pela interface, sim. Fora dela, quatro falhas confirmadas: CH-C15, CH-C12/C16, CH-C04 e CH-C06.

**Há risco cross-tenant?** Sim, confirmado, em três caminhos: `get_reports_tickets` (anônimo, linhas completas), as duas RPCs de relatório (anônimo, agregados) e `ticket_ratings` (autenticado, texto livre do cliente). **Nenhum deles passa pela interface.**

**Há problemas de performance conhecidos?** Sim, mas não onde se esperaria. Com 5 linhas em `tickets`, nenhuma query é lenta por dado. O custo real é planejamento inflado por 24 índices, `audit_log` dobrado por gatilho duplicado, e 746,9 kB de bundle eager.

**Há código morto relevante?** Sim: 186 linhas confirmadas e 20 objetos de banco, mais 503 linhas a verificar. O fluxo de senha temporária é o caso mais claro.

**O Realtime está correto?** **Não. Está morto.** As tabelas não estão publicadas. Todo o código de canal, cleanup e invalidação do domínio é inerte hoje.

**O ciclo de vida está consistente?** Em produção sim — uma constraint, oito status. No repositório não: reconstruir dali produz quatro status e quebra pausa de SLA, reabertura e cancelamento. Além disso, `UX-013` registra que as oito transições são livres, sem máquina de estados.

**Os testes estão verdes?** 66/66 no frontend, Go `orion-api` ok. `orion-agent/shortcut` falha por motivo pré-existente e não relacionado. O número superestima a cobertura — 9 testes não tocam produção e nada roda em CI.

**O build está verde?** Sim, PASS. Lint continua FAIL com os mesmos 207 erros pré-existentes.

**O que ainda impede considerar o módulo pronto?**

1. **CH-C15** aplicado — é o único bloqueador urgente.
2. As demais migrations aplicadas e verificadas em staging.
3. Decisão sobre o realtime: restaurar a publicação ou remover o código cliente.
4. Reconciliar repositório e produção, e estabelecer que mudanças de schema passam por migration — a causa raiz que produziu três achados independentes.
5. Cobertura mínima de teste para RLS e transições de status, o que exige montar a infraestrutura de teste antes.
