// handler/ws_system_graph_test.go
package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSystemGraphHub_RegisterUnregister(t *testing.T) {
	hub := &SystemGraphHub{clients: make(map[*SafeConn]bool)}
	conn := &SafeConn{} // zero-value conn is fine here: we only exercise the hub's map bookkeeping, not real I/O

	hub.register(conn)
	if !hub.isRegistered(conn) {
		t.Fatal("expected conn to be registered after register()")
	}

	hub.unregister(conn)
	if hub.isRegistered(conn) {
		t.Fatal("expected conn to be unregistered after unregister()")
	}
}

func TestAutorizarSystemGraph_SemToken(t *testing.T) {
	// Sem subprotocolo nenhum, deve recusar antes de qualquer acesso a db/sb.
	req := newTestRequestSemSubprotocolo(t)
	rec := newTestResponseRecorder()
	ok := autorizarSystemGraph(rec, req)
	if ok {
		t.Fatal("esperado false sem token no subprotocolo")
	}
	if rec.Code != 401 {
		t.Fatalf("esperado 401, recebido %d", rec.Code)
	}
}

// TestSimulador_Singleton prova que garantirSimulador/pararSimuladorSeVazio
// mantêm UM simulador compartilhado por processo, não um por conexão: chamar
// garantirSimulador de novo enquanto já roda não inicia um segundo ticker
// (idempotente), e pararSimuladorSeVazio só efetivamente para quando o hub
// fica vazio (não no primeiro cliente que sai, se outro ainda está
// conectado). Não exercita o caminho de rede real — só a contabilidade do
// singleton, com SafeConn zero-value como em TestSystemGraphHub_RegisterUnregister.
func TestSimulador_Singleton(t *testing.T) {
	hub := &SystemGraphHub{clients: make(map[*SafeConn]bool)}
	conn1 := &SafeConn{}
	conn2 := &SafeConn{}

	hub.register(conn1)
	garantirSimulador(hub)
	garantirSimulador(hub) // segunda chamada deve ser no-op (idempotente)

	simMu.Lock()
	running := simRunning
	stopCh := simStop
	simMu.Unlock()
	if !running {
		t.Fatal("esperado simulador rodando após garantirSimulador")
	}

	hub.register(conn2)
	hub.unregister(conn1)
	pararSimuladorSeVazio(hub) // ainda tem conn2 registrado: não deve parar

	simMu.Lock()
	running = simRunning
	simMu.Unlock()
	if !running {
		t.Fatal("esperado simulador continuar rodando com um cliente ainda conectado")
	}

	hub.unregister(conn2)
	pararSimuladorSeVazio(hub) // hub agora vazio: deve parar

	simMu.Lock()
	running = simRunning
	simMu.Unlock()
	if running {
		t.Fatal("esperado simulador parado após todos os clientes desconectarem")
	}

	select {
	case <-stopCh:
		// canal fechado, como esperado — sem isso a goroutine do ticker vazaria.
	default:
		t.Fatal("esperado stopCh fechado após pararSimuladorSeVazio")
	}
}

func newTestResponseRecorder() *httptest.ResponseRecorder {
	return httptest.NewRecorder()
}

func newTestRequestSemSubprotocolo(t *testing.T) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/ws/system-graph", nil)
	return req
}
