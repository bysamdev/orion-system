//go:build !windows

package collector

// coletarSeguranca retorna status padrão seguro para sistemas não-Windows.
func coletarSeguranca() SecurityInfo {
	return SecurityInfo{
		Antivirus:       []AntivirusInfo{},
		FirewallActive:  false,
		BitLocker:       []BitLockerInfo{},
		BitLockerActive: false,
	}
}
