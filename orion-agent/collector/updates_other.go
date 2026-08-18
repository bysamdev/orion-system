//go:build !windows

package collector

import "os"

// coletarStatusAtualizacoes verifica reinicialização pendente em sistemas não-Windows.
func coletarStatusAtualizacoes() UpdateStatus {
	// No Linux Debian/Ubuntu, /var/run/reboot-required indica reboot pendente
	if _, err := os.Stat("/var/run/reboot-required"); err == nil {
		return UpdateStatus{RebootRequired: true}
	}
	return UpdateStatus{RebootRequired: false}
}
