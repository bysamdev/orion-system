package monitor

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCapacidade_PublicaColetaValidaEInvalidaAmostraAposErro(t *testing.T) {
	falhar := false
	servidor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer segredo-de-teste" {
			t.Error("segredo não enviado ao endpoint de capacidade")
		}
		if falhar {
			http.Error(w, "indisponível", http.StatusServiceUnavailable)
			return
		}
		fmt.Fprint(w, `{"banco_pct":42,"conexoes_pct":3,"storage_pct":12,"tabelas_realtime":1,"egress_pct":8}`)
	}))
	defer servidor.Close()

	capacidade := NovaCapacidade(servidor.URL, "segredo-de-teste", servidor.Client())
	if err := capacidade.Atualizar(context.Background()); err != nil {
		t.Fatal(err)
	}
	var saida strings.Builder
	capacidade.Escrever(&saida)
	if !strings.Contains(saida.String(), "orion_supabase_capacity_up 1") ||
		!strings.Contains(saida.String(), "orion_supabase_banco_percent 42") {
		t.Fatalf("snapshot não publicado: %s", saida.String())
	}

	falhar = true
	if err := capacidade.Atualizar(context.Background()); err == nil {
		t.Fatal("falha HTTP foi tratada como coleta válida")
	}
	saida.Reset()
	capacidade.Escrever(&saida)
	if !strings.Contains(saida.String(), "orion_supabase_capacity_up 0") ||
		strings.Contains(saida.String(), "orion_supabase_banco_percent 42") {
		t.Fatalf("amostra antiga continuou publicada após falha: %s", saida.String())
	}
}

func TestCapacidade_RejeitaRespostaIncompleta(t *testing.T) {
	servidor := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"banco_pct":42,"conexoes_pct":3,"storage_pct":12,"tabelas_realtime":1}`)
	}))
	defer servidor.Close()
	capacidade := NovaCapacidade(servidor.URL, "segredo-de-teste", servidor.Client())
	if err := capacidade.Atualizar(context.Background()); err == nil {
		t.Fatal("resposta sem egress foi tratada como coleta válida")
	}
	var saida strings.Builder
	capacidade.Escrever(&saida)
	if !strings.Contains(saida.String(), "orion_supabase_capacity_up 0") {
		t.Fatalf("coleta incompleta não ficou marcada como falha: %s", saida.String())
	}
}
