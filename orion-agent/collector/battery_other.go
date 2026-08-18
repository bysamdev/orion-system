//go:build !windows

package collector

// coletarBateria retorna status de bateria padrão para sistemas não-Windows.
func coletarBateria() BatteryInfo {
	return BatteryInfo{
		HasBattery: false,
		Percent:    0,
		PluggedIn:  true,
		Status:     "Not Supported",
	}
}
