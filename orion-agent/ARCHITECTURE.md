# Orion Agent (Go) — Mapeamento do Estado Atual

> Documento de **levantamento**, não de correção. Nada foi alterado no código.
> Escopo: `orion-agent/` (agente Windows atual) + pontos de contato no backend
> (`handler/`, `lib/`) necessários para entender o fluxo ponta a ponta.
> Também cobre `systray-agent/`, um segundo diretório de agente encontrado no repo.

---

## 0. Resumo executivo

O Orion Agent é um serviço Windows (Go) que roda em segundo plano nas máquinas
dos clientes, coleta métricas de hardware, envia heartbeats para o backend
(`orion-system` no Vercel), permite execução remota de comandos simples (RMM) e
oferece um ícone de bandeja com atalhos de login "sem senha" para o portal.

Existem **dois diretórios de agente no repositório**:

| Diretório | Estado | Observação |
|---|---|---|
| `orion-agent/` | **Ativo**, com `.exe` versionado, usado em produção (`agent.yaml` aponta para `orion.bysam.dev`) | É o que este relatório detalha |
| `systray-agent/` | **Órfão / protótipo abandonado** | Ver seção 6.1 |

---

## 1. Arquivos e pacotes — o que cada um faz

```
orion-agent/
├── main.go                     # entrypoint: logging, carga de config, install/uninstall
│                                # do serviço Windows, decide entre modo serviço x modo tray
├── agent.yaml                  # config real, COMMITADA COM SEGREDO EM TEXTO PLANO (ver 6.2)
├── go.mod / go.sum
├── orion-agent.exe             # binário compilado, versionado no git (ver 6.3)
│
├── config/
│   └── config.go                # struct Config; Load() lê/cria orion-agent/agent.yaml
│                                 # ao lado do .exe; valida agent_key obrigatório
│
├── collector/
│   └── hardware.go              # coleta CPU/RAM/disco/rede/uptime via gopsutil;
│                                 # monta o Payload do heartbeat; GenerateToken()
│                                 # (SHA-256 de UUID+hostname+MACs) — identidade da máquina
│
├── sender/
│   └── api.go                   # HTTP client: Send() (heartbeat, com retry 3x/10s),
│                                 # PollCommands() e RespondToCommand() (canal RMM)
│
├── service/
│   └── windows.go                # implementa service.Interface (kardianos/service):
│                                  # Start/Stop, loop principal (run), tick() de heartbeat,
│                                  # pollAndExecuteCommands() (executa via cmd /C),
│                                  # GetPortalURL()/GetTicketURL() (montagem da URL de login)
│
├── shortcut/
│   └── shortcut_windows.go       # cria/atualiza um atalho .url na Área de Trabalho
│                                  # do usuário logado, apontando para o portal
│
├── token/
│   └── token.go                  # persiste o "machine token" em
│                                  # C:\ProgramData\OrionAgent\machine.token (0600)
│
├── tray/
│   ├── tray.go                    # ícone de bandeja (getlantern/systray): menu
│   │                               # "Abrir Portal", "Abrir Chamado", "Sair"
│   └── icon.go                    # ícone PNG 16x16 embutido em bytes (placeholder)
│
└── deploy/
    └── gpo_install.ps1            # script de instalação via GPO (Startup Script)
```

Dependências principais (`go.mod`): `kardianos/service` (serviço Windows),
`getlantern/systray` (bandeja), `shirou/gopsutil/v3` (métricas de hardware),
`pkg/browser` (abrir URL no navegador padrão), `gopkg.in/yaml.v3` (config).

---

## 2. Fluxo completo

### 2.1 Inicialização (`main.go`)

1. Abre/roda log em `agent.log` (mesma pasta do `.exe`), com fallback para stderr
   se não conseguir criar o arquivo.
2. `config.Load()` lê `agent.yaml` ao lado do executável. Se o arquivo não
   existir, **cria um novo com valores padrão** e retorna erro pedindo para o
   operador configurar `agent_key` antes de continuar (`agent_key` vazio ou
   igual ao placeholder `COLOQUE_SUA_CHAVE_AQUI` é tratado como erro fatal).
3. Registra o processo como serviço Windows via `kardianos/service`
   (`service.ServiceConfig()` define nome `OrionAgent`).
4. Trata argumentos de linha de comando:
   - `install` → `s.Install()` e sai.
   - `uninstall` → `s.Uninstall()` e sai.
   - nenhum argumento:
     - Se **não interativo** (`!service.Interactive()`, ou seja, rodando como
       serviço real do Windows/SYSTEM) → `s.Run()` bloqueante, sem tray.
     - Se **interativo** (executado por clique duplo/atalho de um usuário
       logado) → dispara `s.Run()` em goroutine (o "motor" de coleta) e
       **em paralelo** sobe o ícone de bandeja (`tray.New(...).Run()`), que é
       quem realmente segura o processo vivo nesse modo.

Ou seja: **o mesmo binário e o mesmo `Svc` fazem duas coisas em paralelo**
dependendo de como foi iniciado — como serviço de SYSTEM (sem tray, sem
interação de usuário) OU como processo interativo com tray. Isso é relevante
para a seção de detecção de usuário (2.2) e para a lista de gambiarras (seção 6).

### 2.2 Detecção do usuário do Windows / AD

Não existe nenhuma integração real com Active Directory (LDAP/Kerberos/WMI de
domínio). A "detecção" é inteiramente baseada em **variáveis de ambiente do
processo**, lidas uma vez a cada ciclo de coleta em `collector/hardware.go`:

```go
domain := os.Getenv("USERDOMAIN")
if domain == "" { domain = os.Getenv("USERDNSDOMAIN") }
if domain == "" { domain = "WORKGROUP" }

currentUser := os.Getenv("USERNAME")
if currentUser == "" { currentUser = os.Getenv("USER") }
```

Consequência importante: **quando o agente roda como serviço Windows (SYSTEM)**,
essas variáveis de ambiente são as do contexto do serviço, não do usuário
interativo logado na sessão gráfica. Na prática:
- `USERNAME` tende a ser `SYSTEM` (ou o nome da conta de serviço), não o usuário
  humano que está de fato usando a máquina.
- `USERDOMAIN`/`USERDNSDOMAIN` idem — refletem o contexto da conta de serviço,
  não necessariamente o domínio AD do usuário logado.

Ou seja, o cenário em que a detecção de usuário "funciona corretamente"
(mostrando o usuário humano real) é justamente o modo **interativo com tray**
(seção 2.1), porque aí o processo herda o ambiente da sessão do usuário
logado. Rodando puramente como serviço, o valor reportado tende a ser genérico.
Isso não está sinalizado em lugar nenhum do código — é um comportamento
implícito da plataforma que o agente não trata.

### 2.3 Comunicação com o Orion System (backend)

**Protocolo:** HTTP/HTTPS + JSON. Autenticação por header estático
`X-Agent-Key`, validado pelo backend contra:
1. uma chave global fixa (`AGENT_KEY` no ambiente do Vercel, igual ao
   `agent_key` do `agent.yaml`), OU
2. uma chave dinâmica por empresa na tabela `public.api_keys`
   (`lib.ValidateAgentKey` → `db.ValidateAPIKey`).

Não há mTLS, não há assinatura de payload, não há rotação de chave automática.

**Endpoints consumidos pelo agente** (todos relativos a `cfg.APIURL`,
`orion.bysam.dev` em produção):

| Endpoint | Método | Quando | Handler |
|---|---|---|---|
| `/api/monitoring/machines/heartbeat` | POST | a cada `interval_seconds` (padrão 60/30) | `mon_handlers.go:monitoringHeartbeat` |
| `/api/monitoring/commands/poll?machine_id=` | GET | a cada 30s fixos | `mon_handlers.go:monitoringPollCommands` |
| `/api/monitoring/commands/respond` | POST | após executar um comando recebido | `mon_handlers.go:monitoringCommandResponse` |
| `/api/auth/machine-login?token=&redirect_to=` | GET (aberto no navegador, não pelo processo do agente) | clique no menu da bandeja | `auth_handlers.go:machineLogin` |

**Ciclo principal** (`service/windows.go:run`, dentro da goroutine iniciada por
`Start`):
- dois `time.Ticker` independentes: um para heartbeat (`cfg.IntervalSeconds`) e
  um fixo de 30s para polling de comandos;
- na primeira execução, `tick()` roda imediatamente (sem esperar o primeiro
  tick do ticker);
- `tick()` faz, nessa ordem: coleta hardware → resolve/gera o `machine_token`
  local (ver 2.3.1) → recria o atalho do desktop → `sender.Send()` (heartbeat,
  com até 3 tentativas e 10s entre elas) → guarda o `machine_id` retornado
  pelo backend em memória (`s.machineID`), usado depois pelo polling de
  comandos;
- `pollAndExecuteCommands()` só funciona **depois** de pelo menos um heartbeat
  bem-sucedido, pois depende de `s.machineID` (se vazio, a função retorna sem
  fazer nada — ver 6.4).

**Comandos remotos (RMM):** o backend guarda comandos "pending" por máquina
(`public.machine_commands`), criados por um técnico via
`POST /api/monitoring/machines/{id}/commands` (autenticado por sessão de
usuário, exige role admin/technician/developer). O agente faz *polling* (não
há push/WebSocket), executa via `cmd /C <command>` (`executeCommand`,
`os/exec`) e reporta status/saída de volta.

#### 2.3.1 Identidade da máquina (`machine_token`)

- No primeiro heartbeat, o agente tenta carregar um token salvo em
  `C:\ProgramData\OrionAgent\machine.token`. Se não existir, gera um novo via
  `Payload.GenerateToken()` = `SHA256(machine_uuid|hostname|MACs concatenados)`
  e salva no arquivo (permissão 0600).
- Esse token é enviado em todo heartbeat e é a chave usada pelo backend
  (`ON CONFLICT (machine_token) DO UPDATE`) para fazer upsert da máquina — é
  o que garante que reinstalar o agente na mesma máquina não crie um registro
  duplicado.
- O mesmo token é reaproveitado para autenticação "passwordless" no portal
  (seção 3).

### 2.4 O que acontece ao clicar no ícone da bandeja

Definido em `tray/tray.go`, com os callbacks vindos de `main.go`:

- **"Abrir Portal de Suporte"** → `svc.GetPortalURL()` monta
  `{api_url}/api/auth/machine-login?token={machine_token}` e abre no navegador
  padrão (`pkg/browser`). Se `machine_token` ainda estiver vazio (nenhum
  heartbeat concluído ainda), a URL retorna `""` e **nada acontece** — não há
  feedback visual para o usuário nesse caso, só uma linha de log.
- **"Abrir Chamado"** → mesma URL de login, mas com
  `&redirect_to=/novo-ticket`, para cair direto na criação de ticket após
  autenticar.
- **"Sair"** → `os.Exit(0)` imediato. Isso mata o processo *tray* mas, se o
  serviço Windows `OrionAgent` também estiver rodando separadamente
  (instalado via `install`), ele continua ativo — "Sair" só encerra a
  instância interativa que o usuário abriu manualmente.

O clique não fala diretamente com o backend; ele só monta uma URL local a
partir do que já está em memória (`machineToken`) e delega ao navegador.

---

## 3. Como o agente "cria um novo usuário" no Orion System

O agente **não cria usuários diretamente** — ele nunca chama nenhum endpoint
de criação de usuário. A criação acontece **como efeito colateral do backend**
quando alguém clica em "Abrir Portal"/"Abrir Chamado" pela primeira vez para
uma dada máquina.

Fluxo (`handler/auth_handlers.go:machineLogin`, chamado via
`GET /api/auth/machine-login?token=...`):

1. Busca a máquina pelo `machine_token` (`db.MachineByToken`). Se não achar,
   401.
2. Deriva um e-mail técnico sintético a partir do token:
   `machine-{primeiros 12 chars do token}@orion.internal`.
3. Verifica se já existe um usuário Supabase Auth com esse e-mail
   (`db.AuthUserIDByEmail`, query direta em `auth.users`).
4. **Se não existir** (primeiro acesso dessa máquina):
   - Cria um usuário via `sb.AdminCreateUser` (Supabase Admin API), com senha
     aleatória de 24 caracteres (`lib.GenerateRandomPassword`) que nunca é
     usada/exibida, `email_confirm: true` e `full_name` = `"Suporte (<hostname>)"`.
   - Atualiza/cria a linha de perfil público (`public.profiles`) associando
     `full_name`, `email` e `company_id` da máquina.
5. **Se já existir**, apenas atualiza `full_name`/`company_id` do perfil (não
   mexe no e-mail nem recria o usuário).
6. Gera um *magic link* de uso único via `sb.AdminGenerateLink` (Supabase
   Admin API, tipo `magiclink`) apontando para `redirect_to`.
7. Redireciona (`307`) o navegador do usuário para esse magic link — é o
   Supabase Auth quem efetivamente autentica a sessão no navegador.

**Onde vive esse código:** inteiramente em
[`handler/auth_handlers.go`](../handler/auth_handlers.go) (função
`machineLogin`), usando `lib.CreateUserInput`/`sb.AdminCreateUser` e
`lib.GenerateLinkInput`/`sb.AdminGenerateLink` (implementações em
`lib/supabase.go`, não lidas em detalhe neste levantamento, mas referenciadas
diretamente aqui). O agente Go (`orion-agent/`) apenas fornece o `token` na
URL — toda a lógica de "virar usuário" é 100% do backend Vercel.

Não há nenhuma associação entre esse "usuário-fantasma da máquina" e o
usuário real do Windows/AD identificado em `current_user` no heartbeat — são
dois conceitos desconectados (ver seção 6.5).

---

## 4. Como o agente detecta troca de usuário (logoff/logon em AD)

**Não detecta.** Não existe:
- nenhum listener de evento de sessão do Windows (`WTSRegisterSessionNotification`,
  `WM_WTSSESSION_CHANGE`, Windows Event Log, etc.);
- nenhuma verificação periódica dedicada a "o usuário mudou desde o último
  ciclo?";
- nenhuma diferenciação entre logon interativo, RDP, ou fast user switching.

O único mecanismo relacionado é indireto: a cada `tick()` (heartbeat), o
agente relê `os.Getenv("USERNAME")` no processo atual e envia o valor corrente
como `current_user` no payload. O backend faz um `UPDATE`/`UPSERT` simples
(`db.UpsertMachine`) sobrescrevendo o campo `current_user` da máquina a cada
heartbeat — então, na prática, "a troca de usuário é detectada" apenas como
**o valor mais recente reportado no próximo heartbeat**, com atraso de até
`interval_seconds` (30–60s), e **apenas se o processo herda o ambiente do
usuário que trocou** (o que, como visto em 2.2, só é confiável quando o
processo roda no contexto interativo daquele usuário — não quando roda como
serviço SYSTEM único e persistente entre logons).

Isso tem uma implicação prática relevante: se o agente estiver instalado
**como serviço Windows** (o caminho "oficial" via `install`/GPO, ver
`deploy/gpo_install.ps1`), ele roda como **um único processo SYSTEM
persistente**, que não é reiniciado a cada logon/logoff — então
`os.Getenv("USERNAME")` dentro dele tende a permanecer fixo (contexto de
serviço), e trocas reais de usuário na sessão gráfica **provavelmente não são
refletidas** em `current_user`. Isso é uma suposição baseada na leitura do
código (nenhum teste foi executado neste levantamento) — ver seção 5.

---

## 5. O que foi e não foi verificado

Este levantamento foi feito por **leitura estática de código**, sem executar
o agente, sem instalar o serviço, sem inspecionar uma máquina Windows real
rodando como SYSTEM. Portanto, as afirmações sobre comportamento de
`USERNAME`/`USERDOMAIN` no contexto de serviço Windows (seções 2.2 e 4) são
inferências a partir de comportamento conhecido da plataforma Windows,
**não observação direta**. Vale confirmar em ambiente real antes de agir
sobre esse diagnóstico.

Não encontrei testes automatizados (`_test.go`) em nenhum pacote de
`orion-agent/`.

---

## 6. Pontos incompletos, gambiarras e riscos identificados

Só descrição — nada foi corrigido.

### 6.1 `systray-agent/` é um protótipo órfão, não usado
Diretório separado (`systray-agent/main.go`, 64 linhas), com `go.mod` próprio,
adicionado em um único commit (`ed86fe0`, 2026-06-12, mensagem
"ajuste front topzera demais" — sem relação aparente com o conteúdo). Contém
uma versão simplificada/stub do tray, com itens de menu "Tirar Screenshot" e
"Sincronizar Ativo" que são só `fmt.Println` (placeholders, sem implementação
real), e aponta para `https://orion-system.vercel.app` (domínio antigo,
diferente do `orion.bysam.dev` usado pelo agente atual). Não é referenciado
por nenhum script de build/deploy/CI encontrado no repo. Parece código morto
esquecido, coexistindo de forma confusa com `orion-agent/`.

### 6.2 Segredo de produção commitado em texto plano
`orion-agent/agent.yaml` está versionado no git com
`agent_key: ***CHAVE-ROTACIONADA-VER-SECURITY-md***` — a mesma chave que, no backend, precisa
bater com a variável de ambiente `AGENT_KEY` (`lib/config.go`) para validar
**qualquer** heartbeat/poll/resposta de comando quando nenhuma chave dinâmica
por empresa está configurada. Qualquer pessoa com acesso de leitura ao
repositório tem essa chave. Além disso, é uma chave **global**, compartilhada
por todas as instalações/empresas que não tenham uma chave dinâmica própria em
`public.api_keys`.

### 6.3 Binário compilado (`orion-agent.exe`) versionado no git
Aumenta o tamanho do repositório e não há garantia de que o `.exe` versionado
corresponde ao código-fonte atual (não há pipeline de build visível que gere e
substitua esse artefato automaticamente).

### 6.4 Janela sem RMM funcional após reinício
`s.machineID` só é preenchido em memória após o primeiro heartbeat
bem-sucedido (`tick()`); `pollAndExecuteCommands()` simplesmente retorna sem
fazer nada enquanto isso (`if s.machineID == "" { return }`). Isso significa
que, no exato momento em que o agente sobe (ou depois de qualquer falha de
heartbeat), há uma janela em que comandos remotos pendentes não são
verificados, sem log de aviso — o operador não tem como saber que o RMM está
"desligado" nesse intervalo.

### 6.5 Nenhuma ligação entre "usuário AD" e "usuário-fantasma" do portal
O usuário sintético criado em `machineLogin` (`machine-<token>@orion.internal`)
é por **máquina**, não por **usuário AD**. Duas pessoas diferentes usando o
mesmo computador em dias diferentes acabam autenticadas no portal como a
mesma "identidade de suporte da máquina", sem qualquer registro de qual
usuário Windows estava logado no momento do clique — mesmo o agente já
coletando `current_user` no heartbeat, essa informação não é usada em nenhum
momento pelo fluxo de login.

### 6.6 Execução de comando remoto sem confirmação nem allowlist
`executeCommand` (`service/windows.go`) roda **qualquer string** recebida do
backend via `cmd /C <command>`, sem sanitização, sem allowlist de comandos
permitidos, sem trilha de auditoria além do texto salvo em
`machine_commands.output`. A única barreira é a autorização de quem pode criar
o comando no backend (role admin/technician/developer) — o agente em si
confia cegamente no conteúdo recebido.

### 6.7 Fallback silencioso de empresa (multi-tenant)
No heartbeat, se a chave do agente não resolver uma empresa e o domínio
também não bater com nenhuma cadastrada, o backend vincula a máquina à
**primeira empresa encontrada no banco** (`db.FirstCompanyID`,
`mon_handlers.go`), só com um log de debug (`fmt.Printf`). Numa base
multi-tenant, isso pode silenciosamente atribuir uma máquina de um cliente à
empresa errada.

### 6.8 Sem feedback de erro visível ao usuário final
Falhas de heartbeat, de criação de atalho, de geração de token, etc., só vão
para `agent.log` (arquivo local na pasta do `.exe`, que o usuário comum não
sabe onde fica nem tem motivo para abrir). O ícone da bandeja não muda de
estado, não há balão de notificação, "Abrir Portal" clicado antes do primeiro
heartbeat simplesmente não faz nada visível (seção 2.4).

### 6.9 Ícone de bandeja é um placeholder
`tray/icon.go` contém explicitamente um comentário admitindo que é um ícone
"simples de teste" (quadrado azul 16x16), não a identidade visual real do
produto.

### 6.10 Atalho de desktop reescrito a cada heartbeat, sem checar sessão ativa
`shortcut.CreatePortalShortcut` grava `Abrir Portal de Chamados.url` sempre em
`os.UserHomeDir()/Desktop` a cada `tick()` — se o processo estiver rodando
como serviço SYSTEM (não como o usuário interativo), `os.UserHomeDir()`
resolve para o perfil do usuário SYSTEM, não para o Desktop de quem está
logado; nesse cenário o atalho provavelmente é escrito num lugar que nenhum
usuário humano vê. Consistente com a limitação de contexto descrita na
seção 2.2.

---

## 7. Perguntas em aberto para decidir antes de qualquer correção

- O modelo de implantação real em produção hoje é **serviço Windows (SYSTEM)**
  via GPO, **tray interativo por usuário**, ou os dois coexistindo? Isso muda
  o diagnóstico de 2.2/4/6.10 de "provável" para "confirmado".
- A chave (`agent_key`) commitada em `agent.yaml` já vazou/está em uso em
  produção agora? Precisa ser rotacionada?
- `systray-agent/` pode ser removido, ou há algum plano de retomá-lo?
