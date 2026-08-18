//go:build windows

package collector

import (
	"golang.org/x/sys/windows/registry"
)

// coletarStatusAtualizacoes verifica chaves de registro que indicam necessidade de reinicialização pendente.
func coletarStatusAtualizacoes() UpdateStatus {
	return UpdateStatus{
		RebootRequired: verificarRebootPendente(),
	}
}

// verificarRebootPendente verifica se o Windows Update ou instaladores registraram reinicialização pendente.
func verificarRebootPendente() bool {
	// 1. Windows Update Auto Update RebootRequired
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired`, registry.QUERY_VALUE); err == nil {
		k.Close()
		return true
	}

	// 2. Component Based Servicing RebootPending
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending`, registry.QUERY_VALUE); err == nil {
		k.Close()
		return true
	}

	// 3. PendingFileRenameOperations no Session Manager
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager`, registry.QUERY_VALUE); err == nil {
		defer k.Close()
		if vals, _, err := k.GetStringsValue("PendingFileRenameOperations"); err == nil && len(vals) > 0 {
			return true
		}
	}

	return false
}
