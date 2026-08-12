# Orion Agent — Auditoria de Segurança (superfície local + rede)

> Relatório de **pentest/auditoria por leitura de código**, sem exploração
> ativa contra produção e **sem nenhuma correção aplicada**. Escopo:
> `orion-agent/` (binário que roda na máquina do usuário) + pontos de
> integração com o backend estritamente necessários para avaliar risco.
> Achados verificados por leitura de código-fonte, leitura de dependências
> vendoradas (`gopsutil`, `kardianos/service`) e um teste empírico pontual de
> ACL de registro do Windows nesta máquina de desenvolvimento.

---

## Sumário de severidade

| # | Achado | Severidade |
|---|---|---|
| F1 | Nenhuma porta local (HTTP/gRPC/socket) exposta pelo agente | **Informativo** (positivo) |
| F2 | Serviço Windows roda como `LocalSystem` por padrão + canal RMM executa comando arbitrário (`cmd /C`) sem allowlist | **Crítico** |
| F3 | `agent_key` (credencial de autenticação do agente) em texto plano, commitada no git | **Crítico** |
| F4 | `machine_token` (credencial de login automático/bearer) gravado em texto plano em 3 lugares: arquivo local, log, atalho `.url` no Desktop | **Crítico** |
| F5 | Permissões `0600`/`0644` do Go **não criam ACL real no Windows** — arquivos herdam a ACL do diretório pai | **Alto** |
| F6 | Sem *enforcement* de esquema HTTPS — `api_url` pode ser `http://`, expondo credenciais em claro na rede | **Alto** |
| F7 | Log grava a URL completa de login automático (com token) em texto plano a cada clique na bandeja | **Alto** |
| F8 | Distribuição via GPO copia binário/config de compartilhamento SMB sem verificação de integridade/assinatura | **Médio** |
| F9 | Log grava o texto integral de comandos RMM recebidos (possível vazamento de segredo embutido no comando) | **Médio** |
| F10 | Sem *certificate pinning* — depende só do trust store do SO | **Baixo / Informativo** |

---

## 1. Porta local exposta (HTTP/gRPC/socket)

**Achado F1 — Informativo (positivo).**

Busquei por qualquer primitiva de servidor (`net.Listen`, `http.ListenAndServe`,
`grpc.NewServer`, named pipes) em todo `orion-agent/`:

```
$ grep -rn "ListenAndServe|net.Listen|grpc.NewServer|http.Serve|namedpipe" orion-agent/
orion-agent/config/config.go:21:api_url: http://localhost:8080     # só valor default de destino, não listener
orion-agent/config/config.go:63:  cfg.APIURL = "http://localhost:8080/api/monitoring/machines/heartbeat"
```

Nenhum resultado real. O agente é **exclusivamente cliente HTTP de saída**
(`sender/api.go`), não abre nenhuma porta TCP/UDP, socket Unix, named pipe ou
serviço RPC local. `http://localhost:8080` nesses dois pontos é apenas o
**valor padrão de `api_url`** gravado no `agent.yaml` de exemplo — não é algo
que o agente escuta.

**Consequência:** não existe hoje superfície de ataque "processo local
forjando chamadas para uma API local do agente", porque essa API não existe.
Isso remove uma classe inteira de risco (qualquer usuário/malware local
poderia, em tese, chamar uma API local sem autenticação — mas ela não existe
para ser chamada).

**Recomendação:** manter essa propriedade. Se no futuro for adicionada
qualquer superfície local (ex.: um socket para a UI da bandeja falar com o
serviço, ou um endpoint de diagnóstico), ela deve nascer com autenticação
(named pipe com ACL restrita ao SID do usuário, ou Unix socket com
permissões de arquivo), nunca um `net.Listen("tcp", "127.0.0.1:PORT")`
aberto sem autenticação — a própria existência de uma porta TCP loopback sem
auth já seria explorável por qualquer processo do mesmo usuário (e, se o
serviço rodar como SYSTEM — ver F2 — por *qualquer* usuário da máquina).

---

## 2. Privilégio de execução

### F2 — Crítico: `LocalSystem` + execução de comando arbitrário sem allowlist

**Onde:** `orion-agent/service/windows.go`

```go
// ServiceConfig define as propriedades de exibição do serviço no Windows.
func ServiceConfig() *service.Config {
	return &service.Config{
		Name:        "OrionAgent",
		DisplayName: "Orion Monitoring Agent",
		Description: "Coleta métricas de hardware e permite suporte remoto proativo via Orion System.",
	}
}
```

Não há campo `UserName` definido. Verifiquei o código do `kardianos/service`
v1.2.2 (`service_windows.go`, `Install()`): quando `Config.UserName` está
vazio, `ServiceStartName` é passado como string vazia para
`mgr.CreateService`, que — pela própria API do Windows (`CreateServiceW`,
parâmetro `lpServiceStartName = NULL`) — instala o serviço para rodar como
**`LocalSystem`**. Ou seja, com a configuração atual, `orion-agent.exe`
instalado via `install` (ou pelo script de GPO) roda com o nível de
privilégio mais alto possível numa máquina Windows — equivalente a acesso
irrestrito ao SO, incluindo leitura de LSASS, todo o registro, todos os
arquivos, e capacidade de personificar qualquer usuário local.

Isso por si só já seria alto risco para um agente que só coleta métricas.
Mas o agente **também executa comandos remotos arbitrários**
(`service/windows.go`):

```go
func executeCommand(command string) (string, error) {
	cmd := exec.Command("cmd", "/C", command)
	out, err := cmd.CombinedOutput()
	return string(out), err
}
```

Sem allowlist de comandos, sem sandboxing, sem confirmação local. O comando
vem do backend (`sender.PollCommands`, autenticado só por `X-Agent-Key`, ver
`SECURITY-AUTO-PROVISIONING.md` para a análise de como essa chave está
comprometida hoje).

**Cadeia de ataque:** quem possuir uma `X-Agent-Key` válida (a chave global
está commitada em texto plano no repositório — F3) consegue criar um
`machine_command` `pending` para qualquer `machine_id` conhecido/adivinhável
e, no próximo poll (até 30s de espera), obter **execução remota de código
como `NT AUTHORITY\SYSTEM`** em qualquer endpoint com o agente instalado
como serviço. Isso é o achado de maior severidade combinada deste relatório
— não é uma falha isolada, é a composição de "chave vazada" + "sem
allowlist" + "privilégio máximo".

**Correção sugerida (não aplicada):**

1. Rodar o serviço com o menor privilégio necessário. Para coleta de
   métricas de hardware via `gopsutil`, `LocalService` ou uma **conta de
   serviço virtual** dedicada já resolve a maior parte — evite
   `LocalSystem`:

```go
func ServiceConfig() *service.Config {
	return &service.Config{
		Name:        "OrionAgent",
		DisplayName: "Orion Monitoring Agent",
		Description: "Coleta métricas de hardware e permite suporte remoto proativo via Orion System.",
		// Conta de serviço virtual dedicada — isolada, sem privilégios
		// herdados de outros serviços, sem senha para gerenciar.
		UserName: `NT SERVICE\OrionAgent`,
	}
}
```
   (Requer registrar o SID de serviço virtual via
   `sc.exe sidtype OrionAgent unrestricted` no instalador, e conceder
   explicitamente, via `icacls`/`secedit`, apenas os privilégios realmente
   necessários — leitura de contadores de performance e WMI não exige
   `LocalSystem`.)

2. Restringir `executeCommand` a uma **allowlist** de operações conhecidas
   (ex.: `flushdns`, `restart-spooler`, `run-sfc`) mapeadas para comandos
   fixos no próprio binário, em vez de aceitar string livre vinda da rede:

```go
var allowedCommands = map[string][]string{
	"flush_dns":       {"ipconfig", "/flushdns"},
	"restart_spooler": {"net", "stop", "spooler"}, // + start, encadeado
}

func executeCommand(commandID string) (string, error) {
	args, ok := allowedCommands[commandID]
	if !ok {
		return "", fmt.Errorf("comando não permitido: %s", commandID)
	}
	cmd := exec.Command(args[0], args[1:]...)
	out, err := cmd.CombinedOutput()
	return string(out), err
}
```
   Se comando livre for um requisito de produto inegociável, ao menos exigir
   uma segunda camada de aprovação (ex.: confirmação MFA do técnico no
   momento da criação do comando) e reduzir o privilégio do serviço para não
   ser SYSTEM.

---

## 3. Armazenamento de segredos em disco

### F3 — Crítico: `agent_key` em texto plano, commitada no git

`orion-agent/agent.yaml`:
```yaml
agent_key: ***CHAVE-ROTACIONADA-VER-SECURITY-md***
```
Arquivo versionado no repositório (histórico completo do git, não só o
`HEAD`), copiado sem alteração para `C:\Program Files\OrionAgent\agent.yaml`
pelo script `deploy/gpo_install.ps1`. Qualquer pessoa com acesso de leitura
ao repositório — inclusive ex-colaboradores, forks, backups — tem essa chave
para sempre, mesmo que seja rotacionada depois (o valor antigo continua no
histórico).

**Correção sugerida:**
- Remover do histórico (`git filter-repo`/BFG) e **rotacionar** o valor
  imediatamente (rotação sozinha não basta enquanto o valor antigo segue
  legível no histórico, mas é o primeiro passo).
- Nunca commitar o `agent.yaml` de produção; commitar só um
  `agent.yaml.example` com placeholder, e gerar o arquivo real no momento do
  deploy (script de GPO já teria condições de buscar a chave de um cofre,
  não de copiar um arquivo fixo do share).

### F4 — Crítico: `machine_token` (credencial de login automático) em texto plano em três lugares

O `machine_token` funciona como um **bearer token de login sem senha** (ver
`SECURITY-AUTO-PROVISIONING.md`, seção 1.3) — posse dele é suficiente para
logar como a identidade daquela máquina no portal, sem exigir sequer a
`X-Agent-Key`. Ele existe, em texto plano, em três lugares simultâneos:

**a) Arquivo local** — `orion-agent/token/token.go`:
```go
func SaveToken(token string) error {
	...
	if err := ioutil.WriteFile(path, []byte(token), 0600); err != nil {
	...
```
`GetTokenPath()` retorna `C:\ProgramData\OrionAgent\machine.token`.

**b) Atalho no Desktop, permanente** — `orion-agent/shortcut/shortcut_windows.go`:
```go
targetURL := fmt.Sprintf("%s/api/auth/machine-login?token=%s", apiURL, machineToken)
content := fmt.Sprintf("[InternetShortcut]\nURL=%s\n", targetURL)
err = os.WriteFile(shortcutPath, []byte(content), 0644)
```
O arquivo `Abrir Portal de Chamados.url`, recriado a cada heartbeat (30-60s)
na Área de Trabalho do usuário, contém a URL de login **com o token
embutido**, em texto plano, permanentemente visível para qualquer um que
abra o arquivo num editor de texto (não precisa nem clicar — basta abrir com
Bloco de Notas) ou que tenha acesso à pasta (backup, sincronização em nuvem
do Desktop, compartilhamento de tela, etc.).

**c) Log** — ver F7 abaixo.

**Correção sugerida:**
- Não embutir o token na URL do atalho como texto plano permanente. Se o
  atalho de acesso rápido é um requisito, ele deveria apontar para uma rota
  curta e de uso único / expiração curta (o backend já gera *magic links* de
  uso único — o atalho poderia disparar essa geração sob demanda, ao ser
  clicado, em vez de carregar o bearer token para sempre em disco):
```go
// Em vez de gravar o token diretamente:
targetURL := fmt.Sprintf("%s/agent/quick-access?device=%s", apiURL, deviceID)
// device_id não é segredo — o backend troca por um magic link de uso único
// no momento do clique, validando posse via mTLS/certificado (ver
// SECURITY-AUTO-PROVISIONING.md, seção 4.1), não via string estática salva.
```
- Enquanto o modelo de token estático persistir, ao menos parar de
  regravar o atalho a cada heartbeat (reduz a janela de exposição/reescrita)
  e avaliar se o atalho precisa mesmo existir versus abrir só sob clique
  explícito do usuário no ícone da bandeja (que já cumpre a mesma função).

### F5 — Alto: permissões `0600`/`0644` do Go não configuram ACL real no Windows

Este é um ponto técnico que **invalida a premissa de proteção** usada em
`token.go` e `config.go`. No Windows, o parâmetro `os.FileMode` passado para
`os.WriteFile`/`os.OpenFile` **não mapeia para uma ACL NTFS** da forma como
mapeia para permissões POSIX no Linux/macOS — o pacote `os` do Go, no
Windows, só usa o bit de escrita do dono para alternar o atributo
"somente leitura" do arquivo; ele **não restringe quais contas conseguem
ler o arquivo**. Quem controla o acesso de leitura, na prática, é a ACL
NTFS herdada do diretório pai no momento da criação.

- `token.go:47` — `os.MkdirAll(dir, 0755)` cria
  `C:\ProgramData\OrionAgent` sem nenhuma chamada explícita de ACL
  (`golang.org/x/sys/windows` + `SetNamedSecurityInfo`, ou `icacls` via
  `exec.Command`). O diretório herda a ACL padrão de `C:\ProgramData`, que
  por padrão do Windows concede **leitura ao grupo `BUILTIN\Usuários`**.
  Ou seja, apesar do `0600` no `WriteFile`, **qualquer usuário local padrão
  consegue ler `machine.token`** hoje.
- `config.go:39` e `deploy/gpo_install.ps1` — mesma situação para
  `agent.yaml` em `C:\Program Files\OrionAgent`, cuja ACL padrão também
  concede leitura a `Usuários`.

Isso reforça (com uma causa técnica concreta e verificável) o achado já
levantado em `SECURITY-AUTO-PROVISIONING.md` seção 1.2: mesmo que o
`machine_token` fosse trocado por um segredo aleatório de alta entropia
(em vez do hash derivável hoje), **ele continuaria legível por qualquer
usuário local** sem uma correção adicional de ACL.

**Correção sugerida:**
```go
import (
	"os/exec"
)

// hardenDirectoryACL restringe leitura/escrita a SYSTEM e Administradores.
// Deve ser chamada uma única vez, na criação do diretório.
func hardenDirectoryACL(dir string) error {
	cmd := exec.Command("icacls", dir,
		"/inheritance:r",
		"/grant:r", `SYSTEM:(OI)(CI)F`,
		"/grant:r", `BUILTIN\Administrators:(OI)(CI)F`,
	)
	return cmd.Run()
}
```
(Chamar via `icacls` é a via mais simples de implementar; uma alternativa
mais "nativa" é usar `golang.org/x/sys/windows` com `SECURITY_ATTRIBUTES`
customizado na criação do diretório/arquivo, evitando um `exec.Command`
adicional.) Complementar com criptografia do conteúdo via DPAPI
(`CryptProtectData`, escopo `LocalMachine`) para que, mesmo com leitura de
arquivo, o valor não seja diretamente utilizável fora daquela máquina — como
já detalhado em `SECURITY-AUTO-PROVISIONING.md`, seção 4.1.

---

## 4. Comunicação agente → Orion System: HTTPS e validação de certificado

### F6 — Alto: sem *enforcement* de esquema HTTPS

`sender/api.go`:
```go
var httpClient = &http.Client{Timeout: httpTimeout}
...
func doPost(url, agentKey string, body []byte) (string, error) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	...
	req.Header.Set("X-Agent-Key", agentKey)
	resp, err := httpClient.Do(req)
```

O `http.Client` usado **não tem `Transport` customizado** — isso é bom no
sentido de que herda o `http.DefaultTransport`, que faz validação de
certificado TLS padrão do Go (não há `InsecureSkipVerify: true` em lugar
nenhum do código; não há bypass de validação de certificado). Não encontrei
fallback para TLS inseguro.

O problema real é anterior a isso: **nada no `config.Load()` valida que
`cfg.APIURL` comece com `https://`.** O valor vem direto do `agent.yaml`
(seção `api_url`) sem qualquer verificação de esquema:

```go
if cfg.APIURL == "" {
	cfg.APIURL = "http://localhost:8080/api/monitoring/machines/heartbeat"
}
```
(o próprio *default* embutido no código é `http://`, não `https://`).

Se um `agent.yaml` malicioso ou mal configurado (via GPO comprometido,
compartilhamento SMB adulterado — ver F8, ou erro humano) apontar
`api_url: http://...`, o agente **enviará `X-Agent-Key`, `machine_token`,
hostname, usuário, domínio e todas as métricas em texto plano na rede**,
sem nenhum aviso ou erro — o código aceita silenciosamente.

**Correção sugerida:**
```go
// Em config.Load(), após aplicar os defaults:
if !strings.HasPrefix(strings.ToLower(cfg.APIURL), "https://") {
	return nil, fmt.Errorf(
		"api_url deve usar https:// por segurança (valor atual: %q)", cfg.APIURL)
}
```
E trocar o default de `http://localhost:8080/...` para exigir configuração
explícita em vez de um fallback de rede — hoje esse default sequer faz
sentido em produção (é só útil em desenvolvimento local).

### F10 — Baixo/Informativo: sem *certificate pinning*

A validação de certificado depende inteiramente do trust store do Windows.
Isso é uma prática aceitável na maioria dos cenários, mas para um agente
com privilégio SYSTEM (F2) falando com um backend fixo e conhecido
(`orion.bysam.dev`), pinning do certificado (ou ao menos da CA) reduziria a
superfície de um ataque MITM habilitado por uma CA corporativa/maliciosa
instalada via GPO no mesmo parque de máquinas. Severidade baixa porque
depende de comprometer a cadeia de confiança do próprio SO primeiro — mas
listado para completude, já que a pergunta pediu avaliação explícita de
"fallback inseguro".

**Correção sugerida (opcional, defesa em profundidade):**
```go
pool := x509.NewCertPool()
pool.AppendCertsFromPEM(pinnedOrionCA) // CA/certificado embutido no binário
httpClient = &http.Client{
	Timeout: httpTimeout,
	Transport: &http.Transport{
		TLSClientConfig: &tls.Config{
			RootCAs:    pool,
			MinVersion: tls.VersionTLS12,
		},
	},
}
```

### F8 — Médio: distribuição via GPO sem verificação de integridade

`deploy/gpo_install.ps1`:
```powershell
Copy-Item -Path "$SourcePath\$Executable" -Destination "$InstallPath\$Executable" -Force -ErrorAction Stop
Copy-Item -Path "$SourcePath\$Config" -Destination "$InstallPath\$Config" -Force -ErrorAction Stop
```
Copia o `.exe` e o `agent.yaml` de um compartilhamento SMB (`$SourcePath`)
sem checar assinatura Authenticode do binário nem hash/checksum do arquivo
de config. Quem conseguir escrever nesse share (ou interceptar SMB sem
assinatura/selo em uma rede mal segmentada) consegue trocar o binário ou o
`agent_key` que será distribuído para toda a frota gerenciada por essa GPO —
o vetor de distribuição em si vira ponto único de comprometimento em massa.

**Correção sugerida:**
```powershell
$expectedHash = "SHA256_DO_BINARIO_ASSINADO"
$actualHash = (Get-FileHash "$SourcePath\$Executable" -Algorithm SHA256).Hash
if ($actualHash -ne $expectedHash) {
    Write-Error "Hash do orion-agent.exe não confere — instalação abortada."
    exit 1
}
# E/ou: validar assinatura Authenticode
$sig = Get-AuthenticodeSignature "$SourcePath\$Executable"
if ($sig.Status -ne 'Valid') {
    Write-Error "Assinatura do orion-agent.exe inválida — instalação abortada."
    exit 1
}
```
Idealmente assinar o binário com um certificado de code-signing da empresa e
validar isso na GPO antes de copiar/instalar.

---

## 5. Logs que vazam dados sensíveis

### F7 — Alto: URL de login (com token) gravada em texto plano no log a cada clique

`orion-agent/main.go`:
```go
func() {
	url := svc.GetPortalURL()
	if url != "" {
		tray.OpenURL(url)
		logger.Printf("[TRAY] Abrindo portal de suporte: %s", url)   // <- token em claro no log
	}
},
func() {
	url := svc.GetTicketURL()
	if url != "" {
		tray.OpenURL(url)
		logger.Printf("[TRAY] Abrindo página de novo chamado: %s", url) // <- idem
	}
},
```
`GetPortalURL()`/`GetTicketURL()` (`service/windows.go`) retornam
`{api_url}/api/auth/machine-login?token={machine_token}[&redirect_to=...]`
— a mesma credencial de bearer discutida em F4 acaba, mais uma vez, em texto
plano, agora em `agent.log`, que fica na mesma pasta do executável e sofre
do mesmo problema de ACL herdada descrito em F5 (legível por qualquer
usuário local, dependendo da ACL de instalação).

Cada clique no menu da bandeja é um evento novo de exposição — o log
acumula histórico de tokens usados ao longo do tempo (mesmo que o token em
si seja o mesmo por instalação, sua presença repetida em log de texto
facilita exfiltração/scraping automatizado por malware local).

**Correção sugerida:**
```go
import "net/url"

// redactQuery remove parâmetros sensíveis antes de logar uma URL.
func redactQuery(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "[url inválida]"
	}
	u.RawQuery = ""
	return u.String()
}

// uso:
logger.Printf("[TRAY] Abrindo portal de suporte: %s", redactQuery(url))
```

### F9 — Médio: texto integral de comandos RMM em log

`service/windows.go`:
```go
for _, c := range cmds {
	s.logger.Printf("[RMM] Executando comando remoto: %s", c.Command)
	output, err := executeCommand(c.Command)
	...
```
Se um técnico (ou um atacante com a chave vazada — F3/F2) enviar um comando
que contenha um segredo embutido (ex.: `net use \\server\share /user:admin
SenhaSecreta123`), esse segredo fica gravado em texto plano no
`agent.log` local **e**, adicionalmente, o `output` do comando (que pode
ecoar o próprio comando ou dados sensíveis do resultado) é enviado de volta
ao backend via `RespondToCommand` e persistido na tabela
`machine_commands.output` (`lib/monitoring.go:UpdateCommandStatus`), sem
nenhuma marcação de sensibilidade — duplicando a exposição.

**Correção sugerida:** truncar/mascarar o log local do comando (manter só um
ID de correlação, já que o conteúdo completo já está registrado no backend
sob controle de acesso via role) e, no backend, adicionar um mecanismo de
redação de padrões comuns de segredo (regex para `password=`, `senha=`,
tokens Base64 longos) antes de persistir `output`:
```go
s.logger.Printf("[RMM] Executando comando remoto (id=%s)", c.ID) // sem o texto do comando
```

---

## 6. O que não foi verificado

Esta auditoria não incluiu: execução dinâmica do binário/serviço numa
máquina de domínio real, captura de tráfego de rede do agente em produção,
teste de exploração ponta a ponta contra `orion.bysam.dev`, nem análise de
assinatura Authenticode do `orion-agent.exe` versionado no repositório
(apenas confirmei que ele existe versionado, não que está ou não assinado).
A conclusão sobre o `ServiceStartName` vazio resultar em `LocalSystem` (F2)
é baseada na leitura do código-fonte do `kardianos/service` v1.2.2 e no
comportamento documentado da API `CreateServiceW` do Windows — recomendo
confirmar com `sc qc OrionAgent` numa instalação real antes de qualquer
comunicação externa sobre severidade.
