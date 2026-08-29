//go:build !windows

package collector

// coletarTiposDeMidiaPorLetra não tem equivalente ao WMI fora do Windows
// disponível sem privilégio elevado — o agente hoje só é distribuído pra
// Windows (ver DOCUMENTATION.md), então este stub existe só pra manter o
// pacote compilável em desenvolvimento/CI não-Windows. Mapa vazio: o
// chamador já trata ausência de entrada como "" (tipo desconhecido).
func coletarTiposDeMidiaPorLetra() map[string]string {
	return map[string]string{}
}
