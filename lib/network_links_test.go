package lib

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProbeNetworkTarget_HTTP(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	status, pingMs, err := ProbeNetworkTarget(server.URL)
	if err != nil {
		t.Fatalf("Expected no error probing HTTP server, got: %v", err)
	}
	if status != "online" {
		t.Errorf("Expected status 'online', got '%s'", status)
	}
	if pingMs < 0 {
		t.Errorf("Expected non-negative pingMs, got %d", pingMs)
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
