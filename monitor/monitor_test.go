package monitor

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type storeFalso struct {
	gravadas []Amostra
	abertos  []Alerta
	normais  []string
	falhar   bool
}

func (s *storeFalso) Gravar(_ context.Context, a *Amostra, abertos []Alerta, normais []string) error {
	if s.falhar {
		return errors.New("banco fora")
	}
	s.gravadas = append(s.gravadas, *a)
	s.abertos, s.normais = abertos, normais
	return nil
}
func (s *storeFalso) UltimasAmostras(context.Context) ([]Amostra, error) { return s.gravadas, nil }
func (s *storeFalso) Pronto(context.Context) error                       { return nil }

const segredo = "segredo-de-teste"

var instante = time.Date(2026, 9, 18, 12, 0, 0, 0, time.UTC)

func amostraValida() Amostra {
	return Amostra{
		MachineID: "11111111-1111-1111-1111-111111111111", CompanyID: "22222222-2222-2222-2222-222222222222",
		Hostname: "SAM-DESKTOP", DeviceType: "desktop", CPUUsage: 12,
		RAMTotal: 1000, RAMUsed: 500, DiskTotal: 1000, DiskUsed: 950, Uptime: 3600,
		Security:   json.RawMessage(`{"antivirus":[{"name":"Defender","active":true}],"firewall_active":false}`),
		RecebidaEm: instante,
	}
}

func enviar(t *testing.T, srv *Servidor, auth string, corpo any) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(corpo)
	req := httptest.NewRequest(http.MethodPost, "/v1/ingest/heartbeat", strings.NewReader(string(b)))
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	rec := httptest.NewRecorder()
	srv.RotasPublicas().ServeHTTP(rec, req)
	return rec
}

func novoServidor(store Store) *Servidor {
	return &Servidor{Store: store, Metricas: NovasMetricas(), SegredoIngest: segredo}
}

func TestIngest_RecusaSemSegredoCorreto(t *testing.T) {
	store := &storeFalso{}
	srv := novoServidor(store)
	for _, auth := range []string{"", "Bearer errado", segredo, "Bearer " + segredo + "x"} {
		if rec := enviar(t, srv, auth, amostraValida()); rec.Code != http.StatusUnauthorized {
			t.Errorf("auth %q: status %d, esperado 401", auth, rec.Code)
		}
	}
	if len(store.gravadas) != 0 {
		t.Fatal("amostra não autenticada foi gravada")
	}
}

func TestIngest_SemSegredoConfiguradoRecusaTudo(t *testing.T) {
	srv := novoServidor(&storeFalso{})
	srv.SegredoIngest = ""
	if rec := enviar(t, srv, "Bearer ", amostraValida()); rec.Code != http.StatusUnauthorized {
		t.Errorf("status %d, esperado 401", rec.Code)
	}
}

func TestIngest_GravaEAvaliaAlertas(t *testing.T) {
	store := &storeFalso{}
	srv := novoServidor(store)
	rec := enviar(t, srv, "Bearer "+segredo, amostraValida())
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if len(store.gravadas) != 1 {
		t.Fatalf("gravadas = %d, esperado 1", len(store.gravadas))
	}
	tipos := map[string]bool{}
	for _, a := range store.abertos {
		tipos[a.Tipo] = true
	}
	// Disco a 95% e firewall desligado abrem; CPU, RAM e antivírus normalizam.
	if !tipos["disk"] || !tipos["firewall"] || len(store.abertos) != 2 {
		t.Errorf("abertos = %+v, esperado disk e firewall", store.abertos)
	}
	if strings.Join(store.normais, ",") != "cpu,ram,antivirus" {
		t.Errorf("normais = %v", store.normais)
	}
}

func TestIngest_RecusaAmostraInvalida(t *testing.T) {
	casos := map[string]func(a *Amostra){
		"sem machine_id":   func(a *Amostra) { a.MachineID = "" },
		"sem hostname":     func(a *Amostra) { a.Hostname = " " },
		"sem recebida_em":  func(a *Amostra) { a.RecebidaEm = time.Time{} },
		"métrica negativa": func(a *Amostra) { a.CPUUsage = -1 },
	}
	for nome, estragar := range casos {
		store := &storeFalso{}
		a := amostraValida()
		estragar(&a)
		if rec := enviar(t, novoServidor(store), "Bearer "+segredo, a); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d, esperado 400", nome, rec.Code)
		}
		if len(store.gravadas) != 0 {
			t.Errorf("%s: amostra inválida gravada", nome)
		}
	}
}

func TestIngest_FalhaNoBancoResponde503(t *testing.T) {
	srv := novoServidor(&storeFalso{falhar: true})
	if rec := enviar(t, srv, "Bearer "+segredo, amostraValida()); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status %d, esperado 503", rec.Code)
	}
}

func TestAvaliarAlertas_NaoNormalizaOQueNaoFoiMedido(t *testing.T) {
	a := amostraValida()
	a.RAMTotal, a.DiskTotal, a.Security = 0, 0, nil
	abertos, normais := AvaliarAlertas(&a)
	if len(abertos) != 0 || strings.Join(normais, ",") != "cpu" {
		t.Errorf("abertos=%v normais=%v, esperado só cpu normal", abertos, normais)
	}
}

func TestMetricas_ExpoeUltimaAmostraEIgnoraAtrasada(t *testing.T) {
	m := NovasMetricas()
	a := amostraValida()
	m.Registrar(a)
	velha := a
	velha.CPUUsage = 99
	velha.RecebidaEm = instante.Add(-time.Minute)
	m.Registrar(velha)

	var sb strings.Builder
	m.Escrever(&sb)
	saida := sb.String()
	for _, esperado := range []string{
		`orion_machine_cpu_percent{machine_id="11111111-1111-1111-1111-111111111111",company_id="22222222-2222-2222-2222-222222222222",hostname="SAM-DESKTOP",device_type="desktop"} 12`,
		`orion_machine_memory_percent{`,
		`orion_machine_disk_percent{`,
		"orion_monitor_machines 1",
	} {
		if !strings.Contains(saida, esperado) {
			t.Errorf("/metrics sem %q:\n%s", esperado, saida)
		}
	}
}

func TestMetricas_SemTotalNaoPublicaPercentual(t *testing.T) {
	m := NovasMetricas()
	a := amostraValida()
	a.RAMTotal = 0
	m.Registrar(a)
	var sb strings.Builder
	m.Escrever(&sb)
	if strings.Contains(sb.String(), "orion_machine_memory_percent{") {
		t.Error("percentual de memória publicado sem total — apareceria como 0%")
	}
}

func TestMetricas_EscapaLabels(t *testing.T) {
	m := NovasMetricas()
	a := amostraValida()
	a.Hostname = `PC "1"\n`
	m.Registrar(a)
	var sb strings.Builder
	m.Escrever(&sb)
	if !strings.Contains(sb.String(), `hostname="PC \"1\"\\n"`) {
		t.Errorf("hostname não escapado:\n%s", sb.String())
	}
}

func TestRotasPublicas_NaoExpoemMetricas(t *testing.T) {
	srv := novoServidor(&storeFalso{})
	rec := httptest.NewRecorder()
	srv.RotasPublicas().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("/metrics na porta pública respondeu %d, esperado 404", rec.Code)
	}
	rec = httptest.NewRecorder()
	srv.RotasInternas().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("/metrics na porta interna respondeu %d, esperado 200", rec.Code)
	}
}
