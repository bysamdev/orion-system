package handler

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"strings"
)

// SEC-06: poll e resposta de comandos e o WebSocket do terminal do agente
// autenticavam só com a chave da empresa + machine_id. Qualquer máquina da
// mesma empresa (ou quem tivesse a chave) podia buscar os comandos de outra,
// responder por ela ou abrir o terminal no lugar dela.
//
// O agente 1.1.33 manda o token individual da máquina (o do check-in) no
// cabeçalho X-Machine-Token. Transição sem derrubar a frota:
//   - cabeçalho presente: tem de bater com o token da máquina, senão 403;
//   - cabeçalho ausente (agente até 1.1.32): aceito e registrado no log.
//
// Quando a frota inteira estiver no 1.1.33, trocar exigirTokenDaMaquina
// para true e o cabeçalho passa a ser obrigatório.
const cabecalhoTokenDaMaquina = "X-Machine-Token"

var exigirTokenDaMaquina = false

// tokenDaMaquinaConfere compara em tempo constante; token vazio nunca confere.
func tokenDaMaquinaConfere(recebido, esperado string) bool {
	recebido, esperado = strings.TrimSpace(recebido), strings.TrimSpace(esperado)
	if recebido == "" || esperado == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(recebido), []byte(esperado)) == 1
}

// decidirTokenDaMaquina diz se a requisição passa. esperado vem do banco
// (machines.machine_token da máquina alvo).
func decidirTokenDaMaquina(recebido, esperado string, exigir bool) (passa bool, legado bool) {
	if strings.TrimSpace(recebido) == "" {
		return !exigir, true
	}
	return tokenDaMaquinaConfere(recebido, esperado), false
}

// conferirTokenDaMaquina aplica a regra acima à máquina machineID. Devolve
// false quando a requisição deve ser recusada (403).
func conferirTokenDaMaquina(ctx context.Context, r *http.Request, machineID, onde string) bool {
	recebido := r.Header.Get(cabecalhoTokenDaMaquina)
	esperado := ""
	if strings.TrimSpace(recebido) != "" {
		tok, _, err := db.MachineTokenAndCompanyByID(ctx, machineID)
		if err != nil {
			log.Printf("[SEC-06] %s: máquina %s não encontrada ao conferir token: %v", onde, machineID, err)
			return false
		}
		esperado = tok
	}
	passa, legado := decidirTokenDaMaquina(recebido, esperado, exigirTokenDaMaquina)
	if legado {
		log.Printf("[SEC-06] %s: agente sem %s (machine=%s)", onde, cabecalhoTokenDaMaquina, machineID)
	} else if !passa {
		log.Printf("[SEC-06] %s: token da máquina não confere (machine=%s)", onde, machineID)
	}
	return passa
}
