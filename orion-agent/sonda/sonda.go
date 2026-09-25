// Package sonda mede os links de internet do cliente a partir do servidor
// dele. Quem decide o que medir é o Orion Monitor: a configuração chega na
// resposta do heartbeat e o resultado vai no heartbeat seguinte.
//
// Só roda quando o monitor manda configuração; nas demais máquinas não faz
// nada nem abre conexão.
package sonda

import (
	"context"
	"errors"
	"io"
	"math"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Config é o que medir. Mesmo formato de monitor.ConfigDaSonda.
type Config struct {
	Alvos            []string `json:"alvos"`
	DescobrirIPSaida bool     `json:"descobrir_ip_saida"`
}

// Teste é o resultado dos pings para um alvo.
type Teste struct {
	Alvo       string  `json:"alvo"`
	LatenciaMs float64 `json:"latencia_ms"`
	JitterMs   float64 `json:"jitter_ms"`
	PerdaPct   float64 `json:"perda_pct"`
}

// Amostra vai no heartbeat. Mesmo formato de monitor.AmostraDeLinks.
type Amostra struct {
	IPSaida string  `json:"ip_saida"`
	Testes  []Teste `json:"testes"`
}

// Pingador envia um eco ICMP e devolve o tempo de ida e volta.
type Pingador func(alvo net.IP, timeout time.Duration) (time.Duration, error)

// Limites: a sonda nunca mede mais que isso, mesmo que a configuração peça.
const (
	maximoAlvos      = 10
	pingsPorAlvo     = 5
	intervaloDePing  = 200 * time.Millisecond
	timeoutDoPing    = time.Second
	timeoutIPDeSaida = 4 * time.Second
)

// ErrNaoSuportado: o sistema não tem pingador (só Windows tem, por enquanto).
var ErrNaoSuportado = errors.New("medição de links não suportada neste sistema")

// Medir pinga os alvos em paralelo e descobre o IP de saída. Alvo que não é
// IPv4 é ignorado.
func Medir(ctx context.Context, cfg Config, pingar Pingador, ipDeSaida func(context.Context) string) *Amostra {
	am := &Amostra{Testes: []Teste{}}
	alvos := cfg.Alvos
	if len(alvos) > maximoAlvos {
		alvos = alvos[:maximoAlvos]
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	for _, alvo := range alvos {
		ip := net.ParseIP(strings.TrimSpace(alvo)).To4()
		if ip == nil {
			continue
		}
		wg.Add(1)
		go func(alvo string, ip net.IP) {
			defer wg.Done()
			t := pingarAlvo(ctx, alvo, ip, pingar)
			mu.Lock()
			am.Testes = append(am.Testes, t)
			mu.Unlock()
		}(alvo, ip)
	}
	if cfg.DescobrirIPSaida && ipDeSaida != nil {
		am.IPSaida = ipDeSaida(ctx)
	}
	wg.Wait()
	return am
}

func pingarAlvo(ctx context.Context, alvo string, ip net.IP, pingar Pingador) Teste {
	var tempos []float64
	for i := 0; i < pingsPorAlvo; i++ {
		if ctx.Err() != nil {
			break
		}
		if d, err := pingar(ip, timeoutDoPing); err == nil {
			tempos = append(tempos, float64(d.Microseconds())/1000)
		}
		if i < pingsPorAlvo-1 {
			select {
			case <-ctx.Done():
			case <-time.After(intervaloDePing):
			}
		}
	}
	return Resumir(alvo, tempos, pingsPorAlvo)
}

// Resumir calcula latência média, jitter (média da diferença entre pings
// seguidos) e perda.
func Resumir(alvo string, tempos []float64, enviados int) Teste {
	t := Teste{Alvo: alvo, PerdaPct: 100}
	if enviados <= 0 {
		return t
	}
	t.PerdaPct = arredondar(float64(enviados-len(tempos)) / float64(enviados) * 100)
	if len(tempos) == 0 {
		return t
	}
	var soma, variacao float64
	for i, v := range tempos {
		soma += v
		if i > 0 {
			variacao += math.Abs(v - tempos[i-1])
		}
	}
	t.LatenciaMs = arredondar(soma / float64(len(tempos)))
	if len(tempos) > 1 {
		t.JitterMs = arredondar(variacao / float64(len(tempos)-1))
	}
	return t
}

func arredondar(v float64) float64 { return math.Round(v*10) / 10 }

// Serviços que devolvem só o IP público em texto. O segundo é reserva.
var servicosDeIP = []string{"https://api.ipify.org", "https://ifconfig.me/ip"}

// IPDeSaida descobre o IP público por onde a internet sai agora: é o que diz
// qual link está em uso. Vazio se nenhum serviço respondeu.
func IPDeSaida(ctx context.Context) string {
	cliente := &http.Client{Timeout: timeoutIPDeSaida}
	for _, url := range servicosDeIP {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			continue
		}
		resp, err := cliente.Do(req)
		if err != nil {
			continue
		}
		corpo, _ := io.ReadAll(io.LimitReader(resp.Body, 64))
		resp.Body.Close()
		ip := net.ParseIP(strings.TrimSpace(string(corpo)))
		if resp.StatusCode == http.StatusOK && ip != nil {
			return ip.String()
		}
	}
	return ""
}
