package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion-api/lib"
	"orion-api/monitor"
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

func TestStatusDoEstado(t *testing.T) {
	agora := time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC)
	casos := []struct {
		nome     string
		e        monitor.Estado
		esperado string
	}{
		{"estação vista há 5 min", monitor.Estado{DeviceType: "desktop", VistoEm: agora.Add(-5 * time.Minute)}, "online"},
		{"estação calada há 13 min", monitor.Estado{DeviceType: "desktop", VistoEm: agora.Add(-13 * time.Minute)}, "offline"},
		{"servidor calado há 4 min", monitor.Estado{DeviceType: "server", VistoEm: agora.Add(-4 * time.Minute)}, "offline"},
		{"online com alerta aberto", monitor.Estado{DeviceType: "desktop", VistoEm: agora, AlertasAbertos: 1}, "alerta"},
		{"offline com alerta aberto continua offline", monitor.Estado{DeviceType: "desktop", VistoEm: agora.Add(-time.Hour), AlertasAbertos: 2}, "offline"},
	}
	for _, c := range casos {
		if got := statusDoEstado(c.e, agora); got != c.esperado {
			t.Errorf("%s: %q, esperado %q", c.nome, got, c.esperado)
		}
	}
}
