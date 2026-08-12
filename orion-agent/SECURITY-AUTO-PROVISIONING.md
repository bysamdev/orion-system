# Orion Agent — Auto-provisionamento de identidade: análise de confiança

> Relatório de **avaliação de segurança**, sem implementação. Foco no
> mecanismo pelo qual o agente identifica "o usuário do Windows" e provisiona
> automaticamente uma identidade correspondente no Orion System sem
> senha. Baseado em leitura de código (`orion-agent/`, `handler/auth_handlers.go`,
> `handler/mon_handlers.go`, `lib/db.go`, `lib/helpers.go`) e em um teste
> empírico pontual (leitura de registro do Windows, ver seção 1.3).

**Veredito resumido:** o mecanismo atual **não estabelece confiança real**.
Ele confia em três coisas que não são segredos — um GUID de máquina legível
por qualquer usuário local, um hostname/MAC observáveis na rede, e uma chave
de API estática que está commitada em texto plano no repositório. O
"usuário do Windows" reportado é uma string de ambiente sem qualquer
verificação, e o endpoint que concede login automático nem exige a chave de
API. Isso é suficiente para personificação de máquina e, em cadeia, criação
de identidades falsas dentro de uma empresa. Detalhes e como corrigir abaixo.

---

## 1. Como a identidade é gerada hoje

Existem **dois segredos distintos e desacoplados**, nenhum deles ligado ao
usuário do Windows:

### 1.1 `X-Agent-Key` — "isto é *um* agente válido"

Definido em `agent.yaml` (`agent_key`), enviado em todo heartbeat/poll/resposta
de comando. Validado em `lib/helpers.go:ValidateAgentKey` contra:
- uma chave **global estática** (`AGENT_KEY` no Vercel) — compartilhada por
  todas as instalações que não tenham chave dedicada; ou
- uma chave **dinâmica por empresa** na tabela `public.api_keys`.

Isso prova só "quem chamou conhece uma chave válida", não qual máquina, nem
qual usuário. É simétrico (mesma chave usada por todos os agentes daquela
empresa/globalmente) e estático (sem expiração, sem rotação automática, sem
escopo por dispositivo).

**Achado crítico:** essa chave global estava commitada em texto plano em
`orion-agent/agent.yaml` — qualquer pessoa com acesso de leitura ao git tinha
essa chave. Valor redigido aqui após a rotação (`IMPROVEMENT_PLAN.md` A.1);
o antigo continua no **histórico** do git até uma reescrita explícita. Já
reportado no `ARCHITECTURE.md` (seção 6.2); repetido aqui porque é a peça
central desta análise.

### 1.2 `machine_token` — "isto é *esta* máquina"

Gerado em `collector/hardware.go:GenerateToken()`:

```go
raw := fmt.Sprintf("%s|%s|%s", p.MachineUUID, p.Hostname, strings.Join(macs, ","))
hash := sha256.Sum256([]byte(raw))
```

Onde:
- `MachineUUID` = `host.Info().HostID`, que no Windows é lido diretamente do
  registro `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`
  (confirmado no código-fonte do `gopsutil` v3.24.5, `host/host_windows.go`,
  linha 71-91 — `RegOpenKeyEx`/`RegQueryValueEx` sem qualquer elevação
  solicitada);
- `Hostname` = nome de rede da máquina;
- `macs` = endereços MAC de todas as interfaces de rede ativas.

Persistido depois em `C:\ProgramData\OrionAgent\machine.token` (permissão
0600, ou seja, só o dono/SYSTEM deveria ler o **arquivo**).

**Problema:** o valor em si não é gerado por um gerador de números
aleatórios nem por um segredo compartilhado no primeiro provisionamento —
é um **hash determinístico de dados que não são segredos**:

- `MachineGuid` é lido de uma chave de registro cujo **ACL padrão do
  Windows concede leitura ao grupo `BUILTIN\Usuários`** — ou seja, qualquer
  processo rodando com a conta de um usuário comum e sem privilégio algum
  consegue ler esse valor. **Testei isso diretamente nesta máquina**
  (`Get-Acl HKLM:\SOFTWARE\Microsoft\Cryptography` e leitura do valor com
  `Get-ItemPropertyValue`, ambos sem elevação) e confirmei leitura bem-sucedida
  do `MachineGuid` como usuário padrão. Não depende de arquivo nenhum
  protegido por ACL 0600 — o segredo "vazado" está reconstruível a partir do
  zero por qualquer processo local, mesmo sem jamais ter lido
  `machine.token`.
- `Hostname` e endereços `MAC` são observáveis por qualquer pessoa na mesma
  rede local (ARP, DHCP, `nbtstat`, WMI remoto sem credenciais elevadas em
  redes mal segmentadas, ou simplesmente perguntando ao usuário/техnico).
- Em ambientes com **imagens clonadas** (golden image de VM/disco sem
  `sysprep` correto, comum em parques corporativos), o `MachineGuid` pode
  se repetir entre várias máquinas — o que quebraria inclusive a premissa de
  unicidade por máquina que o token deveria garantir.

Ou seja: **o `machine_token` não é um segredo — é um identificador
determinístico e reproduzível por qualquer parte que conheça (ou consiga
ler localmente) três valores de baixo sigilo.** A permissão 0600 no arquivo
`machine.token` dá uma falsa sensação de proteção: protege a *cópia salva em
disco*, não o **valor em si**, que pode ser recalculado do zero a qualquer
momento por qualquer usuário local da mesma máquina.

### 1.3 Onde esse token vira poder real: `machine-login`

`GET /api/auth/machine-login?token=<machine_token>` (`handler/auth_handlers.go`)
**não exige `X-Agent-Key`, não exige sessão prévia, não tem rate limit
visível.** A única barreira é: `db.MachineByToken(token)` encontrar uma
máquina com aquele `machine_token` já registrada (ou seja, que já tenha
feito pelo menos um heartbeat). Uma vez encontrada:

- Cria (se primeira vez) ou reaproveita um usuário Supabase Auth
  "fantasma" ligado ao e-mail sintético `machine-<12 chars do token>@orion.internal`.
- Gera um magic link de login automático e **redireciona o navegador para
  ele** — sessão autenticada, sem senha, sem MFA, sem qualquer confirmação.

Portanto o `machine_token` funciona, na prática, como uma **credencial de
posse única** (bearer token) para a identidade daquela máquina no portal —
mas, como visto em 1.2, é um valor **derivável, não um segredo emitido**.

---

## 2. É possível falsificar o "usuário do Windows" reportado?

**Sim, trivialmente, por dois caminhos independentes.**

### 2.1 Do lado do agente (nenhuma verificação contra AD)

`collector/hardware.go` não consulta AD, LDAP, Kerberos ou qualquer API de
identidade — só lê `os.Getenv("USERNAME")`/`os.Getenv("USERDOMAIN")` do
processo atual. Qualquer usuário com permissão para definir variáveis de
ambiente do processo que inicia o agente (ex.: rodando o `.exe` manualmente
com `set USERNAME=diretor.financeiro && orion-agent.exe`, ou modificando o
ambiente herdado de um script de logon) consegue fazer o agente reportar
**qualquer nome que quiser** como usuário logado. Isso não exige nenhum
segredo — é simplesmente ausência de verificação na fonte do dado.

### 2.2 Do lado da rede/API (sem envolver o agente de verdade)

O corpo JSON do heartbeat (`current_user`, `hostname`, `domain`, etc.) **não
é assinado nem vinculado criptograficamente ao processo que o originou**.
Qualquer requisição HTTP `POST /api/monitoring/machines/heartbeat` que
apresente um `X-Agent-Key` válido (a chave global vazada, seção 1.1, serve)
é aceita e processada por `mon_handlers.go:monitoringHeartbeat` como se
viesse do agente real — inclusive com `machine_token` **escolhido livremente
pelo atacante** (o `UpsertMachine` faz `INSERT ... ON CONFLICT (machine_token)
DO UPDATE`, então um token nunca visto antes simplesmente cria uma máquina
nova).

### 2.3 Consequência prática — encadeando 2.1/2.2 com a seção 1.3

Com a chave global vazada e um `machine_token` (real, calculado a partir de
dados de uma vítima específica, **ou** totalmente inventado), um atacante
externo à empresa consegue, sem tocar em nenhum agente real:

1. Enviar um heartbeat forjado definindo `hostname`, `current_user`, `domain`
   e (via `Domain`/fallback de primeira empresa) potencialmente a `company_id`
   de destino.
2. Isso cria/atualiza uma linha em `public.machines` com esses dados
   arbitrários.
3. Chamar `machine-login?token=<mesmo token>` **sem precisar de nenhuma
   chave** e receber um magic link autenticado — criando um usuário Supabase
   Auth novo (se primeira vez) já vinculado à empresa alvo, com nome de
   exibição derivado do `hostname` forjado (`Suporte (<hostname>)`).
4. Esse usuário-fantasma consegue abrir chamados (`/novo-ticket`) e
   presumivelmente navegar o que o perfil "de máquina" tiver acesso, dentro
   da empresa-alvo.

**Isso não é "acessar o perfil de outra pessoa" no sentido de tomar a conta
de um técnico/cliente humano já existente** (o e-mail sintético
`machine-*@orion.internal` é um namespace separado de contas humanas
normais) — mas **é criação/personificação de identidade de suporte dentro de
uma empresa-cliente, sem qualquer prova de posse real da máquina ou vínculo
com AD**, o que já é grave o suficiente (abertura de tickets fraudulentos em
nome de "uma máquina daquela empresa", possível engenharia social subsequente,
poluição/DoS de dados de monitoramento).

Adicionalmente, para uma **máquina real e já registrada**: como o
`machine_token` dela é recalculável (seção 1.2) por qualquer processo local
não privilegiado rodando naquela máquina, **um usuário sem privilégios
administrativos, na mesma máquina, consegue sequestrar a identidade
"fantasma" daquela máquina no portal** — sem nunca ter lido o arquivo
`machine.token` (0600) e sem precisar da `X-Agent-Key` (o `machine-login` não
pede). Isso é significativo em cenários de máquinas compartilhadas (labs,
totens, terminais de uso comum) e em qualquer ambiente onde usuários não têm
elevação — que é exatamente o cenário comum em AD corporativo.

---

## 3. Troca de usuário em ambiente AD: detecção e race conditions

Já mapeado em detalhe no `ARCHITECTURE.md` (seções 2.2 e 4); resumo com foco
em segurança/race condition:

- **Não há detecção de evento.** Nenhum listener de sessão do Windows
  (`WTSRegisterSessionNotification`, `WM_WTSSESSION_CHANGE`, Security Event
  Log 4624/4634/4647, Winlogon 7001/7002). O único mecanismo é reler
  `os.Getenv("USERNAME")` a cada `tick()` do heartbeat.
- **No modelo de implantação "oficial" (serviço Windows via GPO,
  `deploy/gpo_install.ps1`), a detecção provavelmente nem funciona**: um
  serviço Windows roda em Session 0, isolado das sessões interativas, e não
  herda o ambiente do usuário logado. `USERNAME` nesse contexto tende a ser
  fixo (conta de serviço/SYSTEM) e **nunca muda com logon/logoff reais** —
  não é uma questão de atraso, é ausência total de sinal. (Ressalva: não
  executei o serviço numa máquina de domínio real para confirmar 100%; é
  inferência de comportamento conhecido do Windows, não observação direta.)
- **No modo tray interativo**, cada novo logon herdaria um processo (e
  ambiente) diferente apenas se o agente for reiniciado por sessão (ex.: via
  Startup do usuário) — troca de usuário via *Fast User Switching* sem
  logoff completo não é tratada de forma alguma (múltiplas sessões
  concorrentes no mesmo host não são distinguidas; não há Session ID no
  payload).
- **Race condition, tecnicamente**: dentro de uma única execução do agente,
  não há corrida de dados em Go (o `select` do loop principal processa um
  caso por vez, `tick()` não roda concorrentemente consigo mesmo). O problema
  real é **TOCTOU estrutural**: o valor de `current_user` é amostrado uma vez
  no início de `Collect()` e só é *confirmado* no servidor até `sender.Send()`
  completar — com até 3 tentativas e 10s de espera entre elas, a entrega pode
  demorar dezenas de segundos após a amostragem. Se uma troca de usuário
  ocorrer nesse intervalo, o servidor recebe um valor já desatualizado sem
  saber disso — mas isso é secundário ao problema estrutural acima (ausência
  de qualquer canal de evento).
- Combinando com a seção 2: mesmo se a detecção fosse perfeita, o dado
  transportado (`current_user` como string livre) nunca teve integridade
  garantida — então "corrigir a race condition" sozinho não resolveria o
  problema de confiança, só a latência.

---

## 4. Modelo de confiança proposto (não implementado)

Objetivo: separar claramente duas garantias que hoje estão misturadas e
ambas fracas — **"esta requisição vem de um agente legítimo, desta máquina
específica"** (autenticação de dispositivo) e **"este é o usuário Windows/AD
real logado agora"** (identidade humana) — e nunca deixar a segunda ser
auto-declarada sem prova.

### 4.1 Identidade de máquina: enrollment + certificado, não hash de hardware

- Trocar o `machine_token` derivado por um **segredo aleatório de alta
  entropia gerado no primeiro provisionamento** (`crypto/rand`, ≥256 bits),
  nunca recalculável a partir de dados observáveis.
- Melhor ainda: **enrollment com certificado por máquina** (mTLS). Fluxo:
  um admin gera um **token de enrollment de uso único e curta duração**
  (via painel, associado a uma empresa/grupo específico) → o agente, na
  primeira execução, troca esse token por um certificado de cliente
  assinado por uma CA interna do Orion System → toda comunicação subsequente
  (heartbeat, poll, respond) autentica via mTLS, sem `X-Agent-Key`
  compartilhada. Isso elimina de vez o problema da chave estática vazada
  (seção 1.1) porque cada máquina tem sua própria credencial, revogável
  individualmente.
- Armazenar a chave privada protegida por **DPAPI** (
  `CryptProtectData`/`CryptUnprotectData`, escopo `LocalMachine`) em vez de
  um arquivo plano em `ProgramData` — hoje o `machine.token` é legível por
  SYSTEM/admin, mas nada impede reconstrução do valor mesmo sem lê-lo (seção
  1.2); com DPAPI + chave assimétrica real, a chave privada não é
  reconstrutível por ninguém sem acesso à mesma máquina *com o contexto de
  proteção correto*.
- **Nunca aceitar `machine-login` sem o mesmo nível de prova** — hoje o
  endpoint de login automático pede *menos* prova que o heartbeat (nem
  `X-Agent-Key`). Isso deveria ser invertido: login automático deveria ser o
  fluxo *mais* protegido, não o mais aberto.

### 4.2 Identidade de usuário: SID, não nome de usuário

Nomes de usuário (`sAMAccountName`/`USERNAME`) **colidem entre domínios e
não são estáveis** (renomeação de conta mantém o mesmo SID). Proposta:

- Resolver o **SID do usuário da sessão interativa ativa** via API do
  Windows (`WTSQuerySessionInformation` com `WTSUserName`/`WTSDomainName`
  para achar o usuário da sessão do console, depois `LookupAccountName` para
  obter o SID binário, formatado como string `S-1-5-21-...`), usando
  `golang.org/x/sys/windows`, em vez de variáveis de ambiente do processo
  (que, como visto na seção 3, sequer refletem a sessão interativa quando o
  agente roda como serviço).
- Guardar `domain_sid` (prefixo do SID, identifica o domínio de forma
  inequívoca) + `user_rid` separadamente, evitando ambiguidade entre
  florestas/domínios diferentes com nomes de usuário parecidos.
- Tratar esse SID como **dado informativo de inventário**, não como
  credencial de autenticação — nunca usar `current_user`/SID reportado pelo
  agente para logar automaticamente "como aquela pessoa" no portal. Ver 4.4.

### 4.3 Detecção de troca de sessão via API nativa, não polling

- Se o agente permanecer como serviço único (Session 0), usar
  `WTSRegisterSessionNotification` a partir de uma janela de mensagens oculta
  (ou `WTSEnumerateSessions` + eventos do Security Event Log 4624/4634 via
  Windows Event subscription API) para reagir a logon/logoff **quase em
  tempo real**, disparando um heartbeat imediato de "mudança de sessão" em
  vez de esperar o próximo tick.
- Alternativa mais simples operacionalmente: um **processo por sessão**,
  iniciado via GPO como *logon script*/tarefa agendada "on logon" (não como
  serviço SYSTEM único), reportando o `Session ID` do Windows junto — isso
  também resolve nativamente o caso de múltiplas sessões concorrentes (RDP,
  fast user switching), que hoje não existe no modelo de dados.
- Em ambos os casos, carimbar cada evento com o Session ID do Windows para o
  backend distinguir sessões concorrentes na mesma máquina.

### 4.4 Separação de responsabilidades no backend

- `machine-login` deveria **exigir prova de dispositivo** (mTLS/certificado
  da seção 4.1) e nunca criar/reaproveitar identidade só com base num token
  na query string de uma URL clicável.
- Se o objetivo é de fato mapear "usuário AD real" para uma conta no Orion
  System sem senha, o caminho correto é **SSO real com o AD** — Windows
  Integrated Authentication / Kerberos (SPNEGO) ou federação SAML/OIDC contra
  o AD/Entra ID — onde é o **próprio Windows/AD que garante** a identidade
  perante o backend, não uma string autodeclarada por um processo que
  qualquer usuário local controla. Isso resolve de raiz o problema da seção 2
  (falsificação), porque a prova de identidade sai do controle do agente.
- Enquanto isso não existir, pelo menos: acesso via `machine-login` deveria
  ser **estritamente por dispositivo** (abre o portal "como suporte técnico
  da máquina X"), nunca prometendo ser "o usuário Y" — e qualquer necessidade
  de saber *qual pessoa* estava logada deveria ficar restrita a
  metadado/auditoria (SID, seção 4.2), exibido para o técnico, não usado como
  chave de autorização.
- Remover o fallback silencioso "vincula à primeira empresa do banco"
  (já reportado em `ARCHITECTURE.md` 6.7) — combinado com os problemas
  acima, é uma porta adicional para atribuir identidade forjada à empresa
  errada.

### 4.5 Assinatura/replay

- Se mTLS completo não for viável no curto prazo, no mínimo assinar o corpo
  do heartbeat com HMAC-SHA256 usando o segredo por máquina (seção 4.1) +
  timestamp + nonce, rejeitando no servidor requisições fora de uma janela
  de tempo curta ou com nonce repetido — mitiga replay mesmo sem TLS mútuo.

---

## 5. Recomendações priorizadas

### P0 — Ação imediata (exposição ativa, exploração não exige acesso interno)
1. **Rotacionar a `AGENT_KEY` global** vazada em `agent.yaml` e remover o
   segredo do histórico do git; migrar todas as instalações para chaves
   dinâmicas por empresa (`api_keys`), desativando de vez a chave global
   estática.
2. **Exigir `X-Agent-Key` (ou credencial equivalente) em `machine-login`.**
   Hoje é o único endpoint sensível sem essa exigência — é a porta mais
   simples de abusar (seção 1.3/2.3) e a correção é pontual.
3. **Adicionar rate limiting e alertas em `machine-login` e
   `heartbeat`** (ex.: N tentativas/min por IP, alerta em uso do mesmo
   `machine_token` a partir de IPs/geolocalizações incompatíveis em curto
   intervalo) — mitigação rápida enquanto a solução estrutural (4.1) não sai.

### P1 — Estrutural, prazo curto/médio
4. **Trocar `machine_token` derivado por segredo aleatório gerado no
   primeiro provisionamento**, armazenado com DPAPI em vez de arquivo plano
   (seção 4.1) — remove a falha fundamental de "token = hash de dados
   públicos".
5. **Remover o fallback "primeira empresa do banco"** no heartbeat
   (`ARCHITECTURE.md` 6.7) — sem isolamento de tenant confiável, todo o resto
   fica mais frágil.
6. **Parar de tratar `current_user`/`hostname` como dado confiável em
   qualquer decisão de autorização** — hoje eles só alimentam nome de
   exibição e agrupamento, o que já é o comportamento mais seguro possível
   dado o resto do desenho; documentar isso explicitamente como invariante de
   design para não virar base de autenticação no futuro por engano.

### P2 — Modelo de confiança completo
7. **Implementar enrollment com certificado por máquina (mTLS)**, conforme
   4.1 — resolve simultaneamente o problema da chave estática compartilhada
   e da ausência de prova de posse do dispositivo.
8. **Resolver e reportar o SID do usuário via API do Windows**
   (`WTSQuerySessionInformation`/`LookupAccountName`) em vez de
   `os.Getenv`, eliminando colisão de nomes entre domínios (seção 4.2).
9. **Detecção de sessão via API nativa** (`WTSRegisterSessionNotification`
   ou modelo "processo por sessão" via GPO logon script com Session ID) em
   vez de polling por variável de ambiente (seção 4.3).

### P3 — Longo prazo / correção de raiz
10. **Migrar para SSO real contra AD/Entra ID** (Kerberos/SPNEGO ou
    federação SAML/OIDC) para qualquer fluxo que precise autenticar "a
    pessoa", desacoplando de vez identidade humana do processo do agente
    (seção 4.4) — é a única forma de fechar definitivamente a possibilidade
    de personificação descrita na seção 2.

---

## 6. O que não foi verificado

Assim como no `ARCHITECTURE.md`, esta análise é de leitura de código +
um teste pontual de ACL de registro nesta máquina de desenvolvimento (não
uma máquina de domínio real, não o binário do agente em execução). Não
testei exploração de ponta a ponta contra o backend em produção
(`orion.bysam.dev`) — as cadeias de ataque descritas nas seções 2 e 3 são
derivadas da leitura do código-fonte do handler e devem ser confirmadas em
ambiente de homologação antes de qualquer comunicação externa sobre
severidade.
