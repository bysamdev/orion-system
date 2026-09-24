package sender

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPollERespostaMandamTokenDaMaquina(t *testing.T) {
	DefinirTokenDaMaquina("tok-maquina-1")
	defer DefinirTokenDaMaquina("")

	recebidos := map[string]string{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recebidos[r.URL.Path] = r.Header.Get(CabecalhoTokenDaMaquina)
		if r.Method == http.MethodGet {
			w.Write([]byte(`[]`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	if _, err := PollCommands(cfgDeTeste(srv.URL), "maq-1"); err != nil {
		t.Fatalf("PollCommands: %v", err)
	}
	if err := RespondToCommand(cfgDeTeste(srv.URL), "cmd-1", "completed", "ok"); err != nil {
		t.Fatalf("RespondToCommand: %v", err)
	}

	for _, caminho := range []string{"/api/monitoring/commands/poll", "/api/monitoring/commands/respond"} {
		if recebidos[caminho] != "tok-maquina-1" {
			t.Errorf("%s: X-Machine-Token = %q, esperado tok-maquina-1", caminho, recebidos[caminho])
		}
	}
}

func TestSemTokenNaoMandaCabecalho(t *testing.T) {
	DefinirTokenDaMaquina("")
	h := http.Header{}
	colocarTokenDaMaquina(h)
	if _, ok := h[CabecalhoTokenDaMaquina]; ok {
		t.Error("não deveria mandar X-Machine-Token vazio")
	}
}
