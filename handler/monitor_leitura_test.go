package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion-api/lib"
)

func maquinaDoSupabase(id string, cpu float64, visto time.Time) lib.MachineWithMetric {
	var m lib.MachineWithMetric
	m.ID = id
	m.CPUUsage = &cpu
	m.LastSeen = &visto
	return m
}

func TestSobreporEstado_UsaMonitorEMantemQuemEleNaoConhece(t *testing.T) {
	agora := time.Date(2026, 9, 19, 1, 0, 0, 0, time.UTC)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/estado" || r.Header.Get("Authorization") != "Bearer s" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Write([]byte(`[{"machine_id":"a","cpu_usage":42,"ram_total":8,"ram_used":4,"visto_em":"2026-09-19T01:00:00Z","security_info":{"firewall_active":true}}]`))
	}))
	defer srv.Close()
	comMonitorConfigurado(t, srv.URL, "s")

	maquinas := []lib.MachineWithMetric{
		maquinaDoSupabase("a", 10, agora.Add(-5*time.Minute)),
		maquinaDoSupabase("b", 11, agora.Add(-5*time.Minute)),
	}
	if fonte := sobreporEstadoDoMonitor(context.Background(), maquinas); fonte != "monitor" {
		t.Fatalf("fonte = %q", fonte)
	}
	if *maquinas[0].CPUUsage != 42 || !maquinas[0].LastSeen.Equal(agora) || maquinas[0].SecurityInfo == nil {
		t.Errorf("máquina a não recebeu o estado do monitor: cpu=%v last_seen=%v", *maquinas[0].CPUUsage, maquinas[0].LastSeen)
	}
	if *maquinas[1].CPUUsage != 11 {
		t.Error("máquina b, que o monitor não conhece, perdeu o dado do Supabase")
	}
}

func TestSobreporEstado_LastSeenNuncaVoltaNoTempo(t *testing.T) {
	recente := time.Date(2026, 9, 19, 1, 0, 0, 0, time.UTC)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`[{"machine_id":"a","cpu_usage":1,"visto_em":"2026-09-19T00:50:00Z"}]`))
	}))
	defer srv.Close()
	comMonitorConfigurado(t, srv.URL, "s")

	maquinas := []lib.MachineWithMetric{maquinaDoSupabase("a", 10, recente)}
	sobreporEstadoDoMonitor(context.Background(), maquinas)
	if !maquinas[0].LastSeen.Equal(recente) {
		t.Errorf("last_seen voltou para %v", maquinas[0].LastSeen)
	}
}

func TestSobreporEstado_MonitorForaMantemSupabase(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()
	comMonitorConfigurado(t, srv.URL, "s")

	maquinas := []lib.MachineWithMetric{maquinaDoSupabase("a", 10, time.Now())}
	if fonte := sobreporEstadoDoMonitor(context.Background(), maquinas); fonte != "supabase (monitor indisponível)" {
		t.Errorf("fonte = %q", fonte)
	}
	if *maquinas[0].CPUUsage != 10 {
		t.Error("dado do Supabase foi alterado com o monitor fora")
	}
}

func TestSobreporEstado_SemConfiguracaoNemChama(t *testing.T) {
	comMonitorConfigurado(t, "", "")
	if fonte := sobreporEstadoDoMonitor(context.Background(), []lib.MachineWithMetric{maquinaDoSupabase("a", 1, time.Now())}); fonte != "supabase" {
		t.Errorf("fonte = %q", fonte)
	}
}

func TestHistoricoCobreJanela(t *testing.T) {
	agora := time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC)
	serie := func(maisAntigo time.Time) []lib.MetricRow {
		return []lib.MetricRow{{CollectedAt: agora}, {CollectedAt: maisAntigo}}
	}
	casos := []struct {
		nome   string
		pontos []lib.MetricRow
		janela time.Duration
		cobre  bool
	}{
		{"vazia", nil, time.Hour, false},
		{"cobre 1h", serie(agora.Add(-59 * time.Minute)), time.Hour, true},
		{"falta pouco, dentro da tolerância", serie(agora.Add(-45 * time.Minute)), time.Hour, true},
		{"só 3h numa janela de 24h", serie(agora.Add(-3 * time.Hour)), 24 * time.Hour, false},
	}
	for _, c := range casos {
		if got := historicoCobreJanela(c.pontos, c.janela, agora); got != c.cobre {
			t.Errorf("%s: %v, esperado %v", c.nome, got, c.cobre)
		}
	}
}
