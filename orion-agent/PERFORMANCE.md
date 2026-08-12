# Orion Agent — Análise de footprint e plano de otimização

> Objetivo: rodar em segundo plano com consumo mínimo de CPU/RAM (referência
> de comportamento: agente leve com ícone de bandeja e monitoramento discreto).
> **Nada foi alterado no código.** Este documento traz medições reais + plano.

---

## 0. Resumo honesto do diagnóstico

Medi o custo real da coleta nesta máquina (12 núcleos, Go 1.26.1, Windows 11).
O resultado contraria parcialmente a hipótese inicial de "polling agressivo
consumindo CPU":

**O agente hoje não é um vilão de CPU em termos absolutos** — gasta cerca de
**127 ms de CPU real a cada 30 s**, o que equivale a ~0,42 % de *um* núcleo,
ou ~0,035 % da capacidade total de uma máquina de 12 núcleos. Isso já está
dentro do que se espera de um agente discreto.

Os problemas reais que as medições expuseram são outros, e valem mais que
"economizar CPU":

1. **Cada coleta trava por 1,13 s** — e 1,0 s disso é um `time.Sleep`
   artificial dentro de `cpu.Percent(1*time.Second, ...)`. Não queima CPU,
   mas segura o loop principal, atrasa desligamento e bloqueia o canal de
   comandos remotos.
2. **~99 % do CPU real gasto é desperdício evitável**: 44,5 ms buscando o
   *modelo do processador* (dado estático que nunca muda) e 81,9 ms varrendo
   interfaces de rede **duas vezes** por coleta.
3. **Escrita em disco a cada 30 s** (o atalho do Desktop é reescrito todo
   tick) — ~2.880 gravações/dia, sem necessidade nenhuma.
4. **Risco de travamento permanente** por goroutines sem timeout em discos de
   rede (seção 2.2) — este é o achado mais sério da análise de robustez.

---

## 1. Como o monitoramento funciona hoje

**Modelo: polling puro com intervalo fixo. Nenhum watcher de evento do
Windows.** (`service/windows.go:run`)

```go
ticker := time.NewTicker(time.Duration(s.cfg.IntervalSeconds) * time.Second) // 30s (agent.yaml)
commandTicker := time.NewTicker(30 * time.Second)                            // 30s fixo, hardcoded
for {
	select {
	case <-ctx.Done():   return
	case <-ticker.C:        s.tick()
	case <-commandTicker.C: s.pollAndExecuteCommands()
	}
}
```

- Heartbeat a cada `interval_seconds` (30 s em produção).
- Poll de comandos remotos a cada 30 s **fixos** (não configurável).
- Detecção de usuário/sessão: **nenhum evento** — apenas releitura de
  `os.Getenv("USERNAME")` a cada coleta (ver `ARCHITECTURE.md` §4).
- Ambos os handlers rodam **no mesmo select, de forma síncrona** — um
  `tick()` lento bloqueia o poll de comandos e vice-versa.

---

## 2. Goroutines, tickers e loops

### 2.1 O que está correto
- Ambos os tickers têm `defer ticker.Stop()` — **não há ticker vazando**.
- `tick()` e `pollAndExecuteCommands()` são chamados sincronamente dentro do
  `select`, então **não há acúmulo de goroutines por tick** (o `time.Ticker`
  do Go tem buffer 1 e descarta ticks perdidos em vez de enfileirar).
- Confirmei no benchmark: após 6 coletas, `runtime.NumGoroutine() == 1`.

### 2.2 **Risco alto: goroutines sem timeout podem travar o agente para sempre**

`collector/hardware.go`:
```go
for _, p := range parts {
	p := p
	wg.Add(1)
	go func() {
		defer wg.Done()
		d, err := disk.Usage(p.Mountpoint)   // <- sem timeout, sem context
		...
	}()
}
wg.Wait()   // <- espera INDEFINIDAMENTE
```

`disk.Partitions(false)` inclui unidades de rede mapeadas. Se um
compartilhamento SMB estiver morto/inacessível, `disk.Usage` naquele
mountpoint pode bloquear por dezenas de segundos ou indefinidamente. Como
`wg.Wait()` não tem timeout, **`Collect()` nunca retorna**, `tick()` nunca
completa e o loop principal fica preso para sempre — o agente para de enviar
heartbeat silenciosamente (o servidor o marca offline após 5 min) e para de
buscar comandos remotos, sem log de erro algum. Essas goroutines ficam
vazadas em definitivo.

Em ambiente AD corporativo com drives mapeados via GPO, este é um cenário
plausível, não hipotético.

### 2.3 Retry sem backoff, sem jitter, bloqueante

`sender/api.go`:
```go
const ( maxRetries = 3; retryInterval = 10 * time.Second; httpTimeout = 15 * time.Second )
...
for attempt := 1; attempt <= maxRetries; attempt++ {
	...
	if attempt < maxRetries { time.Sleep(retryInterval) }   // fixo, sem backoff exponencial
}
```

- Pior caso: 3 × 15 s (timeout) + 2 × 10 s (sleep) = **até 65 s bloqueado
  dentro de `tick()`**, com um ticker de 30 s. Durante isso, o poll de
  comandos remotos não roda.
- **Sem jitter**: numa queda do backend, toda a frota de agentes volta a
  tentar em lockstep, gerando *thundering herd* na retomada.

### 2.4 `os.Exit(0)` na bandeja descarta o encerramento limpo

`main.go` — o callback de "Sair" chama `os.Exit(0)` diretamente. Isso
**pula todos os `defer`**, incluindo o `defer logFile.Close()` do
`setupLogger()`: linhas de log ainda em buffer são perdidas, requisições
HTTP em voo são cortadas e o `ctx` do serviço nunca é cancelado.

### 2.5 Execução dupla

Se o serviço Windows estiver instalado **e** o usuário abrir o `.exe`
interativamente, rodam **dois agentes completos** simultaneamente — dois
ciclos de coleta, dois heartbeats, duas escritas de atalho. Não há mutex
nomeado (named mutex) nem checagem de instância única.

---

## 3. Medições

Benchmark isolado replicando exatamente as chamadas de `Collect()`, sem rede
(máquina: Windows 11, 12 núcleos, Go 1.26.1; média de 5 execuções após
aquecimento). O código do benchmark ficou no scratchpad da sessão, não no
repositório.

### 3.1 Baseline (código atual)

| Fase | Média |
|---|---|
| `os.Hostname` | 0,1 ms |
| `host.Info` (registro + WMI) | 0,4 ms |
| **`cpu.Percent(1s)` — bloqueante** | **1000,5 ms** |
| **`cpu.Info` (WMI)** | **44,5 ms** |
| `mem.VirtualMemory` | ~0 ms |
| `disk.Usage(C:)` | ~0 ms |
| `disk.Partitions` + `Usage` (goroutines) | 0,5 ms |
| **`net.Interfaces` (2×: `primaryIP` + loop)** | **81,9 ms** |
| **TOTAL por `Collect()`** | **1128 ms** |

- Dos quais **1001 ms (88,7 %) são o sleep fixo** de `cpu.Percent` — tempo de
  parede, não queima de CPU.
- **Trabalho real de CPU: 127 ms**, sendo `net.Interfaces` (81,9 ms) +
  `cpu.Info` (44,5 ms) = **126,4 ms, ou 99,5 % do total**.
- Primeira coleta (fria, com init do WMI): 1,174 s.
- Memória do runtime Go isolado: `HeapAlloc` 0,66 MB, `Sys` 11,08 MB, 1 goroutine.

### 3.2 Variante otimizada (medida, não estimada)

Apliquei três mudanças no benchmark: cache de `cpu.Info` (dado estático),
`net.Interfaces` uma única vez por coleta, e `cpu.Percent(0)` não-bloqueante.

| Fase | Média |
|---|---|
| `cpu.Percent(0)` — não-bloqueante | 0,1 ms |
| `cpu.Info` (cacheado) | 0 ms |
| `net.Interfaces` (1×) | 62 ms |
| demais fases somadas | ~1 ms |
| **TOTAL por `Collect()` otimizado** | **63 ms** |

### 3.3 Comparativo

| Métrica | Hoje | Otimizado | Ganho |
|---|---|---|---|
| Tempo de parede por coleta | 1128 ms | 63 ms | **−94 %** |
| CPU real por coleta | 127 ms | 63 ms | **−50 %** |
| CPU contínuo (1 núcleo, tick 30 s) | 0,42 % | 0,21 % | −50 % |
| CPU contínuo (total, 12 núcleos) | 0,035 % | 0,018 % | −50 % |

Com `net.Interfaces` também cacheado (item O3 abaixo), o custo cairia para
**~7 ms/coleta**, ou ~0,023 % de um núcleo — mas o ganho absoluto aqui já é
marginal.

### 3.4 Memória — **estimativa, não medição**

Não consegui medir o processo real: o serviço `OrionAgent` **não está
instalado nesta máquina** (`Get-Service` retornou erro) e optei por **não**
executar o `orion-agent.exe` versionado, porque ele enviaria heartbeats reais
para produção (`orion.bysam.dev`), criaria registro de máquina no banco,
gravaria token em `C:\ProgramData` e criaria atalho no Desktop.

O que medi foi só o runtime Go + gopsutil isolados: **`Sys` = 11,08 MB**.
Sobre isso, o agente real adiciona `getlantern/systray` (janela Win32 +
ícone), `kardianos/service` e `pkg/browser`. **Estimativa: 15–25 MB de
working set em idle** — compatível com a referência de "agente leve", e
improvável de ser o gargalo. Para confirmar: instalar em máquina de teste e
rodar `Get-Process orion-agent | Select WorkingSet64,PrivateMemorySize64`.

### 3.5 Custo de I/O (não medido, calculado)

`service/windows.go:tick()` chama `shortcut.CreatePortalShortcut(...)` **a
cada coleta**, que faz `os.WriteFile` incondicional do `.url` no Desktop.
Com intervalo de 30 s: 86400 / 30 = **2.880 gravações/dia** de um arquivo de
~100 bytes. Em NTFS (cluster de 4 KB) isso é ~11,5 MB/dia de amplificação de
escrita, para reescrever conteúdo idêntico — além do log, que também cresce
sem rotação.

---

## 4. Plano de otimização priorizado

Ordenado por (ganho × risco reduzido) / esforço. Ganhos de CPU/parede vêm das
medições da §3; os demais são calculados ou qualitativos.

### O1 — Timeout nas goroutines de disco · **Risco: baixo · Ganho: elimina travamento permanente**
Maior valor do plano — não é performance, é disponibilidade (§2.2).
```go
ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
defer cancel()
go func() {
	defer wg.Done()
	d, err := disk.UsageWithContext(ctx, p.Mountpoint) // gopsutil expõe variante com context
	...
}()
```
Adicionalmente, trocar `wg.Wait()` por espera com timeout global, para que uma
partição travada degrade a coleta em vez de matá-la.
**Risco:** baixo. Pior caso, uma partição lenta fica de fora daquele ciclo.

### O2 ✅ IMPLEMENTADO (item B.6 do IMPROVEMENT_PLAN.md) — `cpu.Percent` não-bloqueante · **Risco: baixo-médio · Ganho medido: −1000 ms de parede/coleta**
```go
// Uma vez, na inicialização do serviço: cpu.Percent(0, false)  // amostra inicial
// Em cada tick:
cpuPcts, err := cpu.Percent(0, false) // delta desde a chamada anterior — retorna imediatamente
```
Com intervalo de 30 s, o percentual passa a ser a média **do intervalo
inteiro** em vez de uma janela instantânea de 1 s — para monitoramento de
tendência isso é *melhor*, não pior (amostra de 1 s a cada 30 s é ruidosa e
não representativa).
**Risco:** médio-baixo. Muda a semântica da métrica `cpu_usage` — históricos
antigos e novos não são estritamente comparáveis. Vale documentar a mudança e
avaliar impacto nos alertas de CPU > 85 % (`lib/monitoring.go:CriticalAlerts`),
que podem disparar com frequência diferente.

### O3 — Cachear dados estáticos · **Risco: baixo · Ganho medido: −44,5 ms CPU/coleta (−35 %)**
`cpu.Info()` retorna o modelo do processador — imutável em máquina física.
Buscar uma vez na inicialização e reusar:
```go
type Collector struct{ cpuModel string /* preenchido 1x no New() */ }
```
`net.Interfaces` (62 ms, o maior custo remanescente) muda raramente — cachear
com refresh a cada N ciclos (ex.: 10) ou, melhor, invalidar via evento de
mudança de rede (`NotifyAddrChange`).
**Risco:** baixo. Mudança de hardware/adaptador só aparece após reinício do
agente ou do refresh periódico.

### O4 — `net.Interfaces` uma vez por coleta · **Risco: muito baixo · Ganho medido: −41 ms CPU/coleta**
`primaryIP()` e o loop de interfaces varrem a mesma lista duas vezes.
Derivar ambos de um único snapshot:
```go
ifaces, _ := net.Interfaces()
primary, list := buildFromSnapshot(ifaces) // uma varredura só
```
**Risco:** muito baixo — refatoração puramente local, sem mudança de semântica.

### O5 — Só reescrever o atalho quando mudar · **Risco: muito baixo · Ganho: −2.880 escritas/dia**
```go
if existing, err := os.ReadFile(shortcutPath); err == nil && string(existing) == content {
	return nil // nada mudou, não reescreve
}
```
**Risco:** muito baixo. (Ver também `SECURITY.md` F4 — há um motivo de
segurança independente para repensar esse atalho.)

### O6 — Backoff exponencial + jitter no retry · **Risco: baixo · Ganho: evita bloqueio de 65 s e thundering herd**
```go
backoff := time.Second
for attempt := 1; attempt <= maxRetries; attempt++ {
	...
	jitter := time.Duration(rand.Int63n(int64(backoff / 2)))
	time.Sleep(backoff + jitter)
	backoff *= 2
}
```
Complementar: mover o envio para fora do caminho crítico do `select`, para
que uma falha de rede não bloqueie o poll de comandos.
**Risco:** baixo.

### O7 — Eventos de sessão em vez de polling (`WTSRegisterSessionNotification`) · **Risco: médio-alto · Ganho: detecção instantânea, custo ~zero**
Este é o item que o pedido destacou, e vale um alerta de expectativa:
**ele não reduz consumo de forma relevante** — a leitura de `os.Getenv` que
ele substitui custa ~0 ms nas medições. O ganho real é de **corretude e
latência**: hoje a troca de usuário é detectada com até 30 s de atraso e,
no modelo de serviço (Session 0), **provavelmente não é detectada nunca**
(ver `ARCHITECTURE.md` §4).

```go
// Registrar uma janela de mensagens oculta e assinar notificações de sessão:
//   WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_ALL_SESSIONS)
// Reagir a WM_WTSSESSION_CHANGE com wParam:
//   WTS_SESSION_LOGON / WTS_SESSION_LOGOFF / WTS_SESSION_LOCK / WTS_SESSION_UNLOCK
// e disparar UM heartbeat imediato de "mudança de sessão", em vez de esperar o tick.
```
Combinar com `WTSQuerySessionInformation` + resolução de **SID** (não nome de
usuário) conforme `SECURITY-AUTO-PROVISIONING.md` §4.2.

**Risco: médio-alto.** Exige bombear uma message loop Win32 dentro de um
serviço Go (interop via `golang.org/x/sys/windows`), o que é a parte mais
delicada do plano — é fácil introduzir travamento ou vazamento de handle.
Precisa de teste em máquina de domínio real, com logon/logoff/RDP/troca
rápida de usuário. **Recomendo fazer por último**, depois que O1–O6
estabilizarem, e como mudança isolada com seu próprio ciclo de validação.

### O8 — Instância única + saída limpa · **Risco: baixo · Ganho: elimina consumo dobrado**
Named mutex do Windows (`CreateMutex` com nome global) para impedir execução
dupla (§2.5), e trocar `os.Exit(0)` por cancelamento de contexto +
`systray.Quit()`, permitindo que os `defer` rodem (§2.4).

---

## 5. Sequenciamento sugerido

Respeitando a regra do projeto de commits pequenos e testáveis, e de não
misturar refino com mudança de lógica:

1. **O1** (timeout de disco) — isolado, é correção de disponibilidade.
2. **O4 + O3 + O5** — otimizações puras de coleta/IO, sem mudar semântica de
   métrica. Medir antes/depois com o mesmo benchmark da §3.
3. **O6 + O8** — robustez de rede e ciclo de vida.
4. **O2** — mudança de semântica da métrica de CPU; merece commit próprio e
   validação de que os alertas continuam coerentes.
5. **O7** — reescrita da detecção de sessão; projeto à parte, com teste em
   ambiente AD real.

---

## 6. Como reproduzir as medições

O benchmark usado na §3 vive no scratchpad da sessão (não foi commitado).
Para transformá-lo em ferramenta permanente, o caminho natural é um
`collector/collect_bench_test.go` com `go test -bench=. -benchmem`, o que
permite comparar antes/depois de cada mudança com `benchstat`.

**Ressalvas de validade:** medições feitas em **uma** máquina (12 núcleos,
SSD, Windows 11, sem drives de rede mapeados) e **fora** do contexto de
serviço. Máquinas de parque corporativo — menos núcleos, HDD, drives SMB
mapeados, antivírus corporativo interceptando I/O — provavelmente mostrarão
custos **maiores**, especialmente em `disk.Partitions` e `net.Interfaces`.
O ganho relativo de O2/O3/O4 deve se manter ou aumentar; o risco de O1
(travamento por disco de rede) é justamente o que essas máquinas mais
exercitam.
