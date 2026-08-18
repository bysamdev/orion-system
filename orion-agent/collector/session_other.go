//go:build !windows

package collector

import (
	"fmt"
	"os"
	"strings"
)

// obterDominioMaquina em plataformas não-Windows recorre a variáveis de ambiente ou WORKGROUP.
func obterDominioMaquina() string {
	if dnsDomain := strings.TrimSpace(os.Getenv("USERDNSDOMAIN")); dnsDomain != "" {
		return dnsDomain
	}
	userDomain := strings.TrimSpace(os.Getenv("USERDOMAIN"))
	if userDomain != "" {
		return userDomain
	}
	return "WORKGROUP"
}

// usuarioDaSessaoAtiva não tem equivalente fora do Windows (WTS é uma API
// exclusiva do Terminal Services). O chamador (resolverIdentidadeDoUsuario)
// cai para as variáveis de ambiente do processo neste caso.
func usuarioDaSessaoAtiva() (dominio, usuario, sid string, err error) {
	return "", "", "", fmt.Errorf("resolução de SID via WTS só é suportada no Windows")
}
