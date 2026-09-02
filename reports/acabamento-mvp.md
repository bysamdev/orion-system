# Acabamento MVP — Auditoria (Fase 1 + Fase 2) + Implementação

Auditoria somente leitura nas Fases 1 e 2. Nenhum arquivo de código foi alterado nessas fases. Zona proibida (autorização/RLS/`RequireCompanyScope`) não foi tocada em nenhum momento — achados de autorização estão listados em "Fora de escopo" ao final.

## Fase 3 — Implementação (pós-aprovação)

Decisões confirmadas pelo usuário: 1.1 ocultar card (não implementar decrypt); 1.2 "Em Atendimento" = azul/info; 1.5 não adicionar CSV; 1.6 fechamento automático agendado; 1.8 PDF com gráfico (não XLSX simples).

Todos os itens 1.1–1.8 foram implementados nesta branch (`claude/orion-mvp-polish-4azuhp`), exceto 1.5 (nenhuma mudança — decisão do usuário de manter XLSX/PDF já existentes). Commits: `6172c71` (1.1–1.4), `5a5afb0` (1.6, 1.7), `599b993` (1.8). `tsc --noEmit`, `npm run build` e a suíte de testes (66 passando) foram executados após cada etapa.

**Passos manuais pendentes antes de funcionar em produção** (não executados nesta sessão — aplicar schema/deploy em projeto Supabase compartilhado é ação de alto impacto que requer decisão explícita do usuário, fora do que foi pedido):
- Aplicar as 3 migrations novas (`20260902120000`, `20260902130000`, `20260902140000`) — via `supabase db push` ou `mcp__Supabase__apply_migration`.
- Criar o secret no Vault: `select vault.create_secret('<valor-aleatorio>', 'orion_cron_dispatch_secret');` e configurar o mesmo valor como env var `CRON_DISPATCH_SECRET` na Edge Function `send-scheduled-report`.
- Deploy da function: `supabase functions deploy send-scheduled-report` (ou `mcp__Supabase__deploy_edge_function`).
- Confirmar que `RESEND_API_KEY` já está configurada no projeto (já usada por outras functions — não deveria precisar de ação nova).
- A Edge Function `send-scheduled-report` não foi exercitada contra um projeto Supabase real nesta sessão (sem ambiente Deno/edge local disponível) — recomenda-se testar em staging antes de habilitar o cron `dispatch-report-schedules` em produção.

---

## 1.1 — Senha remota exibindo ciphertext

**Como é gravado**
- `src/pages/NewTicket.tsx:348` — técnico digita a senha em texto puro, enviada no insert (`remote_password: remotePassword.trim() || null`).
- Coluna criada como `text` puro em `supabase/migrations/20251127190315_..._5c1bca91....sql:4-8`.
- Criptografia adicionada depois: trigger `encrypt_remote_password_trigger_fn()` em `supabase/migrations/20260811000002_phase3_security.sql:37-51` — na gravação, o valor é cifrado com `pgp_sym_encrypt` e guardado em base64 na própria coluna `remote_password`.
- Chave evoluiu de hardcoded (`'orion-secret-256'`) para Supabase Vault via `get_encryption_key()` (`supabase/migrations/20260813130000_remove_hardcoded_encryption_key.sql:13-28`).

**Como é lido**
- `src/pages/TicketDetails.tsx:762` — renderiza `ticket.remote_password` **diretamente**, sem passar por nenhuma função de descriptografia. Esse valor vem do `select` normal sobre `tickets`, ou seja, é o ciphertext base64 gravado pelo trigger.
- `src/pages/TicketDetails.tsx:769` — botão de copiar também expõe o mesmo valor cru.
- RPC `get_decrypted_remote_password(uuid)` existe (`supabase/migrations/20260811000002_phase3_security.sql:54`, refeita em `20260813130000` e `20260818060000_fix_remote_password_decrypt_authz.sql:17` com checagem de tenant/técnico), mas está restrita a `service_role` desde `supabase/migrations/20260813130002_lock_down_encryption_functions.sql:30-33` e reforçada em `20260901220000_fix_p0_authorization_and_rls.sql:51`. **Nenhum chamador** dessa RPC existe em `src/` nem em Edge Functions — não é alcançável do browser com JWT de `anon`/`authenticated`.

**Diagnóstico**: o card em `TicketDetails.tsx:762` hoje mostra **ciphertext base64 ilegível**, não uma senha usável — a criptografia foi adicionada no banco sem qualquer caminho de descriptografia acessível ao frontend. É um recurso quebrado, não apenas uma exibição insegura.

**Duas opções (não escolhida)**

| Opção | Custo | Risco | Observação |
|---|---|---|---|
| **A. Ocultar o card** até existir um fluxo autorizado | Baixo — remover/condicionar a renderização em `TicketDetails.tsx:717-772` | Baixo | Reversível, cirúrgico, não toca RPC/RLS. Deixa o preenchimento em `NewTicket.tsx` funcionando (grava cifrado), só some a exibição quebrada. |
| **B. Implementar caminho autorizado de descriptografia** | Médio/Alto — precisa de uma Edge Function (Deno, roda com `service_role`) que chama `get_decrypted_remote_password` sob autenticação do usuário e repassa só para quem tem escopo, mais chamada no frontend | Médio — é código novo tocando fluxo sensível de credencial remota; testar autorização é decisivo (RPC já valida tenant/técnico, mas a function precisa herdar isso corretamente) | Não toca RLS/policies em si (a function é uma nova camada), mas está próxima da zona proibida — recomendo validar com o agente do P0 antes de mexer, mesmo sendo aditivo. |

**Recomendação**: Opção A para o MVP (baixo custo, elimina o buraco visível agora); B fica como item pós-MVP dado que envolve nova Edge Function tocando dado sensível perto da área em correção por outro agente. **Decisão fica com você.**

---

## 1.2 — Colisão semântica de cores nos badges

**Fonte única declarada**: `src/lib/state-tokens.ts` (254 linhas) define 3 eixos apenas: `TicketStatusKey`, `TicketPriorityKey`, `SLAStatusKey`. **Não existe eixo para severidade de alerta nem status de máquina** — esses dois eixos inteiros são cor crua fora do arquivo de tokens.

**Mapeamento atual em state-tokens.ts**
- Status do chamado: open=blue-500, **in-progress ("Em Atendimento")=cyan-500** (`:41-49`), awaiting-customer=purple-500, awaiting-third-party=indigo-500, resolved=emerald-500, closed=muted, reopened=orange-500, cancelled=muted.
- Prioridade: urgent=destructive/red, high=orange-500, **medium ("Média")=amber-500** (`:123-131`), low=muted.
- SLA: ok=emerald-500, warning=amber-500, attention=orange-500, breached=destructive/red.

Ou seja: no arquivo de tokens **não há colisão** entre "Média" (amber) e "Em Atendimento" (cyan) — o enunciado da colisão em âmbar aponta para um bypass fora do arquivo, confirmado abaixo.

**Colisões e bypasses confirmados (raw Tailwind fora de state-tokens.ts)**
1. `src/components/admin/SLAConfiguration.tsx:207` — rótulo "Média" (prioridade) renderizado com `text-blue-500`, contradizendo o token (amber) e colidindo com blue = status "open" do outro eixo.
2. **Eixo de status de máquina/ativo — sem token, 100% cor crua**: `src/components/monitoring/RemoteTerminal.tsx:222-223,228,303` (online=green-500, offline=red-500); `src/components/monitoring/MachineDrawer.tsx` (dezenas de condicionais red/amber/emerald/blue por limiar, ex. `:938-942,1013-1016,1077-1080,502-504`); `src/pages/Monitoring.tsx:702-723` (online=emerald-500, "Em Alerta"=amber-500 cru); `src/components/monitoring/InventoryTab.tsx:115-133` e `:163-181` (mesma lógica de limiar duplicada dentro do próprio arquivo).
3. **Eixo de severidade de alerta — sem token, 100% cor crua**: `src/pages/AlertsDashboard.tsx:622` ("Total Crítico"=red), `:624` ("Firewall Off"=red), `:626` ("Disco >90%"=amber), `:627` ("CPU >85%"=orange), `:651,669,678` (`colorClass` cru passado a stat-tile).
4. **"Em Atendimento" sem cor em vários pontos** (texto puro, sem badge/token): `TicketDetails.tsx:72,475,997`; `TicketHistory.tsx:143`; `TechnicianDashboard.tsx:388-390,402,435,448,472,587`. Onde a cor é aplicada via `getStatusConfig`/`getRechartsStatusColor` (ex. `useTechnicianStats.ts:138`), está correta (cyan).

**Regra a respeitar** (laranja/vermelho = risco/urgência; ciclo de vida = info/primary/success) já é violada em pelo menos um ponto: `AlertsDashboard.tsx:627` usa orange para "CPU >85%" (correto, é risco) mas `Monitoring.tsx:702-723` usa amber para "Em Alerta" de forma crua e sem ligação ao eixo de SLA/prioridade — não é uma violação da regra em si, mas confirma que o eixo de severidade de alerta precisa do próprio mapeamento consistente (provavelmente reaproveitando a paixa laranja/vermelha do SLA_STATUS_MAP).

**Decisão pendente — "Em Atendimento": roxo/primary ou azul/info?**

| Opção | Impacto visual | Observação |
|---|---|---|
| **Azul/info** | Mantém a paleta atual "cyan" (que já é uma variação de info) mais próxima do que já está em produção — menor differença perceptual, migração quase invisível para o usuário. Ciclo de vida inteiro (open=blue, in-progress=azul/info) fica visualmente coeso como uma progressão dentro da mesma família de cor. | Reduz a diferenciação entre "open" (aberto, ainda não iniciado) e "in-progress" (em atendimento) — as duas ficam na família azul, exigindo tom/saturação diferentes para não confundir. |
| **Roxo/primary (marca)** | Destaca "Em Atendimento" como estado de identidade/marca — mais chamativo, quebra a progressão azul-verde do ciclo de vida. Aproxima do "awaiting-customer" atual (purple-500), que já é roxo — criaria colisão nova com esse status. | Já existe roxo ocupado por "awaiting-customer" (`state-tokens.ts:appx linha do map`) — usar roxo para "Em Atendimento" geraria uma colisão nova dentro do próprio eixo de status, a menos que "awaiting-customer" mude de cor também (escopo maior). |

**Recomendação**: azul/info — menor custo de migração, sem gerar nova colisão com "awaiting-customer" (que já é roxo), e mantém a regra "ciclo de vida = info/primary/success". **Decisão final é sua.**

---

## 1.3 — Estados vazios

Existe um componente pronto — `src/components/ui/table-empty-state.tsx` (`TableEmptyState`) — mas **não é importado em nenhuma lista real**, só citado em docs de design (`reports/design-system/03-tabelas.md`, `CONTRATO-PROPOSTO.md`). Cada lista reimplementa o próprio empty state à mão, com inconsistência de ícone/copy/espaçamento.

| Rota/Página | Componente | Estado vazio atual | Estado de loading atual | Precisa tratamento (S/N) |
|---|---|---|---|---|
| Fila técnico (chamados) | `TechnicianDashboard.tsx:688,723,754` | Texto em `TableCell`, sem ícone/CTA | Spinner único gate a página inteira (`:360`); listas individuais sem loading próprio | N — funcional, mas cru |
| Portal do cliente (chamados) | `ClientPortal.tsx:157` | **Nada é renderizado** quando `openTickets.length === 0` | `ticketsLoading` nunca usado — seção fica em branco durante fetch | **S — prioridade alta**: branco indistinguível entre "carregando" e "sem chamados" |
| Histórico de chamados | `TicketHistory.tsx:175,213` | Texto simples "Nenhum ticket encontrado" | Spinner central (`:167-171`) | N — funcional, só sem ícone/CTA |
| Base de conhecimento | `KnowledgeBase.tsx:671-683` | Card com ícone, título, descrição, CTA "Limpar Busca" — melhor UX do app | `isLoading` **não é usado** — mostra "Nenhum artigo encontrado" durante o carregamento (falso vazio) | **S**: falso-vazio durante loading é enganoso |
| Ativos | `Assets.tsx:946` | `TableCell` com ícone, título, descrição, botão limpar filtro | Skeleton de página inteira (`:299-313`) | N — o mais completo do app |
| Máquinas / RMM | `Monitoring.tsx:416,420,440,481,515,1144` | Múltiplos estados (onboarding quando zero geral, dashed box por filtro/grupo) | `MachineCardSkeleton` (`:388-391`) + skeleton do sidebar de grupos | N — o mais robusto, mas estilos inconsistentes entre si |
| Alertas | `AlertsDashboard.tsx:600-615` | Estado positivo "Tudo Conforme & Seguro!" com ícone — bem-feito | Skeleton grid (`:594-599`) | N — bom, mas `isLoading` usa `&&` em vez de `\|\|` entre duas queries (pode mostrar dado parcial) |
| Contratos | `ContractManagement.tsx:210` | Linha de texto "Nenhum contrato cadastrado." | Spinner central (`:107`) | N — funcional, cru |
| Relatórios | `Reports.tsx:1136,308,1115` | Texto "Nenhum chamado encontrado..." + desabilita exportação quando vazio (boa prática) | Spinner de página + spinner de tabela | N — funcional |
| Usuários | `UserManagement.tsx:646` | **Nenhum fallback existe** — tabela renderiza cabeçalho sem linhas | Skeleton de linhas (`:481-488`) — bom | **S — prioridade alta**: única lista admin sem nenhum tratamento de vazio |
| Empresas/Clientes | `CompanyManagement.tsx:384,448` | `TableCell` "Nenhuma empresa cadastrada." | Spinner central (`:270`) | N — funcional, cru |

**Prioridade recomendada**: `UserManagement.tsx:646` (sem fallback nenhum) e `ClientPortal.tsx:157` (sem vazio nem loading, visível ao cliente final) primeiro; depois `KnowledgeBase.tsx` (falso-vazio); depois padronizar as demais usando `TableEmptyState` já existente.

---

## 1.4 — Consistência de terminologia PT-BR

Não há glossário nem constantes de label compartilhadas — cada tela escolheu termos de forma independente.

**Glossário proposto**

| Conceito | Termo vencedor | Justificativa |
|---|---|---|
| Ticket/chamado | **Chamado** | Já é o termo dominante nas rotas traduzidas e na maioria das telas (Reports, TicketDetails, NewTicket) |
| Ativo/Dispositivo/Máquina | **Ativo** (nome da entidade/página) — "Dispositivo" aceitável em telas de monitoramento técnico (Monitoring/RMM) como sinônimo operacional, mas não misturar na mesma tela | [INFERÊNCIA] segue o nome da página `Assets.tsx`/"Ativos" já existente como âncora |
| Empresa/Cliente | **Empresa** isolado; combinar só quando necessário desambiguar papel do usuário (ex. formulário de novo usuário) — nesse caso usar sempre "Cliente / Empresa" (ordem fixa) | Empresa é o termo dominante (7+ ocorrências isoladas vs. 4 combinadas com ordens divergentes) |
| Usuário/Colaborador | **Usuário** para a entidade de conta; "Colaborador" não deveria rotular o papel `customer` (ver correção abaixo) | `customer` mapeia semanticamente a "Cliente", não a "Colaborador" — está mal nomeado |

**Ocorrências divergentes (arquivo:linha)**

*Chamado vs Ticket*: `TicketHistory.tsx:205` ("Ticket"), `DebugTools.tsx:505` ("Ticket #"), `WorkloadChart.tsx:33` ("Tickets"), `TechnicianDashboard.tsx:390,402,412,425,435,448,458,472` ("Tickets..."), `Assets.tsx:681` ("Chamados (Tkts)" — mistura os dois no mesmo header) vs. `TicketDetails.tsx:658,957,1122`, `NewTicket.tsx:447`, `Avaliacao.tsx:62`, `Reports.tsx:517,634,739,807,834,904` ("Chamado(s)").

*Ativo/Dispositivo/Máquina*: `TicketDetails.tsx:1358` ("Ativo Relacionado") e mesma página tem bloco de sessão remota rotulado "Máquina"; `Monitoring.tsx:248,491` ("Dispositivo"); `AlertsDashboard.tsx:658` ("Dispositivos"); `DeployDialog.tsx:101` ("Máquina de Destino"). Três termos para o mesmo conceito, às vezes na mesma página (`TicketDetails.tsx`).

*Empresa/Cliente, ordem inconsistente*: "Cliente / Empresa" em `Assets.tsx:384,516`, `WebMonitoring.tsx:1244`, `MachineDrawer.tsx:819` vs. "Empresa / Cliente" (ordem invertida) em `TechnicianDashboard.tsx:627`. Isolados: `Reports.tsx:426,1126`, `ContractManagement.tsx:136,233`, `UserManagement.tsx:639,722`, `SLAConfiguration.tsx:123`, `Automacoes.tsx:29`, `RuleForm.tsx:110` ("Empresa"); `Monitoring.tsx:894`, `Assets.tsx:678` ("Cliente").

*Usuário/Colaborador*: `Settings.tsx:160`, `DebugTools.tsx:650`, `mocks/tickets.ts:42-43,71-72` ("Usuário") vs. `UserManagement.tsx:614,759,943` — role `customer` rotulado como "Colaborador" três vezes na mesma tela que gerencia "usuários". [INFERÊNCIA] Isso é confuso porque `customer` deveria mapear a "Cliente", não "Colaborador" — mas essa é uma decisão de produto, não só de terminologia; registro sem corrigir sozinho.

---

## 1.5 — Exportação de relatórios

**Achado principal: exportação já existe.** A premissa do brief ("não existe exportação") está desatualizada.

- Estrutura de dados: `src/lib/reports/aggregations.ts` (568 linhas) — funções puras que transformam `Ticket[]`/`time_entries` em arrays `{name, value}[]` prontos para Recharts, consumidas em `Reports.tsx:195-216`.
- **XLSX**: `src/lib/reports/exportXlsx.ts` via `write-excel-file` (`package.json:54`) — handler em `Reports.tsx:275-303`. Comentário no código (`exportXlsx.ts:1-10`) justifica evitar SheetJS por CVEs abertos de prototype pollution/ReDoS — decisão consciente de segurança, não descuido.
- **PDF**: `src/lib/reports/exportPdf.ts` via `jspdf` (`package.json:41`) — handler em `Reports.tsx:242-273`, captura os SVGs dos gráficos renderizados via `document.querySelectorAll('[data-report-chart]')`.
- Fallback de impressão (`window.print()`) em `Reports.tsx:380-389`.
- CSV puro: NÃO ENCONTRADO — não há botão nem util CSV, nem `papaparse` no `package.json`.

**Recomendação**: nenhuma ação necessária para XLSX/PDF (já entregue). Se "CSV" for exigência específica do MVP, é aditiva e barata (gerar client-side a partir dos mesmos arrays de `aggregations.ts`) — mas verificar com você se é realmente necessário dado que XLSX já cobre o caso de uso de planilha.

---

## 1.6 — Fechamento de banco de horas

**O que existe hoje**
- `time_entries` (`supabase/migrations/20260309033335_...sql:245-256`): `ticket_id`, `user_id`, `start_time`, `end_time`, `duration_minutes`, `billable`. Sem `contract_id`, sem período de faturamento, sem flag de fechamento/trava.
- `contracts` (`...sql:114-126`): tem `monthly_hours`, mas nenhum campo de horas consumidas, ciclo de faturamento ou rollover.
- `contract_billing_cycles`: **NÃO ENCONTRADO**.
- Consolidação mensal, comparação consumido×contratado, espelho: **NÃO ENCONTRADO** — nem view SQL, nem edge function, nem cron. Reports.tsx calcula horas por técnico/empresa (`computeHoursByTechnician/computeHoursByCompany`) mas é uma visão ad-hoc filtrável, sem fechamento/trava de período.

**Menor mudança de schema que fecha o ciclo** [INFERÊNCIA — arquitetura, não implementação]:
1. Nova tabela `contract_billing_cycles` (`contract_id`, `period_start`, `period_end`, `consumed_hours numeric`, `closed_at timestamptz`, `closed_by uuid`) — **aditiva**, sem alterar tabelas existentes.
2. Vincular `time_entries` a um ciclo via coluna nova opcional `billing_cycle_id uuid NULL` — **aditiva** (nullable, não quebra linhas existentes).
3. Função/RPC de fechamento que soma `time_entries.duration_minutes` do período por contrato e grava em `contract_billing_cycles` — código novo, sem migração destrutiva.

Classificação: **aditiva** em toda a extensão — nenhuma coluna existente muda de tipo/obrigatoriedade.

---

## 1.7 — Alerta de SLA antes do vencimento

**Hoje é reativo, não preditivo.** Existe uma faixa "attention" (`tickets.sla_status`) calculada por `update_all_tickets_sla_status()` (`supabase/migrations/20251119042353_...sql:195-222`), mas essa função só é chamada por **trigger em UPDATE do ticket** (comentário, mudança de status, pausa/retomada de SLA) — o próprio comentário da migração diz "**Deve ser chamada periodicamente (cron/scheduler)**" (linha 222) e isso nunca foi implementado: nenhum dos 4 jobs de `cron.schedule` existentes (`supabase/migrations/20260614000000...`, `20251203065616...`, `20260818060000...`, `20260829120000...`) chama essa função.

Consequência: um chamado parado (sem interação) pode pular de "ok" direto para "breached" sem nunca passar visivelmente por "attention" em tempo real, e nenhuma notificação é emitida quando o status muda para "attention".

**Infra reaproveitável**: tabela `notifications` (`supabase/migrations/20251127161117_...sql:2-10`, com RLS por usuário) + hook `useNotifications.ts` já em uso na UI; Realtime já usado em `useRealtimeTickets.ts` (padrão a seguir).

**Caminho mais simples** [INFERÊNCIA]: (a) adicionar `update_all_tickets_sla_status()` a um `cron.schedule` (ex. a cada 15-30 min) — mudança de configuração, não de schema; (b) na própria função, ao transicionar para `attention`, inserir uma linha em `notifications` para o técnico responsável — aditivo, reaproveita infraestrutura existente, sem tocar RLS/autorização.

---

## 1.8 — Agendamento de relatório por e-mail

**O que existe**: Resend já integrado em 3 Edge Functions (`invite-user-resend`, `send-password-changed-alert`, `create-user-credentials`), todas via `fetch` direto (sem SDK npm). `src/lib/reports/types.ts:1-7` já documenta a intenção: aggregations em TS puro "para poderem ser importadas... futuramente, por uma Supabase Edge Function (Deno) no relatório agendado por e-mail" — o time já projetou para isso.

**O que falta**: tabela de agendamento (`report_schedules` ou similar — NÃO ENCONTRADO), entrada de cron (`vercel.json:38-43` só tem 2 crons de monitoramento, nenhum de relatório), UI de configuração de destinatários/frequência (NÃO ENCONTRADO).

**Limite de Edge relevante**: a exportação de PDF atual (`exportPdf.ts`) depende de capturar SVGs **já renderizados no DOM do browser** (`document.querySelectorAll('[data-report-chart]')`) — isso é incompatível com Deno Edge Function ou Vercel Edge Runtime (sem DOM, sem headless-browser). Um relatório agendado por e-mail precisaria de um caminho de renderização server-side separado (SVG gerado a partir dos mesmos dados de `aggregations.ts`, sem depender de Recharts renderizado no browser) — ou rodar em função Node serverless (não-Edge) em vez de Edge Function. O caminho de XLSX (`write-excel-file`, puramente orientado a dados) é mais portável, mas a compatibilidade com runtime Deno não foi verificada no código.

**Menor caminho** [INFERÊNCIA]: (a) tabela aditiva `report_schedules` (`company_id`? ver decisão de escopo, `recipients`, `frequency`, `filters jsonb`, `next_run_at`); (b) `pg_cron` (já provado no projeto) disparando uma Edge Function; (c) essa function reusa `aggregations.ts` + gera XLSX (mais barato) ou HTML/tabela simples por e-mail em vez de PDF com gráfico, evitando o problema de renderização.

---

## Fase 2 — Consolidação

### Tabela de itens

| Item | Achado | Esforço (P/M/G) | Visibilidade (A/M/B) | Toca schema? | Bloqueado por algo? |
|---|---|---|---|---|---|
| 1.1 Senha remota | Card mostra ciphertext ilegível; RPC existe mas inacessível do frontend | P (ocultar) / G (implementar decrypt) | A | Não (opção A) / Não (opção B — só Edge Function nova) | Decisão sua (A vs B); B roça a zona proibida |
| 1.2 Cores de estado | Colisão pontual (SLAConfiguration "Média"=azul); 2 eixos inteiros (alerta, máquina) sem token | M | A | Não | Decisão sua: cor de "Em Atendimento" |
| 1.3 Estados vazios | 2 lacunas reais (Usuários sem fallback, Portal do Cliente sem vazio/loading); resto é polish de consistência | M | A | Não | Não |
| 1.4 Terminologia | 4 pares de sinônimos divergentes, sem glossário/constantes | M (many files) | M | Não | Não |
| 1.5 Exportação de relatórios | Já implementado (XLSX+PDF); só falta CSV se for exigência | P (se CSV) / — | M | Não | Não |
| 1.6 Fechamento de banco de horas | Falta ciclo de fechamento inteiro; schema atual só tem a meta (`monthly_hours`) | G | M | Sim (aditivo) | Não |
| 1.7 Alerta de SLA prévio | Função de recálculo existe mas nunca roda em cron; sem notificação de "attention" | M | A | Não (config de cron + código) | Não |
| 1.8 Agendamento de relatório por e-mail | Infra (Resend, pg_cron, código pronto para reuso) existe; falta tabela+cron+render server-side | G | M | Sim (aditivo) | 1.5 (reaproveita), problema de render de gráfico em edge |

### Ordem de execução recomendada

1. **1.1** (ocultar card, opção A) — menor esforço, maior visibilidade, elimina bug ativo.
2. **1.4** (glossário + correções pontuais) — baixo custo por ocorrência, alta visibilidade, sem dependências.
3. **1.2** (corrigir bypass pontual + decidir cor "Em Atendimento" +, se houver tempo, tokenizar eixos de alerta/máquina) — depende só da sua decisão de cor.
4. **1.3** (Usuários sem fallback; Portal do Cliente sem vazio/loading; depois padronizar com `TableEmptyState`) — médio esforço, alta visibilidade.
5. **1.7** (cron + notificação de SLA) — reaproveita infraestrutura existente, sem schema.
6. **1.5** (CSV, se exigido) — trivial, mas só depois de confirmar necessidade real dado que XLSX já existe.
7. **1.6** (fechamento de banco de horas) — maior esforço, exige schema novo.
8. **1.8** (agendamento por e-mail) — maior esforço, exige schema novo e resolve dependência de renderização de gráfico fora do browser; fazer por último pois se beneficia de 1.5/1.6 estarem consolidados.

Justificativa: itens 1.1–1.4 são baratos e de alta visibilidade — corrigem buracos que qualquer usuário nota imediatamente, sem tocar schema. 1.7 é intermediário (config + pouco código, reaproveita tabela `notifications`). 1.5/1.6/1.8 exigem mais desenho — 1.5 quase não exige nada (já existe), 1.6 e 1.8 exigem schema novo e foram deixados por último.

### Decisões que dependem de você

| Decisão | Opções | Recomendação |
|---|---|---|
| **1.1 — destino do card de senha remota** | A) Ocultar até existir fluxo autorizado. B) Implementar Edge Function de descriptografia autorizada agora. | A — menor risco, corrige o bug visível já; B fica para depois do P0 de autorização estar fechado. |
| **1.2 — cor de "Em Atendimento"** | Azul/info (mantém proximidade com o cyan atual, sem nova colisão) vs. Roxo/primary (colide com "awaiting-customer", já roxo). | Azul/info. |
| **1.5 — CSV é realmente necessário?** | Manter só XLSX/PDF (já existem) vs. adicionar CSV puro. | Manter como está, a menos que haja exigência explícita de CSV. |
| **1.6 — escopo do fechamento** | Fechamento manual (botão "Fechar mês") vs. fechamento automático agendado. | [INFERÊNCIA] Manual primeiro (menor esforço, dá controle ao gestor); automatizar depois se necessário. |
| **1.8 — formato do e-mail agendado** | PDF com gráfico (exige reescrever renderização para server-side) vs. XLSX/tabela HTML simples (mais barato, sem gráfico). | XLSX/tabela simples — evita o problema de renderização de gráfico fora do browser. |

### Critério de sucesso verificável por item

- **1.1**: card de senha remota não exibe mais string ilegível (opção A: card não aparece; opção B: senha decifrada aparece corretamente para usuário autorizado, erro/oculto para os demais).
- **1.2**: `grep` por `bg-amber\|bg-blue\|bg-red\|bg-orange` dentro de componentes de badge de estado retorna zero resultados fora de `state-tokens.ts`; "Média" e "Em Atendimento" nunca compartilham a mesma cor na mesma tela.
- **1.3**: `UserManagement.tsx` e `ClientPortal.tsx` mostram mensagem clara "sem dados" quando a lista está vazia, distinguível do estado de carregamento.
- **1.4**: glossário publicado; ocorrências divergentes listadas corrigidas para o termo vencedor (`grep` das listas acima não retorna mais os sinônimos descartados).
- **1.5**: se implementado, botão CSV gera arquivo válido abrindo em Excel/planilha sem erro.
- **1.6**: existe uma tela/ação que, dado um contrato e mês, mostra horas consumidas vs. `monthly_hours` e permite fechar o período (trava novos apontamentos retroativos).
- **1.7**: um chamado que cruza o limiar de "attention" gera uma notificação para o responsável em até N minutos (definido pelo intervalo do cron) sem exigir edição manual do ticket.
- **1.8**: agendamento configurado dispara e-mail com o relatório no dia/hora definidos, verificável no log da Edge Function/Resend.

### Achados fora de escopo

- **[AUTORIZAÇÃO — apenas registrado, não corrigido]** `1.1`: a RPC `get_decrypted_remote_password` já foi endurecida (restrita a `service_role`) por outro agente em migrações recentes (`20260813130002`, `20260818060000`, `20260901220000`) — não há ação pendente aqui além do que já está descrito no item 1.1, mas vale confirmar com o agente do P0 se a Opção B do item 1.1 (nova Edge Function) não conflita com o trabalho dele antes de implementar.
- **Código morto**: `src/components/ui/table-empty-state.tsx` — componente pronto e não utilizado em nenhuma lista (mencionar, não apagar).
- **Duplicação de lógica**: limiares de cor (red/amber/emerald) para CPU/disco/RAM repetidos quase idênticos em `MachineDrawer.tsx` (~10 ocorrências) e duas vezes dentro do mesmo arquivo em `InventoryTab.tsx:115-133,163-181` — fora do escopo desta tarefa (não é badge de estado semântico, é lógica de limiar numérico), mas candidato a helper compartilhado.
- **Rótulo confuso de papel**: role `customer` exibido como "Colaborador" em `UserManagement.tsx:614,759,943`, quando semanticamente mapeia a "Cliente" — decisão de produto, não corrigida aqui.
- **Homônimo "Ativo"**: usado como status ("Active" em `UserManagement.tsx:775`) e como substantivo (ativo/asset em `TicketDetails.tsx:1358`) — risco de confusão, registrado no item 1.4.
