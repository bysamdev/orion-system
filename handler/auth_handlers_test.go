package handler

// Testes de absoluteURL — correção C.3.
//
// absoluteURL é testável como função pura (recebe *http.Request e um caminho,
// devolve string) sem precisar de banco, Supabase nem rede: httptest.NewRequest
// constrói o *http.Request sem nenhuma chamada real.

import (
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestAbsoluteURL_UsaHostDaRequisicaoComHTTPS cobre o caminho real de
// produção: por trás do proxy da Vercel, X-Forwarded-Proto vem "https".
func TestAbsoluteURL_UsaHostDaRequisicaoComHTTPS(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "http://orion.exemplo.test/api/auth/machine-login", nil)
	r.Header.Set("X-Forwarded-Proto", "https")

	got := absoluteURL(r, "/novo-ticket")
	want := "https://orion.exemplo.test/novo-ticket"
	if got != want {
		t.Errorf("absoluteURL = %q, esperado %q", got, want)
	}
}

// TestAbsoluteURL_RespeitaXForwardedProtoQuandoHTTP garante que o header é
// respeitado nos dois sentidos, não só forçado para https.
func TestAbsoluteURL_RespeitaXForwardedProtoQuandoHTTP(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "https://orion.exemplo.test/x", nil)
	r.Header.Set("X-Forwarded-Proto", "http")

	got := absoluteURL(r, "/")
	want := "http://orion.exemplo.test/"
	if got != want {
		t.Errorf("absoluteURL = %q, esperado %q — não respeitou X-Forwarded-Proto=http", got, want)
	}
}

// TestAbsoluteURL_SemProxyComTLSUsaHTTPS cobre uma conexão TLS direta, sem
// proxy na frente (X-Forwarded-Proto ausente, mas r.TLS presente).
func TestAbsoluteURL_SemProxyComTLSUsaHTTPS(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "http://orion.exemplo.test/x", nil)
	r.TLS = &tls.ConnectionState{} // simula uma conexão TLS real, sem proxy

	got := absoluteURL(r, "/painel")
	want := "https://orion.exemplo.test/painel"
	if got != want {
		t.Errorf("absoluteURL = %q, esperado %q — deveria detectar TLS mesmo sem X-Forwarded-Proto", got, want)
	}
}

// TestAbsoluteURL_SemProxyNemTLSCaiParaHTTP cobre o cenário de dev local puro
// (sem proxy, sem TLS) — única situação em que http:// é aceitável.
func TestAbsoluteURL_SemProxyNemTLSCaiParaHTTP(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "http://localhost:8080/x", nil)
	// httptest.NewRequest com alvo "http://" já deixa r.TLS nil e sem X-Forwarded-Proto.

	got := absoluteURL(r, "/")
	want := "http://localhost:8080/"
	if got != want {
		t.Errorf("absoluteURL = %q, esperado %q", got, want)
	}
}

// TestAbsoluteURL_CaminhoRaizFuncionaCorretamente garante que o caso mais
// comum (sem redirect_to, cai em "/") produz uma URL válida, não
// "https://hostsem-barra" nem "https://host//".
func TestAbsoluteURL_CaminhoRaizFuncionaCorretamente(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "https://orion.exemplo.test/api/auth/machine-login", nil)
	r.Header.Set("X-Forwarded-Proto", "https")

	got := absoluteURL(r, "/")
	want := "https://orion.exemplo.test/"
	if got != want {
		t.Errorf("absoluteURL = %q, esperado %q", got, want)
	}
}

// TestCaminhoRelativoSeguro cobre o bypass de open redirect relatado no
// pentest (vuln-0005): a validação anterior era apenas HasPrefix(v, "/"), que
// aceita referências protocol-relative como "//evil.com".
func TestCaminhoRelativoSeguro(t *testing.T) {
	aceitos := []string{
		"/",
		"/novo-ticket",
		"/tickets/42",
		"/novo-ticket?origem=agente",
	}
	for _, v := range aceitos {
		if !caminhoRelativoSeguro(v) {
			t.Errorf("caminhoRelativoSeguro(%q) = false, esperado true", v)
		}
	}

	rejeitados := []string{
		"",                          // vazio → cai no default "/"
		"/\\evil.com",               // backslash normalizada pelo navegador
		"//evil.com",                // protocol-relative
		"///evil.com",               // idem, com barra extra
		"//evil.com/novo-ticket",    // protocol-relative com caminho plausível
		"https://evil.com",          // esquema absoluto
		"http://evil.com",           // esquema absoluto
		"evil.com",                  // sem "/" inicial
		"/redir?u=https://evil.com", // esquema embutido
		"/novo-ticket\r\nX: 1",      // injeção de header via CRLF
	}
	for _, v := range rejeitados {
		if caminhoRelativoSeguro(v) {
			t.Errorf("caminhoRelativoSeguro(%q) = true, esperado false", v)
		}
	}
}
