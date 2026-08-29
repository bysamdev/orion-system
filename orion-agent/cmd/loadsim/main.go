// Command loadsim é o simulador de carga da Fase 11 do plano de
// escalabilidade: reproduz N agentes falsos batendo heartbeat/poll de
// comandos/resposta de comando contra uma API Orion real, na mesma cadência
// e formato de payload que orion-agent usaria — para medir capacidade real
// em vez de estimar. Reaproveita orion-agent/sender e orion-agent/config
// (mesmo código que o agente de produção usa) de propósito: um simulador
// que fala um protocolo "parecido" mas não idêntico mediria a capacidade do
// protocolo errado.
//
// NÃO SIMULA (fora do escopo deste primeiro simulador — client-side não
// enxerga estas métricas, precisam vir do lado do servidor/infra):
//   - CPU/RAM/disco da API ou do banco;
//   - séries do Prometheus, WAL, IOPS;
//   - carga do Supabase, duração de Edge Functions.
//
// O relatório final cobre só o que este processo observa como cliente:
// requests/segundo, latência, taxa de erro, throughput de bytes.
//
// Uso:
//
//	go run ./cmd/loadsim -url https://sua-api.exemplo.com -agent-key SEU_AGENT_KEY -count 100 -duration 5m
//
// IMPORTANTE: nunca aponte para produção sem autorização explícita — mesmo
// com o rate limiting da Fase 9, uma carga grande o suficiente ainda é uma
// ação com impacto real. Comece pequeno (100 agentes) e suba
// progressivamente (250 → 500 → 1000 → 2500), conforme a Fase 13 do plano.
//
// LIMITAÇÃO CONHECIDA: -duration marca quando parar de INICIAR novos ciclos,
// não corta um sender.Send já em andamento — sender.Send não aceita um
// context, então uma tentativa presa no próprio retry interno (até ~7s de
// backoff quando o alvo está fora do ar) termina antes do processo encerrar.
// Verificado: contra um alvo indisponível, o teste roda alguns segundos além
// de -duration. Mesma limitação existe no agente real (não é um defeito
// exclusivo deste simulador) — para medir capacidade de verdade isso não
// importa (o alvo está de pé), só afetaria testar contra um alvo já fora
// do ar de propósito.
package main

import (
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand/v2"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"orion-agent/collector"
	"orion-agent/config"
	"orion-agent/sender"
)

// perfilFrota reproduz a distribuição de tipos de ativo descrita para este
// parque: "muitas estações de trabalho, alguns servidores e notebooks
// também" — não uma distribuição uniforme entre os três, que mediria um
// cenário que não é o real.
var perfilFrota = []struct {
	tipo string
	peso int
}{
	{"desktop", 70},
	{"notebook", 20},
	{"server", 10},
}

func sortearDeviceType(rng *rand.Rand) string {
	total := 0
	for _, p := range perfilFrota {
		total += p.peso
	}
	n := rng.IntN(total)
	for _, p := range perfilFrota {
		if n < p.peso {
			return p.tipo
		}
		n -= p.peso
	}
	return "desktop"
}

func gerarTokenAleatorio() string {
	buf := make([]byte, 32)
	_, _ = crand.Read(buf)
	return hex.EncodeToString(buf)
}

// ─── Estatísticas ────────────────────────────────────────────────────────────

type contadorErros struct {
	mu      sync.Mutex
	porTipo map[string]int64
}

func novoContadorErros() *contadorErros {
	return &contadorErros{porTipo: make(map[string]int64)}
}

func (c *contadorErros) registrar(err error) {
	tipo := classificarErro(err)
	c.mu.Lock()
	c.porTipo[tipo]++
	c.mu.Unlock()
}

func (c *contadorErros) snapshot() map[string]int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make(map[string]int64, len(c.porTipo))
	for k, v := range c.porTipo {
		out[k] = v
	}
	return out
}

// classificarErro agrupa erros por categoria ampla (timeout, status HTTP,
// conexão recusada, DNS, etc.) — útil no relatório final para separar "o
// backend está rejeitando" de "o backend está fora do ar".
func classificarErro(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	switch {
	case strings.Contains(msg, "context deadline exceeded"), strings.Contains(msg, "Client.Timeout"):
		return "timeout"
	case strings.Contains(msg, "status HTTP 429"):
		return "rate_limited_429"
	case strings.Contains(msg, "status HTTP 5"):
		return "erro_servidor_5xx"
	case strings.Contains(msg, "status HTTP 4"):
		return "erro_cliente_4xx"
	case strings.Contains(msg, "connection refused"):
		return "conexao_recusada"
	case strings.Contains(msg, "no such host"):
		return "dns_falhou"
	default:
		return "outro"
	}
}

type estatisticasCiclo struct {
	sucesso  int64
	falha    int64
	latencia []time.Duration
	mu       sync.Mutex
}

func (e *estatisticasCiclo) registrar(dur time.Duration, err error) {
	if err == nil {
		atomic.AddInt64(&e.sucesso, 1)
	} else {
		atomic.AddInt64(&e.falha, 1)
	}
	e.mu.Lock()
	e.latencia = append(e.latencia, dur)
	e.mu.Unlock()
}

func (e *estatisticasCiclo) percentis() (p50, p95, p99, max time.Duration) {
	e.mu.Lock()
	defer e.mu.Unlock()
	n := len(e.latencia)
	if n == 0 {
		return 0, 0, 0, 0
	}
	cop := make([]time.Duration, n)
	copy(cop, e.latencia)
	sort.Slice(cop, func(i, j int) bool { return cop[i] < cop[j] })
	idx := func(pct float64) time.Duration {
		i := int(float64(n-1) * pct)
		return cop[i]
	}
	return idx(0.50), idx(0.95), idx(0.99), cop[n-1]
}

type estatisticas struct {
	heartbeats    estatisticasCiclo
	polls         estatisticasCiclo
	respostas     estatisticasCiclo
	erros         *contadorErros
	bytesEnviados int64
	inicio        time.Time
}

func novasEstatisticas() *estatisticas {
	return &estatisticas{erros: novoContadorErros(), inicio: time.Now()}
}

func (s *estatisticas) total() (sucesso, falha int64) {
	return atomic.LoadInt64(&s.heartbeats.sucesso) + atomic.LoadInt64(&s.polls.sucesso) + atomic.LoadInt64(&s.respostas.sucesso),
		atomic.LoadInt64(&s.heartbeats.falha) + atomic.LoadInt64(&s.polls.falha) + atomic.LoadInt64(&s.respostas.falha)
}

func (s *estatisticas) relatarProgresso() {
	decorrido := time.Since(s.inicio)
	sucesso, falha := s.total()
	total := sucesso + falha
	var reqPorSeg float64
	if decorrido.Seconds() > 0 {
		reqPorSeg = float64(total) / decorrido.Seconds()
	}
	p50, p95, p99, max := s.heartbeats.percentis()
	log.Printf("[PROGRESSO %s] heartbeats: %d ok / %d falha | req/s (todos os tipos): %.1f | latência heartbeat p50=%s p95=%s p99=%s max=%s",
		decorrido.Round(time.Second), atomic.LoadInt64(&s.heartbeats.sucesso), atomic.LoadInt64(&s.heartbeats.falha),
		reqPorSeg, p50.Round(time.Millisecond), p95.Round(time.Millisecond), p99.Round(time.Millisecond), max.Round(time.Millisecond))
}

func (s *estatisticas) relatorioFinal(agentesSimulados int) {
	decorrido := time.Since(s.inicio)
	sucessoHB, falhaHB := atomic.LoadInt64(&s.heartbeats.sucesso), atomic.LoadInt64(&s.heartbeats.falha)
	sucessoPoll, falhaPoll := atomic.LoadInt64(&s.polls.sucesso), atomic.LoadInt64(&s.polls.falha)
	sucessoResp, falhaResp := atomic.LoadInt64(&s.respostas.sucesso), atomic.LoadInt64(&s.respostas.falha)
	totalSucesso, totalFalha := s.total()
	totalReq := totalSucesso + totalFalha

	p50, p95, p99, max := s.heartbeats.percentis()

	fmt.Println()
	fmt.Println("=== RELATÓRIO FINAL — loadsim (Fase 11 do plano de escalabilidade) ===")
	fmt.Printf("Agentes simulados:         %d\n", agentesSimulados)
	fmt.Printf("Duração real do teste:     %s\n", decorrido.Round(time.Second))
	fmt.Println()
	fmt.Printf("Heartbeats:   %d ok, %d falha\n", sucessoHB, falhaHB)
	fmt.Printf("Polls RMM:    %d ok, %d falha\n", sucessoPoll, falhaPoll)
	fmt.Printf("Respostas:    %d ok, %d falha\n", sucessoResp, falhaResp)
	fmt.Printf("Total:        %d requisições (%d ok, %d falha — %.2f%% de erro)\n",
		totalReq, totalSucesso, totalFalha, pctErro(totalFalha, totalReq))
	if decorrido.Seconds() > 0 {
		fmt.Printf("Vazão média:  %.1f req/s | %.1f KB/s enviados\n",
			float64(totalReq)/decorrido.Seconds(), float64(atomic.LoadInt64(&s.bytesEnviados))/1024/decorrido.Seconds())
	}
	fmt.Println()
	fmt.Printf("Latência de heartbeat — p50=%s  p95=%s  p99=%s  max=%s\n",
		p50.Round(time.Millisecond), p95.Round(time.Millisecond), p99.Round(time.Millisecond), max.Round(time.Millisecond))
	fmt.Println()
	fmt.Println("Erros por categoria:")
	erros := s.erros.snapshot()
	if len(erros) == 0 {
		fmt.Println("  (nenhum)")
	}
	for tipo, n := range erros {
		fmt.Printf("  %-20s %d\n", tipo, n)
	}
	fmt.Println()
	fmt.Println("Lembrete: este relatório cobre só o que o cliente enxerga.")
	fmt.Println("CPU/RAM da API, carga do Postgres, séries do Prometheus etc. precisam ser")
	fmt.Println("medidas do lado do servidor/infra durante a mesma janela (Fase 13 do plano).")
}

func pctErro(falha, total int64) float64 {
	if total == 0 {
		return 0
	}
	return float64(falha) / float64(total) * 100
}

// payloadSintetico monta um payload realista, mas sem depender de hardware
// real (collector.Collect() leria a máquina que roda o simulador, não faz
// sentido aqui — cada "agente" simulado precisa do seu próprio hostname/
// token/perfil de hardware distintos).
func payloadSintetico(indice int, machineToken string, deviceType string, rng *rand.Rand) *collector.Payload {
	ramTotal := uint64(17179869184) // 16 GiB
	diskTotal := uint64(512110190592)
	return &collector.Payload{
		MachineToken:     machineToken,
		MachineUUID:      fmt.Sprintf("loadsim-%08d", indice),
		Hostname:         fmt.Sprintf("LOADSIM-%05d", indice),
		IP:               fmt.Sprintf("10.%d.%d.%d", rng.IntN(255), rng.IntN(255), rng.IntN(255)),
		OS:               "windows",
		OSVersion:        "10.0.19045",
		CPUUsage:         rng.Float64() * 100,
		RAMTotal:         ramTotal,
		RAMUsed:          uint64(rng.Float64() * float64(ramTotal)),
		DiskTotal:        diskTotal,
		DiskUsed:         uint64(rng.Float64() * float64(diskTotal)),
		Uptime:           uint64(rng.IntN(30 * 24 * 3600)),
		CPUModel:         "Intel(R) Core(TM) i5 (simulado)",
		Domain:           "CORP",
		CurrentUser:      fmt.Sprintf("CORP\\usuario%d", indice),
		MACAddress:       fmt.Sprintf("02:00:00:%02x:%02x:%02x", rng.IntN(256), rng.IntN(256), rng.IntN(256)),
		DeviceType:       deviceType,
		DeviceTypeReason: "loadsim: sorteado por perfilFrota",
		AgentVersion:     "loadsim-1.0.0",
	}
}

// simularAgente reproduz o ciclo de vida de um único agente: heartbeat no
// intervalo configurado, poll de comandos a cada 30s (mesma cadência fixa
// do agente real hoje — ver service/windows.go), e uma resposta simulada
// quando o poll trouxer algum comando.
func simularAgente(indice int, cfg *config.Config, heartbeatInterval time.Duration, simularPoll bool, fim <-chan struct{}, stats *estatisticas, wg *sync.WaitGroup) {
	defer wg.Done()

	rng := rand.New(rand.NewPCG(uint64(indice), uint64(time.Now().UnixNano())))
	machineToken := gerarTokenAleatorio()
	deviceType := sortearDeviceType(rng)

	var machineID string

	cicloHeartbeat := func() {
		payload := payloadSintetico(indice, machineToken, deviceType, rng)
		body, _ := json.Marshal(payload)
		inicio := time.Now()
		mID, _, err := sender.Send(cfg, payload)
		stats.heartbeats.registrar(time.Since(inicio), err)
		if err == nil {
			machineID = mID
			atomic.AddInt64(&stats.bytesEnviados, int64(len(body)))
		} else {
			stats.erros.registrar(err)
		}
	}

	cicloPoll := func() {
		if machineID == "" {
			return
		}
		inicio := time.Now()
		cmds, err := sender.PollCommands(cfg, machineID)
		stats.polls.registrar(time.Since(inicio), err)
		if err != nil {
			stats.erros.registrar(err)
			return
		}
		for _, c := range cmds {
			inicioResp := time.Now()
			err := sender.RespondToCommand(cfg, c.ID, "completed", "simulado pelo loadsim")
			stats.respostas.registrar(time.Since(inicioResp), err)
			if err != nil {
				stats.erros.registrar(err)
			}
		}
	}

	cicloHeartbeat()

	heartbeatTicker := time.NewTicker(heartbeatInterval)
	defer heartbeatTicker.Stop()

	var pollTicker *time.Ticker
	var pollC <-chan time.Time
	if simularPoll {
		pollTicker = time.NewTicker(30 * time.Second)
		defer pollTicker.Stop()
		pollC = pollTicker.C
	}

	for {
		select {
		case <-fim:
			return
		case <-heartbeatTicker.C:
			cicloHeartbeat()
		case <-pollC:
			cicloPoll()
		}
	}
}

func main() {
	apiURL := flag.String("url", "", "URL base da API Orion (ex.: https://sua-api.exemplo.com)")
	agentKey := flag.String("agent-key", "", "X-Agent-Key a usar em todos os agentes simulados")
	count := flag.Int("count", 100, "número de agentes simulados")
	duration := flag.Duration("duration", 5*time.Minute, "duração do teste")
	heartbeatInterval := flag.Duration("heartbeat-interval", 60*time.Second, "intervalo de heartbeat por agente simulado")
	rampUp := flag.Duration("ramp-up", 30*time.Second, "espalha o início dos agentes simulados ao longo deste tempo — 0 faz todos começarem juntos, reproduzindo o cenário H do plano (reconexão simultânea em massa)")
	simularPoll := flag.Bool("poll-commands", true, "também simula o polling de comandos RMM a cada 30s")
	progressoA_cada := flag.Duration("progress-interval", 15*time.Second, "intervalo entre linhas de progresso no terminal")
	flag.Parse()

	if *apiURL == "" || *agentKey == "" {
		fmt.Fprintln(os.Stderr, "uso: loadsim -url https://sua-api.exemplo.com -agent-key SEU_AGENT_KEY [-count 100] [-duration 5m]")
		fmt.Fprintln(os.Stderr, "\nNUNCA aponte para produção sem autorização explícita.")
		os.Exit(1)
	}

	// sender.httpClient tem timeout fixo de 15s — mesmo valor do agente real,
	// deixado como está de propósito: um heartbeat que demora mais que isso
	// sob carga já é, em si, um resultado relevante do teste, não algo a
	// esconder afrouxando o timeout.
	cfg := &config.Config{APIURL: *apiURL, AgentKey: *agentKey, IntervalSeconds: int(heartbeatInterval.Seconds())}

	log.Printf("Iniciando loadsim: %d agentes, intervalo de heartbeat %s, ramp-up %s, duração %s, alvo %s",
		*count, *heartbeatInterval, *rampUp, *duration, *apiURL)

	stats := novasEstatisticas()
	fim := make(chan struct{})
	time.AfterFunc(*duration, func() { close(fim) })

	var wg sync.WaitGroup
	for i := 0; i < *count; i++ {
		wg.Add(1)
		atraso := time.Duration(0)
		if *rampUp > 0 {
			atraso = time.Duration(rand.N(int64(*rampUp)))
		}
		go func(indice int, atraso time.Duration) {
			select {
			case <-time.After(atraso):
			case <-fim:
				wg.Done()
				return
			}
			simularAgente(indice, cfg, *heartbeatInterval, *simularPoll, fim, stats, &wg)
		}(i, atraso)
	}

	progresso := time.NewTicker(*progressoA_cada)
	defer progresso.Stop()
	go func() {
		for {
			select {
			case <-fim:
				return
			case <-progresso.C:
				stats.relatarProgresso()
			}
		}
	}()

	wg.Wait()
	stats.relatorioFinal(*count)
}
