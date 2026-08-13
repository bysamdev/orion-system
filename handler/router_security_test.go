package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5/middleware"

	"orion-api/lib"
)

// ipVisto monta a mesma cadeia de middleware do buildRouter e devolve o IP que
// lib.ClientIP enxergaria — é essa string que vira a chave do rate limiter.
func ipVisto(t *testing.T, remoteAddr string, xff []string) string {
	t.Helper()
	var got string
	h := middleware.ClientIPFromXFFTrustedProxies(1)(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got = lib.ClientIP(r)
		}),
	)
	r := httptest.NewRequest(http.MethodGet, "/api/auth/machine-login", nil)
	r.RemoteAddr = remoteAddr
	for _, v := range xff {
		r.Header.Add("X-Forwarded-For", v)
	}
	h.ServeHTTP(httptest.NewRecorder(), r)
	return got
}

// TestClientIPIgnoraSpoofDeXFF é o teste central de GO-2026-5774/5775/5777.
//
// Com middleware.RealIP, a entrada MAIS À ESQUERDA do X-Forwarded-For vencia —
// e essa é justamente a que o cliente controla. Trocá-la a cada requisição
// gerava uma chave nova de rate limit por tentativa, ou seja, brute-force livre
// em machine-login. Atrás de 1 proxy (Vercel), o valor confiável é o último.
func TestClientIPIgnoraSpoofDeXFF(t *testing.T) {
	const real = "203.0.113.77" // IP que o proxy da Vercel acrescenta

	casos := []struct {
		nome string
		xff  []string
	}{
		{"sem spoof", []string{real}},
		{"spoof simples à esquerda", []string{"1.2.3.4, " + real}},
		{"spoof em header repetido", []string{"1.2.3.4", real}},
		{"cadeia longa forjada", []string{"9.9.9.9, 8.8.8.8, 7.7.7.7, " + real}},
		{"spoof com IP privado", []string{"127.0.0.1, " + real}},
	}
	for _, c := range casos {
		if got := ipVisto(t, "10.0.0.1:5000", c.xff); got != real {
			t.Errorf("%s: ClientIP = %q, esperado %q — o atacante controlaria a chave do rate limit",
				c.nome, got, real)
		}
	}
}

// TestClientIPVariaSpoofNaoGeraChavesNovas confirma o efeito prático: 50
// requisições forjando XFF diferente devem colapsar numa única chave.
func TestClientIPVariaSpoofNaoGeraChavesNovas(t *testing.T) {
	chaves := map[string]bool{}
	for _, spoof := range []string{"1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4", "5.5.5.5"} {
		chaves[ipVisto(t, "10.0.0.1:5000", []string{spoof + ", 203.0.113.77"})] = true
	}
	if len(chaves) != 1 {
		t.Errorf("spoof gerou %d chaves distintas (%v) — rate limiting continua contornável", len(chaves), chaves)
	}
}

// TestClientIPCaiParaRemoteAddrSemProxy garante que o dev local (sem XFF)
// continua funcionando em vez de virar chave vazia — chave vazia colocaria todo
// mundo no mesmo balde.
func TestClientIPCaiParaRemoteAddrSemProxy(t *testing.T) {
	if got := ipVisto(t, "192.0.2.55:41234", nil); got != "192.0.2.55" {
		t.Errorf("ClientIP sem XFF = %q, esperado 192.0.2.55", got)
	}
}

// TestCORSSóEcoaOrigemDaAllowlist cobre a mudança do corsMiddleware: origem
// desconhecida não recebe Allow-Origin nem Allow-Credentials.
func TestCORSSoEcoaOrigemDaAllowlist(t *testing.T) {
	chamar := func(origin string) http.Header {
		h := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
		r := httptest.NewRequest(http.MethodGet, "/api/monitoring/dashboard", nil)
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec.Result().Header
	}

	permitida := chamar("https://orion.bysam.dev")
	if permitida.Get("Access-Control-Allow-Origin") != "https://orion.bysam.dev" {
		t.Error("origem da allowlist deveria ser ecoada")
	}
	if permitida.Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("origem da allowlist deveria receber Allow-Credentials")
	}
	if permitida.Get("Vary") != "Origin" {
		t.Error("resposta com CORS deveria marcar Vary: Origin")
	}

	for _, mal := range []string{
		"https://evil.com",
		"https://orion.bysam.dev.evil.com", // sufixo colado no domínio legítimo
		"http://orion.bysam.dev",           // mesmo host, esquema inseguro
		"null",
	} {
		h := chamar(mal)
		if v := h.Get("Access-Control-Allow-Origin"); v != "" {
			t.Errorf("origem %q recebeu Allow-Origin %q — deveria ser recusada", mal, v)
		}
		if v := h.Get("Access-Control-Allow-Credentials"); v != "" {
			t.Errorf("origem %q recebeu Allow-Credentials — deveria ser recusada", mal)
		}
	}

	// Requisição sem Origin (agente Windows, cron, curl) não é cross-origin e
	// não deve ganhar header nenhum — em especial não o antigo "*".
	if v := chamar("").Get("Access-Control-Allow-Origin"); v != "" {
		t.Errorf("requisição sem Origin recebeu Allow-Origin %q", v)
	}
}

// TestAutorizarCronFalhaFechado fixa o comportamento de vuln-0011: sem
// CRON_SECRET no ambiente, o endpoint recusa em vez de liberar.
func TestAutorizarCronFalhaFechado(t *testing.T) {
	t.Setenv("CRON_SECRET", "") // ambiente sem a variável

	rec := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/monitoring/cron/mark-offline", nil)
	if autorizarCron(rec, r) {
		t.Fatal("FAIL-OPEN: cron autorizado sem CRON_SECRET configurada")
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, esperado 503", rec.Code)
	}

	t.Setenv("CRON_SECRET", "segredo-de-teste")

	rec = httptest.NewRecorder()
	r = httptest.NewRequest(http.MethodGet, "/api/monitoring/cron/mark-offline", nil)
	if autorizarCron(rec, r) {
		t.Error("cron autorizado sem header Authorization")
	}
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status sem header = %d, esperado 401", rec.Code)
	}

	rec = httptest.NewRecorder()
	r = httptest.NewRequest(http.MethodGet, "/api/monitoring/cron/mark-offline", nil)
	r.Header.Set("Authorization", "Bearer segredo-errado")
	if autorizarCron(rec, r) {
		t.Error("cron autorizado com segredo errado")
	}

	rec = httptest.NewRecorder()
	r = httptest.NewRequest(http.MethodGet, "/api/monitoring/cron/mark-offline", nil)
	r.Header.Set("Authorization", "Bearer segredo-de-teste")
	if !autorizarCron(rec, r) {
		t.Error("cron legítimo com o segredo correto foi recusado")
	}
}
