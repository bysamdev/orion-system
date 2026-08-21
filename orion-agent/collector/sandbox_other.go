//go:build !windows

package collector

// DetectarAmbienteDeSandbox não tem sinal equivalente ao WMI fora do
// Windows disponível sem privilégio elevado — o agente hoje só é
// distribuído para Windows (ver DOCUMENTATION.md), então este stub existe
// só para manter o pacote compilável em desenvolvimento/CI não-Windows.
func DetectarAmbienteDeSandbox() bool {
	return false
}
