//go:build !windows

package collector

import "fmt"

// usuarioDaSessaoAtiva não tem equivalente fora do Windows (WTS é uma API
// exclusiva do Terminal Services). O chamador (resolverIdentidadeDoUsuario)
// cai para as variáveis de ambiente do processo neste caso.
func usuarioDaSessaoAtiva() (dominio, usuario, sid string, err error) {
	return "", "", "", fmt.Errorf("resolução de SID via WTS só é suportada no Windows")
}
