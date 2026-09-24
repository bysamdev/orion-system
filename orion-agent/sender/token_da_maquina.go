package sender

import (
	"net/http"
	"sync/atomic"
)

// SEC-06: a busca e a resposta de comandos autenticavam só com a chave da
// empresa + machine_id, então qualquer máquina da empresa podia buscar os
// comandos de outra (ou responder por ela). A partir do 1.1.33 o agente
// manda também o token individual da máquina (o mesmo do check-in, que só
// ela conhece) no cabeçalho X-Machine-Token, e a API confere.

// CabecalhoTokenDaMaquina é o nome do cabeçalho que a API confere.
const CabecalhoTokenDaMaquina = "X-Machine-Token"

var tokenDaMaquina atomic.Value // string

// DefinirTokenDaMaquina guarda o token desta máquina para as próximas
// requisições. O serviço chama sempre que carrega ou troca o token.
func DefinirTokenDaMaquina(token string) {
	tokenDaMaquina.Store(token)
}

func tokenAtual() string {
	t, _ := tokenDaMaquina.Load().(string)
	return t
}

// colocarTokenDaMaquina põe o cabeçalho quando há token conhecido.
func colocarTokenDaMaquina(h http.Header) {
	if t := tokenAtual(); t != "" {
		h.Set(CabecalhoTokenDaMaquina, t)
	}
}
