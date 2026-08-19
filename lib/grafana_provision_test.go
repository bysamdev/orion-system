package lib

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFolderUIDEDashboardUID_DeterministicoEDistintos(t *testing.T) {
	f1 := folderUID("empresa-123")
	f2 := folderUID("empresa-123")
	if f1 != f2 {
		t.Fatalf("folderUID não é determinístico: %q != %q", f1, f2)
	}
	d1 := dashboardUID("empresa-123")
	if f1 == d1 {
		t.Fatalf("folderUID e dashboardUID colidiram pro mesmo company_id: %q", f1)
	}
	if len(f1) > 40 || len(d1) > 40 {
		t.Fatalf("UID excede o limite de 40 caracteres do Grafana: folder=%d dashboard=%d", len(f1), len(d1))
	}
	if folderUID("outra-empresa") == f1 {
		t.Fatal("empresas diferentes geraram o mesmo folderUID")
	}
}

func TestEnsureCompanyDashboard_PastaNovaEDashboardPublicados(t *testing.T) {
	var chamadas []string
	var corpoDashboard map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chamadas = append(chamadas, r.Method+" "+r.URL.Path)
		if got := r.Header.Get("Authorization"); got != "Bearer token-de-teste" {
			t.Errorf("Authorization = %q, esperado Bearer token-de-teste", got)
		}

		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/folders":
			// Um Grafana de verdade, recebendo um uid explícito no corpo,
			// cria a pasta COM esse uid e o devolve de volta — nunca troca
			// por outro. O provisioner nem lê este corpo (já sabe o uid que
			// pediu), então o teste só precisa confirmar que ele foi pedido.
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"uid":"` + folderUID("empresa-123") + `"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/api/dashboards/db":
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			corpoDashboard = body
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"success"}`))
		default:
			t.Errorf("chamada inesperada: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	g := NewGrafanaProvisioner(srv.URL, "token-de-teste")
	if err := g.EnsureCompanyDashboard(context.Background(), "empresa-123", "iBReady"); err != nil {
		t.Fatalf("EnsureCompanyDashboard: %v", err)
	}

	if len(chamadas) != 2 || chamadas[0] != "POST /api/folders" || chamadas[1] != "POST /api/dashboards/db" {
		t.Fatalf("sequência de chamadas inesperada: %v", chamadas)
	}

	dashboard, _ := corpoDashboard["dashboard"].(map[string]any)
	if dashboard == nil {
		t.Fatal("corpo enviado a /api/dashboards/db não trouxe 'dashboard'")
	}
	if title, _ := dashboard["title"].(string); title != "Cliente: iBReady" {
		t.Errorf("title = %q, esperado 'Cliente: iBReady'", title)
	}
	raw, _ := json.Marshal(dashboard)
	if strings.Contains(string(raw), "__COMPANY_ID__") || strings.Contains(string(raw), "__COMPANY_NAME__") {
		t.Errorf("placeholders não substituídos no dashboard publicado: %s", raw)
	}
	// dentro do JSON, as aspas do PromQL vêm escapadas (\") — é a própria
	// query, não o JSON externo, que contém company_id="...".
	if !strings.Contains(string(raw), `company_id=\"empresa-123\"`) {
		t.Errorf("dashboard publicado não filtra por company_id=empresa-123: %s", raw)
	}
	if got, esperado := corpoDashboard["folderUid"].(string), folderUID("empresa-123"); got != esperado {
		t.Errorf("folderUid enviado = %q, esperado %q (determinístico a partir do company_id)", got, esperado)
	}
}

func TestEnsureCompanyDashboard_PastaJaExistenteAtualizaTitulo(t *testing.T) {
	var putBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/folders":
			w.WriteHeader(http.StatusConflict)
			w.Write([]byte(`{"message":"folder already exists"}`))
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/api/folders/"):
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"uid":"f-xyz","version":3}`))
		case r.Method == http.MethodPut && strings.HasPrefix(r.URL.Path, "/api/folders/"):
			json.NewDecoder(r.Body).Decode(&putBody)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"uid":"f-xyz","version":4}`))
		case r.Method == http.MethodPost && r.URL.Path == "/api/dashboards/db":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"success"}`))
		default:
			t.Errorf("chamada inesperada: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	g := NewGrafanaProvisioner(srv.URL, "token-de-teste")
	if err := g.EnsureCompanyDashboard(context.Background(), "empresa-456", "Novo Nome Ltda"); err != nil {
		t.Fatalf("EnsureCompanyDashboard: %v", err)
	}

	if title, _ := putBody["title"].(string); title != "Cliente: Novo Nome Ltda" {
		t.Errorf("PUT title = %q, esperado 'Cliente: Novo Nome Ltda'", title)
	}
	if version, _ := putBody["version"].(float64); version != 3 {
		t.Errorf("PUT version = %v, esperado 3 (versão lida do GET)", version)
	}
}

func TestDeleteCompanyDashboard_200E404SaoSucesso(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusNotFound} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
		}))
		g := NewGrafanaProvisioner(srv.URL, "token")
		if err := g.DeleteCompanyDashboard(context.Background(), "empresa-1"); err != nil {
			t.Errorf("status %d deveria ser tratado como sucesso, deu erro: %v", status, err)
		}
		srv.Close()
	}
}

func TestDeleteCompanyDashboard_OutroErroPropaga(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("boom"))
	}))
	defer srv.Close()

	g := NewGrafanaProvisioner(srv.URL, "token")
	if err := g.DeleteCompanyDashboard(context.Background(), "empresa-1"); err == nil {
		t.Fatal("esperava erro para status 500, obteve nil")
	}
}
