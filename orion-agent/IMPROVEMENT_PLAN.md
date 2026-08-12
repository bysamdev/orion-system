# Orion Agent — Plano consolidado de melhorias

> Consolida os achados de `ARCHITECTURE.md`, `SECURITY.md`,
> `SECURITY-AUTO-PROVISIONING.md`, `PERFORMANCE.md`, `TRAY-UX.md` e da suíte de
> testes recém-criada.
>
> **Status:** 10 de 37 itens implementados e aprovados até agora — A.6, A.7, A.8,
> B.1, B.2, B.3, B.5, B.11, B.12, C.1 (ver marcações ✅ abaixo). O restante
> continua sem tocar em código de produção; sigo aguardando aprovação **item a
> item** antes de qualquer alteração adicional.

---

## Estado atual verificado

| Item | Situação |
|---|---|
| `go vet ./...` | limpo |
| Suíte de testes | **91 testes, verde**, ~43 s (`go test ./... -count=1`) |
| Cobertura antes desta sessão | **zero** arquivos `_test.go` |
| `go test -race` | **não executável nesta máquina** — exige `CGO_ENABLED=1` + compilador C, e não há `gcc` instalado |

**Nota de transparência:** a suíte foi escrita na etapa anterior (autorizada por
você). Um agente do meu workflow deixou um arquivo experimental
`service/zz_probe_temp_test.go` (usava `unsafe`, auto-rotulado "temporário",
somava 5 s à suíte). **Removi esse arquivo** — era detrito do meu próprio
processo, não código seu. A suíte segue verde sem ele.

**Calibração importante sobre a data race:** ela está confirmada por **leitura
de código** (acesso concorrente não sincronizado é corrida pelo modelo de
memória do Go), mas **não** por execução do detector — o `-race` não roda aqui.
A sonda empírica que tentou observar corrupção **não conseguiu reproduzi-la**.
Trato como real, mas registro que a confirmação definitiva depende de rodar
`-race` numa máquina com toolchain C.

---

## 1. Todos os achados por severidade

### 🔴 Crítico (5)

| ID | Achado | Origem |
|---|---|---|
| C1 | `agent_key` de produção commitada em texto plano no `agent.yaml` (e em todo o histórico do git). Chave global compartilhada, sem rotação | SECURITY F3 |
| C2 | `machine-login` não exige `X-Agent-Key` nem qualquer credencial — só o `machine_token`, que é derivável. Concede sessão autenticada sem senha | SEC-AUTO §1.3 |
| C3 | `machine_token` não é segredo: é `SHA256(MachineGuid‖hostname‖MACs)`, e o `MachineGuid` é legível por **qualquer usuário local** (ACL padrão do Windows — verificado empiricamente) | SEC-AUTO §1.2 |
| C4 | Serviço roda como `LocalSystem` **+** canal RMM executa `cmd /C <string arbitrária>` sem allowlist → RCE como SYSTEM para quem tiver a chave de C1 | SECURITY F2 |
| C5 | `current_user`/`hostname` são autodeclarados, sem verificação contra AD. Heartbeat forjado + C2 permite criar identidade de suporte em empresa alvo | SEC-AUTO §2 |

### 🟠 Alto (13)

| ID | Achado | Origem |
|---|---|---|
| A1 | `machine_token` em texto plano em 3 lugares: arquivo, log do agente, e atalho `.url` no Desktop (reescrito a cada 30 s) | SECURITY F4 |
| A2 | Permissões `0600`/`0755` do Go **não criam ACL no Windows** — arquivos herdam ACL do pai (legível por `Usuários`). A proteção do `machine.token` é ilusória | SECURITY F5 |
| A3 | Sem enforcement de `https://` em `api_url` — o próprio default embutido é `http://`. Credenciais trafegariam em claro | SECURITY F6 / testes |
| A4 | URL de login com token gravada em log a cada clique na bandeja | SECURITY F7 |
| A5 | Token exposto em histórico do navegador, sincronização de perfil e **log de proxy corporativo com inspeção TLS** | TRAY-UX §2 |
| A6 | `wg.Wait()` sem timeout sobre I/O de disco: unidade de rede offline **congela o agente para sempre** e vaza goroutines | PERFORMANCE §2.2 |
| A7 | `executeCommand` sem timeout: um comando remoto travado congela o loop permanentemente | testes |
| A8 | **Data race** em `Svc.machineToken` — escrito pela goroutine do serviço, lido pelos callbacks da bandeja, sem mutex | testes |
| A9 | `PollCommands` faz `req, _ := http.NewRequest(...)` descartando o erro; `machineID` não é escapado na query. Resposta hostil/malformada do backend → **nil dereference → crash do processo** | testes |
| A10 | `GenerateToken` não é determinístico: ordem/estado das interfaces de rede muda a identidade. Impacto no enrollment e se o token em disco for perdido → **máquina duplicada no RMM** | testes |
| A11 | Fallback silencioso "vincula à primeira empresa do banco" quebra isolamento multi-tenant | ARCHITECTURE 6.7 |
| A12 | `os.Exit(0)` do menu "Sair" pula todos os `defer` — pode matar o agente no meio de uma escrita do arquivo de identidade | testes / PERFORMANCE §2.4 |
| A13 | Clique na bandeja é **no-op silencioso** antes do primeiro heartbeat: nenhum feedback, até 30 s após o boot | TRAY-UX §3 |

### 🟡 Médio (12)

| ID | Achado | Origem |
|---|---|---|
| M1 | Distribuição via GPO copia `.exe`/config de share SMB sem verificar hash nem assinatura Authenticode | SECURITY F8 |
| M2 | Texto integral de comandos RMM gravado em log (pode conter segredo embutido) | SECURITY F9 |
| M3 | `cpu.Percent(1s)` bloqueia 1,0 s por coleta (88,7 % do tempo de parede) | PERFORMANCE §3.1 |
| M4 | `cpu.Info()` (44,5 ms) e `net.Interfaces` chamado 2× (81,9 ms) = 99,5 % do CPU real desperdiçado em dados estáticos/redundantes | PERFORMANCE §3.1 |
| M5 | Atalho do Desktop reescrito a cada tick — ~2.880 gravações/dia sem necessidade | PERFORMANCE §3.5 |
| M6 | Retry sem backoff exponencial nem jitter: bloqueia `tick()` até 65 s e causa thundering herd na frota | PERFORMANCE §2.3 |
| M7 | Sem proteção contra duas instâncias — serviço + interativo rodam juntos e **comandos remotos podem executar 2×** | PERFORMANCE §2.5 |
| M8 | `redirect_to` relativo passado ao Supabase (que exige URL absoluta) → "Abrir Chamado" provavelmente cai na home | TRAY-UX §1 |
| M9 | Latência do clique: ≥4 round-trips server-side + 2 redirects + carga do SPA, em série. Improvável ficar <1 s em cold start | TRAY-UX §3 |
| M10 | `doPost` descarta erro de decode JSON → resposta corrompida vira sucesso com `machineID` vazio, matando o RMM silenciosamente | testes |
| M11 | Build quebra fora do Windows (pacote `shortcut` só tem `_windows.go`) — impede CI em Linux | testes |
| M12 | `yaml.Unmarshal` não-estrito: um typo em `api_url` é ignorado e degrada silenciosamente para `http://localhost:8080` | testes |

### 🟢 Baixo (7)

| ID | Achado | Origem |
|---|---|---|
| B1 | Sem certificate pinning (depende só do trust store do SO) | SECURITY F10 |
| B2 | `LoadToken` sem `TrimSpace` — newline no arquivo corrompe o token | testes |
| B3 | `cfg.LogFile` é parseado e defaultado mas **nunca usado** — configuração morta | testes |
| B4 | Default de `APIURL` vazio grava a URL completa de heartbeat, quebrando `GetPortalURL`/`GetTicketURL` | testes |
| B5 | `token.go` usa `io/ioutil`, depreciado desde Go 1.16 | testes |
| B6 | Ordem de `Payload.Disks` não determinística (append por ordem de conclusão de goroutine) | testes |
| B7 | Ícone da bandeja é placeholder (quadrado azul 16×16); binário `.exe` versionado no git | ARCHITECTURE 6.3/6.9 |
| B8 | `systray-agent/` é protótipo órfão, código morto | ARCHITECTURE 6.1 |

---

## 2. Fases

Legenda — **Esforço:** baixo (<2 h) · médio (0,5–2 dias) · alto (>2 dias / projeto próprio).
**Risco de regressão:** probabilidade de quebrar comportamento existente.

### Fase A — Segurança urgente

| # | Item | IDs | Esforço | Risco | Observação |
|---|---|---|---|---|---|
| A.1 | Rotacionar `agent_key`; remover do histórico do git; migrar para chaves por empresa | C1 | médio | **baixo** | Não muda código; é operação de credencial + deploy. Fazer primeiro |
| A.2 | Exigir credencial em `machine-login` | C2 | baixo | médio | Backend. Quebra o atalho `.url` atual até A.6 — coordenar |
| A.3 | Rate limiting + alerta em `machine-login` e `heartbeat` | C2 | médio | baixo | Mitigação enquanto A.6 não sai |
| A.4 | Reduzir privilégio do serviço (conta virtual em vez de `LocalSystem`) | C4 | médio | **alto** | Pode quebrar coleta que dependa de SYSTEM. Exige teste em máquina real |
| A.5 | Allowlist de comandos no `executeCommand` | C4 | médio | **alto** | Muda contrato do RMM; comandos livres deixam de funcionar. Decisão de produto |
| A.6 ✅ | Substituir `machine_token` derivado por segredo aleatório + DPAPI + ACL explícita | C3, A1, A2 | alto | **alto** | **Implementado junto com B.5** (aprovado). `token.GenerateRandomIdentity` (crypto/rand) + DPAPI (`CRYPTPROTECT_LOCAL_MACHINE`) + ACL via `icacls` (SYSTEM+Administradores+criador) + ponte de migração para tokens legados em texto plano. Ver `MACHINE-IDENTITY-OPTIONS.md` |
| A.7 ✅ | Enforcement de `https://` em `config.Load` | A3 | **baixo** | baixo | Implementado e testado |
| A.8 ✅ | Redigir token de logs e da URL logada | A4 | **baixo** | baixo | Implementado e testado (`redigirQuery` em `main.go`) |
| A.9 | Remover fallback "primeira empresa do banco" | A11 | baixo | médio | Backend. Máquinas órfãs passam a falhar visivelmente (é o desejado) |
| A.10 | Validar hash/Authenticode no script de GPO | M1 | baixo | baixo | Só o `.ps1` |
| A.11 | Não logar texto integral de comandos RMM | M2 | baixo | baixo | |
| A.12 | Enrollment com certificado por máquina (mTLS) | C3, C5 | **alto** | **alto** | Projeto próprio. Depende de A.6 |
| A.13 | SID do usuário via API do Windows em vez de `os.Getenv` | C5 | alto | médio | Depende de decidir o modelo de identidade |

### Fase B — Eficiência e confiabilidade

| # | Item | IDs | Esforço | Risco | Ganho medido |
|---|---|---|---|---|---|
| B.1 ✅ | Timeout nas goroutines de disco (`disk.UsageWithContext`) | A6 | **baixo** | baixo | Implementado e testado |
| B.2 ✅ | Timeout no `executeCommand` (`exec.CommandContext`) | A7 | **baixo** | baixo | Implementado e testado |
| B.3 ✅ | Corrigir `req, _ :=` e escapar `machineID` em `PollCommands` | A9 | **baixo** | baixo | Implementado e testado (`url.Values`) |
| B.4 | Mutex/atomic em `Svc.machineToken` e `machineID` | A8 | baixo | baixo | Confirmar com `-race` em máquina com toolchain C. **Não aprovado ainda** |
| B.5 ✅ | Substituir `GenerateToken` (removida) por identidade aleatória persistida | A10, B6 | baixo | médio | **Implementado junto com A.6** — não foi "tornar determinístico", foi trocar o mecanismo por inteiro (ver Opção A de `MACHINE-IDENTITY-OPTIONS.md`). `Payload.GenerateToken` removida de `collector/hardware.go` |
| B.6 | `cpu.Percent(0)` não-bloqueante | M3 | baixo | **médio** | **−1000 ms de parede/coleta.** Muda semântica da métrica — commit próprio |
| B.7 | Cachear `cpu.Info` + `net.Interfaces` 1× por coleta | M4 | baixo | baixo | **−50 % de CPU real (127 ms → 63 ms, medido)** |
| B.8 | Só reescrever atalho quando o conteúdo mudar | M5 | **baixo** | baixo | −2.880 gravações/dia |
| B.9 | Backoff exponencial + jitter no retry | M6 | baixo | baixo | Evita bloqueio de 65 s e thundering herd |
| B.10 | Named mutex (instância única) + saída limpa sem `os.Exit` | M7, A12 | baixo | médio | Elimina execução dobrada de comandos |
| B.11 ✅ | Tratar erro de decode em `doPost` | M10 | **baixo** | baixo | Implementado e testado |
| B.12 ✅ | `TrimSpace` no `LoadToken` + trocar `io/ioutil` | B2, B5 | **baixo** | baixo | Implementado e testado |
| B.13 | `KnownFields(true)` no parse do YAML | M12 | baixo | médio | Typos passam a ser erro — é o desejado, mas pode quebrar config existente |
| B.14 | Stub `shortcut_other.go` para destravar CI em Linux | M11 | baixo | baixo | Habilita CI e `-race` em runner Linux |
| B.15 | Usar ou remover `cfg.LogFile`; corrigir default de `APIURL` | B3, B4 | baixo | baixo | |
| B.16 | Certificate pinning | B1 | médio | médio | Defesa em profundidade; opcional |

### Fase C — UX (fluxo do clique e feedback visual)

| # | Item | IDs | Esforço | Risco | Observação |
|---|---|---|---|---|---|
| C.1 ✅ | Feedback quando `machineToken` está vazio (balão "aguardando primeiro check-in") | A13 | **baixo** | **baixo** | Implementado e testado |
| C.2 | Ícone da bandeja refletir estado real (ok / sem conexão / inicializando) | B7 | médio | baixo | Resolve "bandeja diz Suporte Ativo com monitoramento morto" |
| C.3 | Corrigir `redirect_to` para URL absoluta | M8 | baixo | baixo | Confirmar em homologação antes |
| C.4 | Token efêmero de uso único, pré-emitido em background | A5, A1 | alto | **alto** | Depende de A.6/A.12. Mantém clique instantâneo |
| C.5 | Reduzir latência server-side do `machine-login` (paralelizar queries, `UpdateProfile` em background) | M9 | médio | médio | Backend |
| C.6 | Ícone definitivo do produto | B7 | baixo | baixo | Cosmético |
| C.7 | Remover `systray-agent/` órfão | B8 | **baixo** | **baixo** | Confirmar que não há plano de retomada |

**Decisão já tomada (TRAY-UX §4):** manter o **navegador padrão**, não migrar
para webview embutida. Nenhum item acima depende de webview.

---

## 3. Sequência recomendada

Respeitando "commits pequenos e testáveis" e "não misturar refino visual com
lógica de backend":

1. ✅ **Ganhos altos, risco baixo, isolados** — A.7, A.8, B.1, B.2, B.3, B.11, B.12, C.1.
   **Feito.** Todos implementados e testados.
2. ✅ **Identidade da máquina** — A.6 + B.5, implementados juntos conforme exigido
   (mesmo commit/diff, migração de tokens legados incluída). **Feito.**
3. **Operacional, sem código** — A.1 (rotação de chave), A.10 (GPO). Ainda pendente.
4. **Infra de teste** — B.14, para destravar CI em Linux e finalmente rodar `-race`,
   confirmando B.4 empiricamente.
5. **Performance com mudança de semântica** — B.6, B.7, B.8, B.9, cada um em commit
   próprio, medindo antes/depois com o benchmark descrito em `PERFORMANCE.md` §6.
6. **Decisões de produto/arquitetura restantes** — A.4, A.5, A.12, A.13, C.4.
   Nenhuma deve começar sem definição sua; A.12 agora pode se apoiar no enrollment
   de identidade já implementado em A.6.

---

## 4. Dependências entre itens (o que não pode ser feito isolado)

- **A.2 quebra o atalho `.url`** enquanto C.4 não existir → aprovar em conjunto ou
  aceitar que o atalho pare de funcionar temporariamente.
- ~~B.5 muda o valor do `machine_token` → executar junto de A.6~~ **Resolvido:**
  A.6 e B.5 foram implementados juntos, com ponte de migração para tokens
  legados (o `machine_token` de máquinas já instaladas continua sendo
  reconhecido — ver `token/token.go:loadTokenFrom`).
- **C.4 depende de A.6/A.12** → A.6 (a parte de identidade de dispositivo) já
  está pronta; falta A.12 (enrollment com certificado) antes de implementar o
  token efêmero.
- **B.4 só é verificável** depois de B.14 (ou de instalar toolchain C nesta máquina).

---

## 5. Histórico de aprovações

Não toco em código de produção sem aprovação explícita, item a item.

**Lote 1 (aprovado e implementado):** A.7, A.8, B.1, B.2, B.3, B.11, B.12, C.1.
Eliminou dois caminhos de congelamento permanente do agente (B.1, B.2), um
crash de processo (B.3), o no-op silencioso da bandeja (C.1) e duas exposições
de credencial (A.7, A.8).

**Lote 2 (aprovado e implementado):** A.6 + B.5, no mesmo diff, com ponte de
migração para a frota já instalada — conforme exigido antes de qualquer um dos
dois entrar em código. Detalhes das opções avaliadas e da decisão em
`MACHINE-IDENTITY-OPTIONS.md`.

**Ainda sem aprovação:** todo o restante do plano — seções 2 e 3 seguem
descrevendo o que falta e a sequência sugerida.
