package sonda

import (
	"context"
	"errors"
	"net"
	"sync"
	"testing"
	"time"
)

func TestResumir(t *testing.T) {
	r := Resumir("1.1.1.1", []float64{10, 14, 12}, 5)
	if r.LatenciaMs != 12 || r.JitterMs != 3 || r.PerdaPct != 40 {
		t.Errorf("resumo errado: %+v", r)
	}
	if s := Resumir("8.8.8.8", nil, 5); s.PerdaPct != 100 || s.LatenciaMs != 0 {
		t.Errorf("sem resposta: %+v", s)
	}
}

func TestMedir_PingaSoIPv4EDescobreIPDeSaida(t *testing.T) {
	var mu sync.Mutex
	pingados := map[string]int{}
	pingar := func(ip net.IP, _ time.Duration) (time.Duration, error) {
		mu.Lock()
		pingados[ip.String()]++
		mu.Unlock()
		if ip.String() == "8.8.8.8" {
			return 0, errors.New("sem resposta")
		}
		return 20 * time.Millisecond, nil
	}
	cfg := Config{Alvos: []string{"1.1.1.1", "8.8.8.8", "::1", "gateway.local"}, DescobrirIPSaida: true}
	am := Medir(context.Background(), cfg, pingar, func(context.Context) string { return "200.1.1.1" })

	if am.IPSaida != "200.1.1.1" || len(am.Testes) != 2 {
		t.Fatalf("amostra: %+v", am)
	}
	for _, tt := range am.Testes {
		switch tt.Alvo {
		case "1.1.1.1":
			if tt.LatenciaMs != 20 || tt.PerdaPct != 0 {
				t.Errorf("1.1.1.1: %+v", tt)
			}
		case "8.8.8.8":
			if tt.PerdaPct != 100 {
				t.Errorf("8.8.8.8: %+v", tt)
			}
		}
	}
	if pingados["1.1.1.1"] != pingsPorAlvo {
		t.Errorf("pings em 1.1.1.1: %d", pingados["1.1.1.1"])
	}
}

func TestMedir_SemDescobrirIPNaoChamaOServico(t *testing.T) {
	am := Medir(context.Background(), Config{}, nil, func(context.Context) string {
		t.Fatal("não deveria descobrir IP")
		return ""
	})
	if am.IPSaida != "" || len(am.Testes) != 0 {
		t.Errorf("amostra: %+v", am)
	}
}
