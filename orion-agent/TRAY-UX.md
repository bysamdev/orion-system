# Orion Agent — Clique na bandeja: caminho atual, exposição de identidade e latência

> Relatório de análise. **Nada foi implementado** — o item 4 (navegador padrão
> vs. webview) traz uma recomendação com justificativa, aguardando sua
> aprovação antes de qualquer mudança de código.

---

## 1. Navegador padrão ou webview embutida?

**É o navegador padrão do sistema. Não existe webview no agente.**

Cadeia confirmada:

`tray/tray.go` → `OpenURL()` → `github.com/pkg/browser` → no Windows:

```go
// pkg/browser@v0.0.0-20240102092130/browser_windows.go
func openBrowser(url string) error {
	return windows.ShellExecute(0, nil, windows.StringToUTF16Ptr(url), nil, nil, windows.SW_SHOWNORMAL)
}
```

`ShellExecute` com um verbo nulo delega ao handler de protocolo registrado
para `https://` — ou seja, **o navegador padrão do usuário**, com o perfil,
extensões, cookies e histórico dele. O `go.mod` confirma: não há nenhuma
dependência de webview (`webview/webview_go`, `go-webview2`, CEF, etc.). O
agente é Go puro, sem CGO.

### Como a URL/sessão é passada

Não há cookie nem token temporário. É **query param com credencial
persistente**, seguido de uma cadeia de dois redirects:

```
1. Agente monta em memória (service/windows.go):
   https://orion.bysam.dev/api/auth/machine-login?token=<machine_token>
   (+ &redirect_to=/novo-ticket no item "Abrir Chamado")

2. ShellExecute abre essa URL no navegador padrão.

3. Backend (handler/auth_handlers.go:machineLogin):
   - db.MachineByToken(token)          → identifica a máquina
   - db.AuthUserIDByEmail(...)         → acha/cria o usuário-fantasma
   - [se 1ª vez] sb.AdminCreateUser()  → chamada HTTP à Admin API do Supabase
   - db.UpdateProfile(...)
   - sb.AdminGenerateLink(magiclink)   → chamada HTTP à Admin API do Supabase
   - http.Redirect(307) → action_link

4. Navegador segue para o Supabase (/auth/v1/verify?token=<otp>&type=magiclink...)

5. Supabase valida o OTP e redireciona para o app, entregando a sessão
   (access/refresh token) para o Supabase JS no frontend.
```

O `machine_token` é a credencial que carrega tudo. Ele é **persistente e não
expira** (mesmo valor por instalação, gravado em
`C:\ProgramData\OrionAgent\machine.token`) e, conforme já documentado em
`SECURITY-AUTO-PROVISIONING.md` §1.2, é **derivável** de dados não secretos.

### Bug funcional provável encontrado no caminho

`auth_handlers.go` passa um caminho **relativo** para o Supabase:

```go
redirectTo := r.URL.Query().Get("redirect_to")
if redirectTo == "" || !strings.HasPrefix(redirectTo, "/") { redirectTo = "/" }
...
loginLink, err := sb.AdminGenerateLink(r.Context(), lib.GenerateLinkInput{
	Type: "magiclink", Email: machineEmail,
	RedirectTo: redirectTo,   // "/novo-ticket" — caminho relativo
})
```

O `redirect_to` do GoTrue/Supabase espera **URL absoluta** e a valida contra
a allowlist de redirect URLs do projeto; um caminho relativo tipicamente
falha na validação e cai no `SITE_URL` padrão. Se for o caso, **"Abrir
Chamado" leva à home em vez de `/novo-ticket`** — o menu tem dois itens que
fazem a mesma coisa na prática.

Não confirmei contra o Supabase real (exigiria disparar um login de produção),
então marco como **provável, a confirmar em homologação**. É barato de
verificar: clicar em "Abrir Chamado" e ver onde a página aterrissa.

---

## 2. Exposição da identidade via URL

Sim, e em mais lugares do que só o histórico. Como o `machine_token` **não
expira e não é de uso único**, cada exposição abaixo é uma credencial válida
para sempre, replayável por quem a obtiver:

| Vetor | Exposição | Gravidade |
|---|---|---|
| **Histórico do navegador** | `machine-login?token=…` fica gravado permanentemente no perfil do usuário | Alta — em máquina compartilhada, o próximo usuário replay-a o token |
| **Sincronização de perfil** | Histórico sincronizado para conta Google/Microsoft sai do controle da empresa | Alta |
| **Proxy corporativo / inspeção TLS** | Query strings são registradas em log de proxy — comum em parque AD com MITM corporativo | Alta |
| **Log do agente** | `logger.Printf("[TRAY] Abrindo portal: %s", url)` grava a URL completa (já em `SECURITY.md` F7) | Alta |
| **Atalho `.url` no Desktop** | Token em texto plano, reescrito a cada 30 s (já em `SECURITY.md` F4) | Alta |
| **Header `Referer`** | Pode propagar a URL de origem para requisições subsequentes | Média |

A parte da cadeia que **já está correta**: o magic link do Supabase (passo 4)
é de uso único e curta duração, e o access token final trafega no *fragmento*
da URL (`#access_token=…`), que não é enviado ao servidor. O elo fraco é
exclusivamente o **primeiro** salto — o `machine_token` persistente.

### Método proposto: token efêmero de uso único, sem sacrificar a latência

O desafio é que a solução óbvia (pedir um token ao backend no momento do
clique) adiciona uma chamada de rede **antes** de abrir o navegador,
conflitando com o requisito de clique instantâneo do item 3.

Proposta que resolve os dois ao mesmo tempo — **token pré-emitido rotativo**:

1. O agente mantém em memória um *one-time token* de curta duração (60–120 s),
   obtido do backend **proativamente em background**, junto do heartbeat que
   já acontece a cada 30 s. Custo adicional: zero chamadas extras no clique.
2. No clique, o agente usa o token já em cache → abre o navegador
   **imediatamente**, sem rede no caminho crítico.
3. O backend troca esse token por sessão **no primeiro request** e o invalida
   (consumo único). Se vazar em histórico/proxy/log, já está morto.
4. Fallback: se o cache estiver vazio ou expirado (ex.: agente recém-iniciado,
   backend fora do ar), buscar sincronamente **com feedback visual** — hoje
   esse caso é um no-op silencioso (ver §3).

Isso mantém a exposição nas mesmas superfícies, mas o que vaza passa a ser
inútil segundos depois. Deve ser combinado com a autenticação de dispositivo
proposta em `SECURITY-AUTO-PROVISIONING.md` §4.1 — o endpoint que **emite**
o one-time token precisa exigir prova de posse da máquina, senão apenas
desloca o problema.

---

## 3. Latência do clique

### No agente: já é instantâneo (nenhuma chamada de rede)

```go
func (s *Svc) GetPortalURL() string {
	if s.machineToken == "" { return "" }
	return fmt.Sprintf("%s/api/auth/machine-login?token=%s", s.cfg.APIURL, s.machineToken)
}
```

Só leitura de campo em memória + `fmt.Sprintf`, seguido de `ShellExecute`
(que retorna assim que o shell aceita a requisição, sem esperar o navegador
renderizar). **Não há etapa síncrona bloqueante no lado do agente** — este é
um ponto que o desenho atual acerta.

### O tempo real está no servidor, e provavelmente estoura o alvo de <1 s

Decompondo o que acontece **depois** do `ShellExecute`, até a página aparecer:

| Etapa | Natureza |
|---|---|
| Cold start da função serverless Go no Vercel | centenas de ms a alguns segundos, se fria |
| `db.MachineByToken` | round-trip Postgres (pooler Supabase) |
| `db.AuthUserIDByEmail` | round-trip Postgres |
| `sb.AdminCreateUser` *(só no 1º acesso)* | round-trip HTTP à Admin API |
| `db.UpdateProfile` | round-trip Postgres |
| `sb.AdminGenerateLink` | round-trip HTTP à Admin API |
| Redirect 307 → Supabase `/auth/v1/verify` | round-trip navegador |
| Redirect Supabase → app | round-trip navegador |
| Carga do bundle do SPA React + hidratação | depende do bundle |

São **no mínimo 4 round-trips server-side sequenciais + 2 redirects de
navegador + carga do SPA**, tudo em série, antes de qualquer pixel útil.
Não medi esses tempos (exigiria disparar logins reais contra produção), mas
a estrutura torna implausível ficar abaixo de 1 s em caso de função fria —
e o primeiro clique do dia é, por definição, o mais provável de pegar cold
start.

**Oportunidades claras, sem mudar arquitetura:**
- `db.AuthUserIDByEmail` + `db.UpdateProfile` + `AdminGenerateLink` são
  sequenciais mas parcialmente paralelizáveis; o `UpdateProfile` do caminho
  "usuário já existe" nem precisa bloquear o redirect (pode ir para
  background).
- O `UpdateProfile` roda **a cada login**, mesmo sem nada ter mudado.

### Falha de UX mais visível hoje: no-op silencioso

```go
url := svc.GetPortalURL()
if url != "" { tray.OpenURL(url); ... }
// se url == "" → nada acontece, nem log de aviso ao usuário
```

Se o clique acontece antes do primeiro heartbeat concluir (instalação nova,
máquina recém-ligada, backend fora do ar), `machineToken` está vazio e o
**clique simplesmente não faz nada** — sem balão, sem erro, sem mudança no
ícone. O usuário clica de novo, e de novo. Com o intervalo de 30 s da
`agent.yaml`, essa janela pode durar até meio minuto após o boot.

Somando com §2.3 e §2.4 do `PERFORMANCE.md` (retry pode bloquear `tick()` por
até 65 s), a janela de "clique morto" pode ser bem maior num cenário de rede
instável.

---

## 4. Recomendação: navegador padrão vs. webview embutida

**Recomendo manter o navegador padrão** e investir o esforço no token efêmero
(§2) em vez de trocar o mecanismo de abertura. Justificativa:

### A favor do navegador padrão (situação atual)
- **Custo de manutenção zero.** O agente segue Go puro, sem CGO,
  cross-compilando trivialmente. Adicionar WebView2 traz CGO e complica build
  e distribuição.
- **Consistência visual já é garantida** — é o mesmo app React servido pelo
  Vercel nos dois casos. O argumento de "consistência com o Orion System" não
  distingue as opções: a webview mostraria exatamente a mesma UI.
- **Superfície de segurança menor.** Patches de renderização/JS ficam a cargo
  do fornecedor do navegador, não do agente. Uma webview embutida vira mais
  uma dependência para acompanhar CVE.
- **Compatibilidade com SSO futuro.** Provedores de identidade (Google, e
  cada vez mais o Entra ID) **bloqueiam fluxos OAuth em webviews embutidas**.
  Se o Orion System evoluir para SSO real contra AD/Entra — que é a
  recomendação P3 de `SECURITY-AUTO-PROVISIONING.md` — uma webview embutida
  seria um beco sem saída.
- Acessibilidade, zoom, tradução, gerenciador de senhas e políticas
  corporativas de navegador continuam funcionando.

### A favor da webview (e por que não compensa)
- **Isolamento de sessão em máquina compartilhada** — a sessão não persistiria
  no perfil do navegador do usuário. É a única vantagem real, e ela é melhor
  resolvida pelo token de curta duração + sessão efêmera do §2, que é
  necessário de qualquer forma.
- **Esconder a URL** (sem barra de endereço) — mitigaria a exposição visual do
  token, mas não o histórico, nem o log de proxy, nem o arquivo `.url`.
  Novamente: o token efêmero resolve a causa, a webview só esconde o sintoma.
- **Custo real:** WebView2 depende do Evergreen Runtime. Presente por padrão
  no Windows 11 e no Win10 moderno, mas **precisa ser verificado e
  bootstrapped** em máquinas mais antigas de parque corporativo — exatamente
  o cenário de implantação por GPO deste agente.

### Se quiser mesmo controle de janela
Existe um meio-termo mais barato que a webview: abrir o navegador padrão em
modo app/janela dedicada (`--app=<url>` no Chrome/Edge) quando disponível,
com fallback para `ShellExecute`. Dá aparência de janela dedicada sem
introduzir CGO nem runtime novo. Mas isso passa a depender de detectar qual
navegador está instalado, o que adiciona sua própria fragilidade — só vale se
"parecer um app" for requisito explícito de produto.

---

## 5. Se você aprovar, o que eu implementaria (em ordem)

Commits pequenos e separados, conforme as regras do projeto — refino de UX
separado de mudança de lógica de backend:

1. **Corrigir o no-op silencioso** (§3): balão/tooltip informando "aguardando
   primeiro check-in" quando `machineToken` está vazio. Isolado, só no agente,
   sem tocar backend. É o maior ganho de percepção por menor risco.
2. **Confirmar e corrigir o `redirect_to`** (§1): passar URL absoluta ao
   Supabase para "Abrir Chamado" realmente abrir `/novo-ticket`. Mudança no
   backend, precisa de teste em homologação.
3. **Redigir o token dos logs** (§2, já detalhado em `SECURITY.md` F7).
4. **Token efêmero de uso único pré-emitido** (§2): mudança maior, envolve
   novo endpoint no backend + cache no agente. Merece seu próprio ciclo de
   revisão e depende de decidir antes o modelo de autenticação de dispositivo
   (`SECURITY-AUTO-PROVISIONING.md` §4.1) — implementar o token efêmero sobre
   a `X-Agent-Key` atual só desloca o problema.

**Nenhum desses itens está implementado.** Me diga quais aprova (e se
concorda com manter o navegador padrão) que eu sigo — sugiro começar pelos
itens 1 e 3, que são de baixo risco e não dependem das decisões maiores de
arquitetura de confiança.
