package lib

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

// httptest.Server sempre sobe em 127.0.0.1 -- proba-lo via ProbeNetworkTarget
// exercita exatamente o caminho que a correção anti-SSRF deve bloquear
// (destino loopback). Antes da correção este teste esperava "online"; agora
// o comportamento correto é recusar a conexão.
func TestProbeNetworkTarget_HTTP_BlocksLoopback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	status, _, err := ProbeNetworkTarget(server.URL)
	if err == nil {
		t.Fatal("Esperava erro ao probar destino loopback, não teve nenhum")
	}
	if status != "offline" {
		t.Errorf("Esperava status 'offline' pra destino bloqueado, veio '%s'", status)
	}
}

func TestIsBlockedIP(t *testing.T) {
	blocked := []string{"127.0.0.1", "10.0.0.5", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0"}
	for _, ipStr := range blocked {
		ip := net.ParseIP(ipStr)
		if !isBlockedIP(ip) {
			t.Errorf("Esperava %s bloqueado, não foi", ipStr)
		}
	}

	allowed := []string{"8.8.8.8", "1.1.1.1", "93.184.216.34"}
	for _, ipStr := range allowed {
		ip := net.ParseIP(ipStr)
		if isBlockedIP(ip) {
			t.Errorf("Esperava %s permitido, veio bloqueado", ipStr)
		}
	}
}

func TestProbeNetworkTarget_InvalidHost(t *testing.T) {
	status, _, _ := ProbeNetworkTarget("255.255.255.255")
	if status != "offline" {
		t.Errorf("Expected status 'offline' for invalid/unreachable host, got '%s'", status)
	}
}

func TestProbeNetworkTarget_Empty(t *testing.T) {
	status, _, err := ProbeNetworkTarget("")
	if err == nil {
		t.Error("Expected error for empty target")
	}
	if status != "offline" {
		t.Errorf("Expected status 'offline', got '%s'", status)
	}
}
