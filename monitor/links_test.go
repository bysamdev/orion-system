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

type cadastroFalso struct {
	links []Link
	seq   int
}

func (c *cadastroFalso) ListarLinks(context.Context) ([]Link, error) { return c.links, nil }
func (c *cadastroFalso) SalvarLink(_ context.Context, l *Link) error {
	if l.ID == "" {
		c.seq++
		l.ID = "aaaaaaaa-0000-0000-0000-00000000000" + string(rune('0'+c.seq))
		c.links = append(c.links, *l)
		return nil
	}
	for i := range c.links {
		if c.links[i].ID == l.ID {
			c.links[i] = *l
			return nil
		}
	}
	return ErrLinkNaoEncontrado
}
func (c *cadastroFalso) ApagarLink(_ context.Context, id string) error {
	for i := range c.links {
		if c.links[i].ID == id {
			c.links = append(c.links[:i], c.links[i+1:]...)
			return nil
		}
	}
	return ErrLinkNaoEncontrado
}

const (
	empresaA = "22222222-2222-2222-2222-222222222222"
	servidor = "33333333-3333-3333-3333-333333333333"
	idDedic  = "44444444-4444-4444-4444-444444444444"
	idStar   = "55555555-5555-5555-5555-555555555555"
)

func linksDoCliente() []Link {
	return []Link{
		{ID: idDedic, CompanyID: empresaA, Cliente: "Acme", Nome: "Vivo dedicado", Papel: "principal", Tipo: "dedicado", IPPublico: "200.1.1.1"},
		{ID: idStar, CompanyID: empresaA, Cliente: "Acme", Nome: "Starlink", Papel: "backup", Tipo: "starlink"},
	}
}

func TestLink_Normalizar(t *testing.T) {
	ok := Link{CompanyID: empresaA, Nome: " Vivo ", Papel: "Principal", Tipo: "DEDICADO", IPPublico: "200.1.1.1"}
	if err := ok.Normalizar(); err != nil || ok.Nome != "Vivo" || ok.Papel != "principal" {
		t.Fatalf("link válido recusado: %v (%+v)", err, ok)
	}
	ruins := []Link{
		{CompanyID: "x", Nome: "a", Papel: "principal", Tipo: "dedicado"},
		{CompanyID: empresaA, Nome: "", Papel: "principal", Tipo: "dedicado"},
		{CompanyID: empresaA, Nome: "a", Papel: "reserva", Tipo: "dedicado"},
		{CompanyID: empresaA, Nome: "a", Papel: "principal", Tipo: "radio"},
		{CompanyID: empresaA, Nome: "a", Papel: "principal", Tipo: "dedicado", IPPublico: "http://x"},
		{CompanyID: empresaA, Nome: "a", Papel: "principal", Tipo: "dedicado", IPPublico: "localhost"},
		{CompanyID: empresaA, Nome: "a", Papel: "principal", Tipo: "dedicado", IPPublico: "127.0.0.1"},
		{CompanyID: empresaA, Nome: "a", Papel: "principal", Tipo: "dedicado", IPPublico: "192.168.1.1"},
		{CompanyID: empresaA, Nome: "a", Papel: "principal", Tipo: "dedicado", IPPublico: "100.64.0.1"},
		{CompanyID: empresaA, Nome: "a", Papel: "principal", Tipo: "dedicado", IPPublico: "::1"},
		{CompanyID: empresaA, Nome: "a", Papel: "principal", Tipo: "dedicado", AlvoTeste: "gateway.local"},
	}
	for i, l := range ruins {
		if err := l.Normalizar(); err == nil {
			t.Errorf("caso %d deveria ser recusado", i)
		}
	}
}

func TestAvaliarGrupo_DedicadoEmUsoPeloIPDeSaida(t *testing.T) {
	am := &AmostraDeLinks{IPSaida: "200.1.1.1", Testes: []TesteDeLink{
		{Alvo: "1.1.1.1", LatenciaMs: 10, JitterMs: 1, PerdaPct: 0},
		{Alvo: "8.8.8.8", LatenciaMs: 20, JitterMs: 3, PerdaPct: 20},
	}}
	e := AvaliarGrupo(linksDoCliente(), am, instante)
	d, s := e[idDedic], e[idStar]
	if d.Ativo == nil || !*d.Ativo || s.Ativo == nil || *s.Ativo {
		t.Fatalf("esperava dedicado ativo e Starlink parada: %+v %+v", d, s)
	}
	if *d.LatenciaMs != 15 || *d.JitterMs != 2 || *d.PerdaPct != 10 || !*d.Up {
		t.Errorf("medição do dedicado errada: %+v", d)
	}
	if s.Up != nil || s.LatenciaMs != nil {
		t.Errorf("Starlink parada sem rota de teste não pode ter medição: %+v", s)
	}
}

func TestAvaliarGrupo_FailoverParaStarlinkSemIPFixo(t *testing.T) {
	am := &AmostraDeLinks{IPSaida: "129.222.1.9", Testes: []TesteDeLink{{Alvo: "1.1.1.1", LatenciaMs: 40, PerdaPct: 0}}}
	e := AvaliarGrupo(linksDoCliente(), am, instante)
	if !*e[idStar].Ativo || *e[idDedic].Ativo {
		t.Fatalf("IP de saída desconhecido com um link sem IP fixo deveria ser a Starlink: %+v", e)
	}
	if *e[idStar].LatenciaMs != 40 {
		t.Errorf("latência deveria ir para a Starlink: %+v", e[idStar])
	}
}

func TestAvaliarGrupo_RotaDeTesteMedeBackupParado(t *testing.T) {
	links := linksDoCliente()
	links[1].AlvoTeste = "1.0.0.1"
	am := &AmostraDeLinks{IPSaida: "200.1.1.1", Testes: []TesteDeLink{
		{Alvo: "1.1.1.1", LatenciaMs: 10},
		{Alvo: "1.0.0.1", LatenciaMs: 0, PerdaPct: 100},
	}}
	s := AvaliarGrupo(links, am, instante)[idStar]
	if *s.Ativo || s.Up == nil || *s.Up || *s.PerdaPct != 100 || s.LatenciaMs != nil {
		t.Errorf("backup fora do ar pela rota de teste deveria aparecer down: %+v", s)
	}
}

func TestAvaliarGrupo_TudoSemRespostaFicaDown(t *testing.T) {
	am := &AmostraDeLinks{IPSaida: "200.1.1.1", Testes: []TesteDeLink{{Alvo: "1.1.1.1", PerdaPct: 100}, {Alvo: "8.8.8.8", PerdaPct: 100}}}
	d := AvaliarGrupo(linksDoCliente(), am, instante)[idDedic]
	if *d.Up || d.LatenciaMs != nil {
		t.Errorf("sem resposta deveria ficar down e sem latência: %+v", d)
	}
}

func servidorComLinks(t *testing.T, links []Link) (*Servidor, *cadastroFalso) {
	t.Helper()
	cad := &cadastroFalso{links: links}
	srv := novoServidor(&storeFalso{})
	srv.Links = NovosLinks(cad)
	if err := srv.Links.Carregar(context.Background()); err != nil {
		t.Fatal(err)
	}
	return srv, cad
}

func amostraDoServidor() Amostra {
	a := amostraValida()
	a.MachineID, a.CompanyID, a.DeviceType, a.Hostname = servidor, empresaA, "server", "SRV-AD"
	a.RecebidaEm = time.Now()
	return a
}

func TestIngest_ServidorDaEmpresaViraSondaERecebeAlvos(t *testing.T) {
	links := linksDoCliente()
	links[1].AlvoTeste = "1.0.0.1"
	srv, _ := servidorComLinks(t, links)

	// Primeiro heartbeat: ainda sem medição, mas já recebe o que medir.
	rec := enviar(t, srv, "Bearer "+segredo, amostraDoServidor())
	var resp struct {
		Sonda *ConfigDaSonda `json:"sonda"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || resp.Sonda == nil {
		t.Fatalf("servidor da empresa deveria receber config de sonda: %s", rec.Body.String())
	}
	if strings.Join(resp.Sonda.Alvos, ",") != "1.1.1.1,8.8.8.8,1.0.0.1" || !resp.Sonda.DescobrirIPSaida {
		t.Errorf("alvos errados: %+v", resp.Sonda)
	}

	// Segundo heartbeat traz a medição.
	a := amostraDoServidor()
	a.Links = &AmostraDeLinks{IPSaida: "200.1.1.1", Testes: []TesteDeLink{{Alvo: "1.1.1.1", LatenciaMs: 12}, {Alvo: "8.8.8.8", LatenciaMs: 14}}}
	enviar(t, srv, "Bearer "+segredo, a)
	if e := srv.Links.Estados()[idDedic]; e.LatenciaMs == nil || *e.LatenciaMs != 13 {
		t.Fatalf("medição não registrada: %+v", e)
	}

	var sb strings.Builder
	srv.Links.Escrever(&sb, time.Now())
	texto := sb.String()
	for _, esperado := range []string{
		`orion_link_info{link_id="` + idStar + `"`,
		`orion_link_ativo{link_id="` + idDedic + `",company_id="` + empresaA + `",cliente="Acme",nome="Vivo dedicado",papel="principal",tipo="dedicado"} 1`,
		`orion_link_latencia_ms{link_id="` + idDedic + `"`,
	} {
		if !strings.Contains(texto, esperado) {
			t.Errorf("métricas sem %q:\n%s", esperado, texto)
		}
	}
}

func TestIngest_EstacaoNaoViraSonda(t *testing.T) {
	srv, _ := servidorComLinks(t, linksDoCliente())
	a := amostraDoServidor()
	a.DeviceType = "desktop"
	rec := enviar(t, srv, "Bearer "+segredo, a)
	if strings.Contains(rec.Body.String(), "sonda") {
		t.Errorf("estação não deveria ser sonda: %s", rec.Body.String())
	}
}

func TestLinks_MedicaoVelhaSaiDasMetricas(t *testing.T) {
	srv, _ := servidorComLinks(t, linksDoCliente())
	srv.Links.RegistrarMedicao(servidor, &AmostraDeLinks{IPSaida: "200.1.1.1", Testes: []TesteDeLink{{Alvo: "1.1.1.1", LatenciaMs: 5}}},
		instante, func(string) string { return servidor })
	var sb strings.Builder
	srv.Links.Escrever(&sb, instante.Add(validadeDaMedicao+time.Second))
	if strings.Contains(sb.String(), "orion_link_latencia_ms{") {
		t.Errorf("medição vencida continuou publicada:\n%s", sb.String())
	}
}

func chamar(t *testing.T, srv *Servidor, metodo, caminho, corpo string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(metodo, caminho, strings.NewReader(corpo))
	req.Header.Set("Authorization", "Bearer "+segredo)
	rec := httptest.NewRecorder()
	srv.RotasPublicas().ServeHTTP(rec, req)
	return rec
}

func TestRotasDeLinks_CadastroCompleto(t *testing.T) {
	srv, cad := servidorComLinks(t, nil)

	rec := chamar(t, srv, http.MethodPost, "/v1/links",
		`{"company_id":"`+empresaA+`","cliente":"Acme","nome":"Vivo","papel":"principal","tipo":"dedicado","ip_publico":"200.1.1.1"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("criar: %d %s", rec.Code, rec.Body.String())
	}
	var criado Link
	_ = json.Unmarshal(rec.Body.Bytes(), &criado)

	if rec := chamar(t, srv, http.MethodPost, "/v1/links", `{"company_id":"`+empresaA+`","nome":"x","papel":"x","tipo":"dedicado"}`); rec.Code != http.StatusBadRequest {
		t.Errorf("link inválido deveria dar 400, deu %d", rec.Code)
	}

	rec = chamar(t, srv, http.MethodPut, "/v1/links/"+criado.ID,
		`{"company_id":"`+empresaA+`","cliente":"Acme","nome":"Vivo 500M","papel":"principal","tipo":"dedicado","ip_publico":"200.1.1.1"}`)
	if rec.Code != http.StatusOK || cad.links[0].Nome != "Vivo 500M" {
		t.Fatalf("editar: %d %s", rec.Code, rec.Body.String())
	}

	rec = chamar(t, srv, http.MethodGet, "/v1/links?company_id="+empresaA, "")
	if !strings.Contains(rec.Body.String(), "Vivo 500M") {
		t.Errorf("listar: %s", rec.Body.String())
	}

	sd := httptest.NewRecorder()
	srv.RotasInternas().ServeHTTP(sd, httptest.NewRequest(http.MethodGet, "/sd/links", nil))
	if !strings.Contains(sd.Body.String(), `"targets":["200.1.1.1"]`) || !strings.Contains(sd.Body.String(), `"papel":"principal"`) {
		t.Errorf("service discovery: %s", sd.Body.String())
	}

	if rec := chamar(t, srv, http.MethodDelete, "/v1/links/"+criado.ID, ""); rec.Code != http.StatusNoContent || len(cad.links) != 0 {
		t.Errorf("apagar: %d", rec.Code)
	}
	if rec := chamar(t, srv, http.MethodDelete, "/v1/links/"+criado.ID, ""); rec.Code != http.StatusNotFound {
		t.Errorf("apagar de novo deveria dar 404, deu %d", rec.Code)
	}
}

func TestRotasDeLinks_ExigemSegredo(t *testing.T) {
	srv, _ := servidorComLinks(t, nil)
	req := httptest.NewRequest(http.MethodGet, "/v1/links", nil)
	rec := httptest.NewRecorder()
	srv.RotasPublicas().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("sem segredo deveria dar 401, deu %d", rec.Code)
	}
}

type consultaFalsa map[string]map[string]float64

func (c consultaFalsa) PorRotulo(_ context.Context, consulta, _ string) (map[string]float64, error) {
	for trecho, valores := range c {
		if strings.Contains(consulta, trecho) {
			return valores, nil
		}
	}
	return map[string]float64{}, nil
}

func TestListarLinks_IncluiPingDeFora(t *testing.T) {
	srv, _ := servidorComLinks(t, linksDoCliente())
	srv.Consulta = consultaFalsa{
		"probe_success":          {idDedic: 1, idStar: 0},
		"probe_duration_seconds": {idDedic: 0.0234},
	}
	rec := chamar(t, srv, http.MethodGet, "/v1/links", "")
	var corpo struct {
		Links []linkComEstado `json:"links"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &corpo); err != nil {
		t.Fatal(err)
	}
	for _, l := range corpo.Links {
		switch l.ID {
		case idDedic:
			if l.DeFora == nil || !l.DeFora.Responde || *l.DeFora.LatenciaMs != 23.4 {
				t.Errorf("ping de fora do dedicado: %+v", l.DeFora)
			}
		case idStar:
			// Starlink sem IP público: não tem ping de fora, mesmo que o
			// Prometheus tenha série velha para ela.
			if l.DeFora != nil {
				t.Errorf("Starlink sem IP não deveria ter ping de fora: %+v", l.DeFora)
			}
		}
	}
}
