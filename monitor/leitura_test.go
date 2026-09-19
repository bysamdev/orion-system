package monitor

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const idMaquina = "11111111-1111-1111-1111-111111111111"

type leitorFalso struct{ pedidos []string }

func (l *leitorFalso) Estados(_ context.Context, ids []string) ([]Estado, error) {
	l.pedidos = ids
	return []Estado{{MachineID: idMaquina, CPUUsage: 20, VistoEm: instante}}, nil
}
func (l *leitorFalso) Hardware(_ context.Context, id string) (*Hardware, error) {
	if id != idMaquina {
		return nil, ErrNaoEncontrado
	}
	return &Hardware{MachineID: id, CPUModel: "i5"}, nil
}
func (l *leitorFalso) Alertas(context.Context, string) ([]AlertaAberto, error) { return nil, nil }

type historiadorFalso struct{ janela, passo time.Duration }

func (h *historiadorFalso) Historico(_ context.Context, _ string, janela, passo time.Duration) ([]PontoHistorico, error) {
	h.janela, h.passo = janela, passo
	return nil, nil
}

func servidorDeLeitura() (*Servidor, *leitorFalso, *historiadorFalso) {
	l, h := &leitorFalso{}, &historiadorFalso{}
	return &Servidor{Store: &storeFalso{}, Leitor: l, Historiador: h, Metricas: NovasMetricas(), SegredoIngest: segredo}, l, h
}

func pedir(srv *Servidor, metodo, caminho, auth, corpo string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(metodo, caminho, strings.NewReader(corpo))
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	rec := httptest.NewRecorder()
	srv.RotasPublicas().ServeHTTP(rec, req)
	return rec
}

func TestLeitura_ExigeSegredo(t *testing.T) {
	srv, _, _ := servidorDeLeitura()
	for _, c := range []struct{ metodo, caminho string }{
		{http.MethodPost, "/v1/estado"},
		{http.MethodGet, "/v1/maquinas/" + idMaquina + "/hardware"},
		{http.MethodGet, "/v1/maquinas/" + idMaquina + "/alertas"},
		{http.MethodGet, "/v1/maquinas/" + idMaquina + "/historico?janela=3600&passo=60"},
	} {
		if rec := pedir(srv, c.metodo, c.caminho, "Bearer errado", `{}`); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s sem segredo: %d, esperado 401", c.metodo, c.caminho, rec.Code)
		}
	}
}

func TestLeitura_Estados(t *testing.T) {
	srv, l, _ := servidorDeLeitura()
	rec := pedir(srv, http.MethodPost, "/v1/estado", "Bearer "+segredo, `{"machine_ids":["`+idMaquina+`"]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var estados []Estado
	_ = json.Unmarshal(rec.Body.Bytes(), &estados)
	if len(estados) != 1 || estados[0].CPUUsage != 20 || len(l.pedidos) != 1 {
		t.Errorf("estados = %+v, pedidos = %v", estados, l.pedidos)
	}
}

func TestLeitura_EstadosRecusaIDInvalido(t *testing.T) {
	srv, _, _ := servidorDeLeitura()
	rec := pedir(srv, http.MethodPost, "/v1/estado", "Bearer "+segredo, `{"machine_ids":["1; drop table"]}`)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status %d, esperado 400", rec.Code)
	}
}

func TestLeitura_HardwareInexistenteDa404(t *testing.T) {
	srv, _, _ := servidorDeLeitura()
	rec := pedir(srv, http.MethodGet, "/v1/maquinas/22222222-2222-2222-2222-222222222222/hardware", "Bearer "+segredo, "")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status %d, esperado 404", rec.Code)
	}
}

func TestLeitura_HistoricoValidaJanela(t *testing.T) {
	srv, _, h := servidorDeLeitura()
	base := "/v1/maquinas/" + idMaquina + "/historico"
	for _, q := range []string{"", "?janela=3600", "?janela=0&passo=60", "?janela=864000&passo=60", "?janela=86400&passo=1"} {
		if rec := pedir(srv, http.MethodGet, base+q, "Bearer "+segredo, ""); rec.Code != http.StatusBadRequest {
			t.Errorf("%q: status %d, esperado 400", q, rec.Code)
		}
	}
	if rec := pedir(srv, http.MethodGet, base+"?janela=3600&passo=60", "Bearer "+segredo, ""); rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	if h.janela != time.Hour || h.passo != time.Minute {
		t.Errorf("janela=%v passo=%v", h.janela, h.passo)
	}
}

func TestPrometheus_MontaPontosDoMaisRecenteParaOMaisAntigo(t *testing.T) {
	var consultas []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("query")
		consultas = append(consultas, q)
		valor := `"10"`
		if strings.Contains(q, "memory") {
			valor = `"55.55"`
		}
		if strings.Contains(q, "disk") {
			// Disco sem série: o ponto sai com disk nulo, não com zero.
			w.Write([]byte(`{"status":"success","data":{"result":[]}}`))
			return
		}
		w.Write([]byte(`{"status":"success","data":{"result":[{"values":[[1000,` + valor + `],[1060,"NaN"],[1120,` + valor + `]]}]}}`))
	}))
	defer srv.Close()

	p := &Prometheus{URL: srv.URL, Cliente: srv.Client()}
	pontos, err := p.Historico(context.Background(), idMaquina, time.Hour, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if len(pontos) != 2 || !pontos[0].Em.After(pontos[1].Em) {
		t.Fatalf("pontos = %+v, esperado 2 em ordem decrescente (NaN descartado)", pontos)
	}
	if *pontos[0].CPU != 10 || *pontos[0].RAM != 55.6 || pontos[0].Disk != nil {
		t.Errorf("ponto = cpu %v ram %v disk %v", *pontos[0].CPU, *pontos[0].RAM, pontos[0].Disk)
	}
	if !strings.Contains(consultas[0], `avg_over_time(orion_machine_cpu_percent{machine_id="`+idMaquina+`"}[60s])`) {
		t.Errorf("consulta = %s", consultas[0])
	}
}

func TestPrometheus_RecusaIDQueInjetariaPromQL(t *testing.T) {
	p := &Prometheus{URL: "http://nunca-chamado", Cliente: http.DefaultClient}
	if _, err := p.Historico(context.Background(), `x"}or vector(1)#`, time.Hour, time.Minute); err == nil {
		t.Error("id malicioso aceito")
	}
}
