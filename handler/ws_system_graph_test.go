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

func newTestResponseRecorder() *httptest.ResponseRecorder {
	return httptest.NewRecorder()
}

func newTestRequestSemSubprotocolo(t *testing.T) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/ws/system-graph", nil)
	return req
}
