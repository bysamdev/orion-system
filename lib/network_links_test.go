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

// TestIsBlockedIP_NaoGlobalUnicast cobre o achado ORI-P2-05: 255.255.255.255
// (broadcast limitado) passava pela lista explícita anterior de checagens e
// respondia a ping em rede local, fazendo um link cadastrado com esse alvo
// aparecer como online. A troca por !IsGlobalUnicast() fecha essa e as
// outras faixas não-roteáveis de uma vez.
func TestIsBlockedIP_NaoGlobalUnicast(t *testing.T) {
	casos := []struct {
		nome     string
		ip       string
		bloqueia bool
	}{
		{"broadcast limitado", "255.255.255.255", true},
		{"loopback", "127.0.0.1", true},
		{"link-local (metadados de nuvem)", "169.254.169.254", true},
		{"unspecified", "0.0.0.0", true},
		{"multicast", "224.0.0.1", true},
		{"RFC 1918", "192.168.1.1", true},
		{"RFC 1918 classe A", "10.0.0.1", true},
		{"loopback IPv6", "::1", true},
		{"público IPv4 continua permitido", "8.8.8.8", false},
		{"público IPv6 continua permitido", "2001:4860:4860::8888", false},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			ip := net.ParseIP(c.ip)
			if ip == nil {
				t.Fatalf("IP de teste inválido: %q", c.ip)
			}
			if got := isBlockedIP(ip); got != c.bloqueia {
				t.Errorf("isBlockedIP(%s) = %v, esperado %v", c.ip, got, c.bloqueia)
			}
		})
	}
}
