package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"orion-api/monitor"
)

func comMonitorConfigurado(t *testing.T, url, segredo string) {
	t.Helper()
	urlAntes, segredoAntes := cfg.MonitorIngestURL, cfg.MonitorIngestSecret
	cfg.MonitorIngestURL, cfg.MonitorIngestSecret = url, segredo
	t.Cleanup(func() { cfg.MonitorIngestURL, cfg.MonitorIngestSecret = urlAntes, segredoAntes })
}

func TestEncaminharAoMonitor_DesligadoSemConfiguracao(t *testing.T) {
	var chamadas int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { atomic.AddInt32(&chamadas, 1) }))
	defer srv.Close()

	comMonitorConfigurado(t, srv.URL, "")
	encaminharAoMonitor(context.Background(), monitor.Amostra{Hostname: "PC"})
	comMonitorConfigurado(t, "", "segredo")
	encaminharAoMonitor(context.Background(), monitor.Amostra{Hostname: "PC"})

	if atomic.LoadInt32(&chamadas) != 0 {
		t.Fatal("repasse aconteceu sem URL e segredo configurados")
	}
}

func TestEncaminharAoMonitor_EnviaAmostraComSegredo(t *testing.T) {
	var recebida monitor.Amostra
	var auth, caminho string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth, caminho = r.Header.Get("Authorization"), r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&recebida)
	}))
	defer srv.Close()
	comMonitorConfigurado(t, srv.URL+"/", "segredo-x")

	req := &heartbeatReq{Hostname: "SAM-DESKTOP", CPUUsage: 42, RAMTotal: 8, RAMUsed: 4}
	quando := time.Date(2026, 9, 18, 12, 0, 0, 0, time.UTC)
	encaminharAoMonitor(context.Background(), amostraDoHeartbeat(req, "maq-1", "emp-1", "desktop", quando))

	if caminho != "/v1/ingest/heartbeat" || auth != "Bearer segredo-x" {
		t.Fatalf("caminho=%q auth=%q", caminho, auth)
	}
	if recebida.MachineID != "maq-1" || recebida.CompanyID != "emp-1" || recebida.CPUUsage != 42 || !recebida.RecebidaEm.Equal(quando) {
		t.Errorf("amostra recebida = %+v", recebida)
	}
}

func TestEncaminharAoMonitor_ServidorLentoNaoPrendeOHeartbeat(t *testing.T) {
	liberar := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-liberar:
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()
	defer close(liberar)
	comMonitorConfigurado(t, srv.URL, "segredo")

	inicio := time.Now()
	encaminharAoMonitor(context.Background(), monitor.Amostra{Hostname: "PC"})
	if d := time.Since(inicio); d > timeoutRepasse+time.Second {
		t.Errorf("repasse demorou %v, esperado no máximo ~%v", d, timeoutRepasse)
	}
}

func TestEncaminharAoMonitor_DevolveConfigDaSondaEMandaAMedicao(t *testing.T) {
	var recebida monitor.Amostra
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&recebida)
		_, _ = w.Write([]byte(`{"ok":true,"sonda":{"alvos":["1.1.1.1","8.8.8.8"],"descobrir_ip_saida":true}}`))
	}))
	defer srv.Close()
	comMonitorConfigurado(t, srv.URL, "segredo")

	req := &heartbeatReq{Hostname: "SRV-AD", Links: &monitor.AmostraDeLinks{IPSaida: "200.1.1.1",
		Testes: []monitor.TesteDeLink{{Alvo: "1.1.1.1", LatenciaMs: 12}}}}
	cfgSonda := encaminharAoMonitor(context.Background(), amostraDoHeartbeat(req, "maq-1", "emp-1", "server", time.Now()))

	if cfgSonda == nil || len(cfgSonda.Alvos) != 2 || !cfgSonda.DescobrirIPSaida {
		t.Fatalf("config da sonda não voltou: %+v", cfgSonda)
	}
	if recebida.Links == nil || recebida.Links.IPSaida != "200.1.1.1" || recebida.Links.Testes[0].LatenciaMs != 12 {
		t.Errorf("medição dos links não chegou ao monitor: %+v", recebida.Links)
	}
}

func TestEncaminharAoMonitor_SemSondaDevolveNil(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()
	comMonitorConfigurado(t, srv.URL, "segredo")
	if cfgSonda := encaminharAoMonitor(context.Background(), monitor.Amostra{Hostname: "PC"}); cfgSonda != nil {
		t.Errorf("máquina comum não deveria receber config de sonda: %+v", cfgSonda)
	}
}
