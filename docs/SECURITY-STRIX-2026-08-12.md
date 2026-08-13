# Triagem e correção do pentest Strix — Orion System

**Run analisada:** `strix_runs/orion-system_9b53` (2026-08-12)
**Stack:** React + Vite + TypeScript + Tailwind · Go (Vercel serverless) · Supabase/Postgres

| | |
|---|---|
| Achados no relatório | 17 |
| Confirmados como reais | 10 |
| **Corrigidos** | **9** |
| Já corrigido antes da varredura | 1 |
| Falsos positivos / não aplicáveis | 6 |
| Bloqueado por breaking change | 1 |
| Pendente com você | 2 |

**Resultado no backend Go:** `govulncheck` → *No vulnerabilities found.*

> Achados que o Strix **não** reportou e foram corrigidos junto: spoofing de IP
> que furava o rate limiting, um segundo `CRON_SECRET` fail-open, e ambiguidade
> de lockfile que faria as correções npm não chegarem em produção.

---

## 1. Corrigido

Cada mudança foi aplicada e validada isoladamente (`go build` · `go vet` ·
`go test` · `npm run build` · `tsc --noEmit`).

### 1.1 Credenciais de produção do Postgres no repositório — grau 10

`scripts/audit.sh:1` exportava a connection string do Supabase em texto puro,
com a senha do papel `postgres` — que ignora RLS e dá read/write no banco todo.

A credencial saiu do arquivo; o script agora exige `DATABASE_URL` no ambiente e
**falha fechado** sem ela. Verificado: `bash -n` OK, o script aborta antes de
qualquer `psql`, e não há mais nenhuma ocorrência da senha no working tree.

> ⚠️ **A senha continua válida.** Você optou por não rotacionar agora — ver §3.

### 1.2 RCE cross-tenant via RLS de `machine_commands` — grau 9

Nova migration: `supabase/migrations/20260812210000_scope_machine_commands_rls.sql`

As políticas globais (`FOR ALL TO authenticated USING (true)`) deram lugar a
quatro políticas escopadas por empresa, ligadas pela máquina referenciada
(a tabela não tem `company_id` própria), espelhando o padrão já usado em
`20260614000001_enable_rls_machines.sql`:

| Operação | Quem pode |
|---|---|
| SELECT | qualquer usuário da empresa dona da máquina |
| INSERT / UPDATE | `admin` e `technician` da empresa |
| DELETE | `admin` da empresa |
| todas | empresa master e `developer`, globalmente |

**Por que não quebra nada:** o único ponto que enfileira comando é
`useDeployPackage` (`src/hooks/usePatchManagement.ts:140`), acessível só pela
tela `PatchManagement`, que já exige `admin`/`developer`/`technician`
(`src/pages/PatchManagement.tsx:56`). A política cobre exatamente esse conjunto.

> A migration está escrita e é idempotente, **mas ainda não foi aplicada no
> banco** — ver §3.

### 1.3 Vazamento de dados entre clientes nos 8 endpoints de leitura — grau 8

Os handlers autenticavam e descartavam a identidade com `_ = user`. Agora nenhum
`_ = user` sobrou em `handler/`.

Como o pool do backend usa papel privilegiado (RLS não se aplica), o recorte foi
feito na aplicação, em `lib/db.go`:

```go
type UserScope struct { CompanyID *string; Role string; Master bool }
func (s UserScope) Global() bool          // master OU developer
func (s UserScope) FiltroEmpresa() *string // nil = vê tudo
func (s UserScope) PodeVerEmpresa(*string) bool
```

O critério de "vê tudo" é idêntico ao das policies de RLS já existentes
(`is_master_company_user` OR `has_role(..., 'developer')`), então o painel da
empresa master continua global.

- **Leituras por objeto** (detalhe, métricas, alertas, comandos): carrega a
  máquina, compara a empresa, devolve `403`.
- **Leituras agregadas** (dashboard, grupos, alertas críticos, máquinas do
  grupo): o `company_id` desceu para o SQL via `($1::uuid IS NULL OR ...)`.
  Nos alertas críticos o filtro entrou nos **4 ramos** do `UNION`.

Cobertura: `lib/scope_test.go` — inclui o caso central (usuário da empresa A
lendo máquina da empresa B), máquina órfã com `company_id` nulo, e usuário sem
empresa no perfil.

### 1.4 SQL Injection no pgx — grau 8

`GO-2026-5004` — *placeholder confusion with dollar quoted string literals*.
Agravado porque `lib/db.go` força `QueryExecModeSimpleProtocol`, o modo em que o
pgx monta a query no cliente.

`pgx v5.7.6 → v5.10.0`. Isso exigiu subir a diretiva para `go 1.25.0` (nenhuma
versão corrigida roda em 1.23 — testei v5.9.0, v5.9.1 e v5.9.2). Confirmei na
doc da Vercel que ela **baixa e cacheia o toolchain declarado no `go.mod`**, sem
lista fixa de versões, então não há risco de deploy.

Aproveitando a mesma janela: `toolchain go1.26.5` fixado, o que zerou também as
12 vulnerabilidades de stdlib (XSS em `html/template` — e `lib/helpers.go:40`
renderiza template para e-mail —, bypass de verificação de certificado em
`crypto/x509`, DoS em `crypto/tls`). E `golang.org/x/text → v0.39.0`
(`GO-2026-5970`, loop infinito).

### 1.5 Spoofing de IP furando o rate limiting — grau 6 *(fora do relatório do Strix)*

`GO-2026-5774/5775/5777`. O `middleware.RealIP` sobrescrevia `r.RemoteAddr` com
o `X-Forwarded-For` **enviado pelo cliente**, e é disso que `lib.ClientIP`
deriva as chaves dos rate limiters. Bastava variar o header a cada requisição
para ter tentativas ilimitadas em `machine-login` — justamente o endpoint que
concede sessão só com um token na query string.

`RealIP` saiu; entrou `middleware.ClientIPFromXFFTrustedProxies(n)`, que usa a
entrada acrescentada pelo nosso próprio proxy — a única que o cliente não forja.
`n` = 1 na Vercel, ajustável por `TRUSTED_PROXY_COUNT`. `lib.ClientIP` lê o
valor validado e cai para `r.RemoteAddr` fora da Vercel (dev local).

Cobertura: `handler/router_security_test.go` prova que 5 formas de spoof
(à esquerda, header repetido, cadeia longa, IP privado) colapsam numa única
chave de rate limit.

> Nota: o Strix reportou outra falha do chi (`RedirectSlashes`), que é **código
> morto** neste projeto, e não reportou esta, que está em uso.

### 1.6 Senha inicial previsível — grau 6

`Orion` + 4 dígitos = 9.000 valores (~13 bits), com a conta já confirmada e
pronta para login. Corrigido nos dois lugares:

- `handler/fn_handlers.go` → `lib.GenerateRandomPassword(16)` (que já existia)
- `supabase/functions/create-user-credentials/index.ts` → `crypto.getRandomValues`
  com laço de rejeição, substituindo o `Math.random()` (que nem CSPRNG era)

Validado com 20.000 amostras: zero colisões, os 70 símbolos do alfabeto em uso,
desvio máximo de uniformidade 3,14%.

### 1.7 Open redirect no `machine-login` — grau 5

`strings.HasPrefix(v, "/")` aceitava `//evil.com`, que o navegador resolve como
`https://evil.com` — e a vítima chegava lá **já autenticada** pelo magic link.

Nova `caminhoRelativoSeguro()` rejeita `//`, `\`, CRLF e qualquer `://`.
14 casos de teste. Os 5 testes que já existiam em `auth_handlers_test.go`
continuam passando.

### 1.8 `GET /api/tickets/resolve/{id}` sem autenticação — grau 5

Única rota da API sem `requireAuth`. Traduzia número sequencial → UUID interno
para qualquer anônimo, permitindo enumerar todos os chamados via `/1`, `/2`, `/3`.
`requireAuth` adicionado. Busca em `src/` e `supabase/functions/` não achou
nenhum consumidor — risco de quebra nulo.

### 1.9 `CRON_SECRET` fail-open — grau 4 *(+1 caso fora do relatório)*

A checagem só rodava `if cronSecret != ""`. Extraído para `autorizarCron()`, que
falha fechado com `503` e loga um alerta. Aplicado nos **dois** handlers:
`cronMarkOffline` (o que o Strix reportou) e `cronProbeNetworkLinks`
(`network_links_handlers.go:119`, mesmo padrão, não reportado).

> ⚠️ **Confira `CRON_SECRET` na Vercel antes do deploy.** Se não estiver
> definida, os dois crons do `vercel.json` passam a responder 503 e máquinas
> deixam de ser marcadas offline. O log `[ALERTA]` avisa quando isso acontece.

### 1.10 CORS com allowlist — grau 2

Antes refletia qualquer `Origin` com `Allow-Credentials: true`. Hoje não é
explorável (auth só por Bearer, sem cookie) — o próprio Strix não filou como
vulnerabilidade. Vira grave no dia em que auth por cookie entrar, então foi
fechado agora: allowlist com `orion.bysam.dev` + localhost:8080, extensível por
`CORS_ORIGINS`, com `Vary: Origin`.

Testes cobrem inclusive `https://orion.bysam.dev.evil.com` (sufixo colado no
domínio legítimo) e `http://` no mesmo host.

### 1.11 Dependências npm

`postcss 8.5.15 → 8.5.26`, `nanoid 3.3.12 → 3.3.18`, mais `brace-expansion` e
`js-yaml`. Sem breaking change.

`react-router-dom 6.30.4 → 7.18.2` (open redirect via backslash em `<Link>`/
`useNavigate`). O app só usa a API clássica — `BrowserRouter`, `Routes`,
`Route`, `Navigate`, `Link`, `useNavigate`, `useLocation`, `useParams`,
`useSearchParams` — sem data router e sem SSR, tudo idêntico na v7.

Verificado no navegador com o dev server rodando:

| Rota | Resultado |
|---|---|
| `/` | redireciona para `/auth` (`ProtectedRoute` + `Navigate`) |
| `/novo-ticket` | redireciona para `/auth` (guarda de rota protegida) |
| `/rota-que-nao-existe-123` | 404 catch-all |

`tsc --noEmit` limpo, build limpo, zero erros de router no console (só a
ausência de env do Supabase, esperada em dev local).

### 1.12 Ambiguidade de lockfile *(fora do relatório do Strix)*

`bun.lock`, `bun.lockb` **e** `package-lock.json` estão os três commitados, e os
do bun estão desatualizados — listam `lodash 4.17.21` enquanto a árvore real tem
`4.18.1`. A doc da Vercel não define precedência entre lockfiles coexistentes,
então havia risco real de as correções acima simplesmente não chegarem em
produção.

`"installCommand": "npm install"` fixado no `vercel.json`. Ver §3 sobre remover
os lockfiles do bun.

---

## 2. Não aplicado — bloqueado por breaking change

### Vite 5.4.21 → 8.2.1 (esbuild/vite, severidade alta, **build-time apenas**)

Tentei e **revertі**. O Vite 8 trocou o Rollup pelo Rolldown, que não aceita
`manualChunks` como função — que é exatamente a estratégia de chunking do seu
`vite.config.ts`, a com os comentários sobre o recharts. Erro:

```
TypeError: manualChunks is not a function
```

Além disso, `@vitejs/plugin-react-swc@3.11.0` declara peer `^4 || ^5 || ^6 || ^7`
— não suporta a 8.

Corrigir exige reescrever a estratégia de chunking, com consequências de tamanho
de bundle. Isso é trabalho de build, não de segurança, e o risco real aqui é
próximo de zero: vite e esbuild não vão para produção — a Vercel serve arquivos
estáticos, o dev server não roda lá. Deixei para uma tarefa própria.

Estado revertido e confirmado: `vite@5.4.21`, build passando.

---

## 3. Pendente com você

### 3.1 Rotacionar a senha do Supabase — grau 10

Você pediu para não fazer, então não fiz. Registrando o estado real: **a senha
continua válida e continua no histórico do git** (desde o commit `a7766bb`).
Tirá-la do arquivo não a invalida — quem já clonou o repositório continua com
acesso total ao banco.

Enquanto isso não for feito, é o maior risco em aberto do sistema, e as outras
oito correções não o compensam.

Supabase → Settings → Database → Reset password, depois atualizar `DATABASE_URL`
na Vercel. Feito isso, a string no histórico vira inútil e a limpeza do histórico
(`git filter-repo`) deixa de ser necessária.

### 3.2 Aplicar a migration no banco de produção

A migration está escrita e é idempotente, mas **não a apliquei** — rodar DDL em
produção é ação sua. Enquanto não rodar, o RCE cross-tenant (§1.2) continua
aberto no banco, mesmo com o arquivo commitado.

```bash
supabase db push
```

Vale conferir depois que as políticas ficaram como esperado:

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'machine_commands';
```

### 3.3 Decisões menores

- **`CRON_SECRET` na Vercel** — confirmar que está definida antes do deploy (§1.9).
- **Lockfiles do bun** — se você não usa bun (não está instalado nesta máquina),
  remover `bun.lock` e `bun.lockb` elimina a ambiguidade na raiz. Não removi
  porque pode ser intencional.
- **Senha provisória por e-mail** — troquei o gerador, mas a senha ainda vai em
  texto puro no e-mail e a troca no primeiro acesso continua sendo só uma
  sugestão. O correto é mandar link de definição de senha. É mudança de fluxo,
  não de uma linha.

---

## 4. Falsos positivos confirmados

| Achado | Por quê |
|---|---|
| **vuln-0001** AGENT_KEY vazada | Já corrigido no commit `c274014` (11:55). O Strix escaneou às 11:18. Hoje o arquivo tem `COLOQUE_SUA_CHAVE_AQUI` e `config.Load()` recusa iniciar com o placeholder |
| **vuln-0007/0008** CVE-2026-33815/33816 no pgx | Não existem na base oficial `pkg.go.dev/vuln`. A descrição ("falha de memória CWE-787") está errada — a real é SQL Injection. Corrigido mesmo assim, ver §1.4 |
| **vuln-0010** chi `RedirectSlashes` | Não referenciado em nenhum ponto do código Go. O próprio Strix admite em "Assumptions" |
| **vuln-0013** lodash 4.17.21 | A árvore instalada tem **4.18.1**, acima do fix — o Strix leu o `bun.lock` desatualizado. Fora isso, `_.template` não é chamado em lugar nenhum e `npm audit` não acusa lodash |
| **vuln-0015/0016** postcss / nanoid | `devDependency` de build; não vão para o bundle. Corrigidos por higiene (§1.11), mas não eram risco de runtime |
| **vuln-0017** ws 8.18.3 | Não aparece na base de advisories do npm. Transitivo do supabase-js, sem import direto |
| **vuln-0014** reset-password-with-token | INFO no próprio relatório. Token é `crypto.randomUUID()`, uso único, expira. Rate limiting seria defesa em profundidade |

---

## 5. Onde o Strix errou

| | Strix disse | Realidade |
|---|---|---|
| **pgx** | Falha de memória (CWE-787) | **SQL Injection**, agravada pelo `SimpleProtocol` do projeto — prioridade subestimada |
| **chi** | `RedirectSlashes` (código morto) | `RealIP` — **em uso**, furava o rate limiting; não reportado |
| **lodash** | 4.17.21 vulnerável | Instalado é 4.18.1; leu lockfile obsoleto |
| **CRON_SECRET** | 1 ocorrência | 2 ocorrências |

---

## 6. Mudanças

```
 go.mod / go.sum                                   pgx v5.10.0, chi v5.3.1, x/text v0.39.0,
                                                   go 1.25.0, toolchain go1.26.5
 handler/router.go                        | 106 +  ClientIPFromXFFTrustedProxies, CORS allowlist,
                                                   autorizarCron fail-closed
 handler/mon_handlers.go                  |  86 +  escopo por empresa nos 8 endpoints
 lib/db.go                                |  57 +  UserScope + UserScopeByID
 lib/monitoring.go                        |  52 +  company_id nas queries agregadas
 handler/auth_handlers.go                 |  22 +  caminhoRelativoSeguro
 handler/fn_handlers.go                   |  13 +  senha CSPRNG de 16 chars
 handler/network_links_handlers.go        |  12 +  autorizarCron
 handler/ticket_handlers.go               |   9 +  requireAuth no resolve
 lib/helpers.go                           |  22 +  ClientIP via middleware validado
 scripts/audit.sh                         |  12 +  credencial → env var, fail-closed
 supabase/functions/.../index.ts          |  27 +  senha CSPRNG
 vercel.json                              |   1 +  installCommand fixado
 package.json / package-lock.json                  react-router 7.18.2, postcss, nanoid

 + supabase/migrations/20260812210000_scope_machine_commands_rls.sql
 + handler/router_security_test.go   (spoof de IP, CORS, cron fail-closed)
 + lib/scope_test.go                 (isolamento entre empresas)
 + docs/SECURITY-STRIX-2026-08-12.md
```

**Validação:** `go build` · `go vet` · `go test` · `govulncheck` (*No
vulnerabilities found*) · `tsc --noEmit` · `npm run build` · roteamento
verificado no navegador. Nada commitado.

## 7. Ordem sugerida

1. Rotacionar a senha do Supabase (§3.1) — é o que continua em aberto.
2. Conferir `CRON_SECRET` na Vercel (§3.3).
3. `supabase db push` para fechar o RCE cross-tenant (§3.2).
4. Deploy.
5. Depois, como tarefa própria: Vite 8 (§2) e o fluxo de senha provisória (§3.3).
