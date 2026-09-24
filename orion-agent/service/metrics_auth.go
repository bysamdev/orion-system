package service

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"strings"
)

// SEC-16/28: o exporter Prometheus respondia em 0.0.0.0:9182 sem nenhuma
// autenticação — qualquer um na rede lia hostname, usuário logado, software
// instalado etc. Decisão de 24/09/2026:
//
//   - sem metrics_token no agent.yaml, as métricas só respondem na própria
//     máquina (127.0.0.1) — é o caso das máquinas de cliente, que o
//     Prometheus do servidor não alcança de qualquer forma;
//   - com metrics_token, a porta abre para a rede e exige
//     "Authorization: Bearer <token>", que o Prometheus envia.

// enderecoDasMetricas devolve onde o servidor de métricas deve escutar.
func enderecoDasMetricas(token string, porta int) string {
	if strings.TrimSpace(token) == "" {
		return fmt.Sprintf("127.0.0.1:%d", porta)
	}
	return fmt.Sprintf(":%d", porta)
}

// exigeTokenDasMetricas recusa com 401 quem não mandar o token. Sem token
// configurado não há o que conferir: o servidor já está preso a 127.0.0.1.
func exigeTokenDasMetricas(token string, proximo http.Handler) http.Handler {
	token = strings.TrimSpace(token)
	if token == "" {
		return proximo
	}
	esperado := []byte("Bearer " + token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recebido := []byte(r.Header.Get("Authorization"))
		if subtle.ConstantTimeCompare(recebido, esperado) != 1 {
			w.Header().Set("WWW-Authenticate", `Bearer realm="orion-agent-metrics"`)
			http.Error(w, "nao autorizado", http.StatusUnauthorized)
			return
		}
		proximo.ServeHTTP(w, r)
	})
}
