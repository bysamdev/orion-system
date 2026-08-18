//go:build windows

package collector

import (
	"syscall"
	"unsafe"

	"github.com/yusufpapurcu/wmi"
)

var (
	modKernel32              = syscall.NewLazyDLL("kernel32.dll")
	procGetSystemPowerStatus = modKernel32.NewProc("GetSystemPowerStatus")
)

type systemPowerStatus struct {
	ACLineStatus        byte // 0: Offline (na bateria), 1: Online (tomada), 255: Desconhecido
	BatteryFlag         byte // 128: Sem bateria de sistema, 255: Desconhecido
	BatteryLifePercent  byte // 0-100%, 255: Desconhecido
	SystemStatusFlag    byte
	BatteryLifeTime     uint32
	BatteryFullLifeTime uint32
}

type win32BatteryFull struct {
	Name                     string
	EstimatedChargeRemaining uint16
	BatteryStatus            uint16
}

// mapearStatusBateria converte o código Win32_Battery.BatteryStatus em texto legível.
func mapearStatusBateria(codigo uint16) string {
	switch codigo {
	case 1:
		return "Discharging"
	case 2:
		return "Unknown"
	case 3:
		return "Fully Charged"
	case 4:
		return "Low"
	case 5:
		return "Critical"
	case 6:
		return "Charging"
	case 7:
		return "Charging and High"
	case 8:
		return "Charging and Low"
	case 9:
		return "Charging and Critical"
	case 10:
		return "Undefined"
	case 11:
		return "Partially Charged"
	default:
		return "Unknown"
	}
}

// coletarBateria consulta o WMI Win32_Battery e a API Win32 GetSystemPowerStatus para determinar o estado da bateria.
func coletarBateria() BatteryInfo {
	var sps systemPowerStatus
	r, _, _ := procGetSystemPowerStatus.Call(uintptr(unsafe.Pointer(&sps)))
	powerStatusOk := (r != 0)

	// 1. Consulta WMI Win32_Battery
	var baterias []win32BatteryFull
	err := wmi.Query("SELECT Name, EstimatedChargeRemaining, BatteryStatus FROM Win32_Battery", &baterias)
	if err == nil && len(baterias) > 0 {
		b := baterias[0]
		pluggedIn := false
		if powerStatusOk {
			pluggedIn = (sps.ACLineStatus == 1)
		} else {
			pluggedIn = (b.BatteryStatus == 2 || b.BatteryStatus == 3 || (b.BatteryStatus >= 6 && b.BatteryStatus <= 9))
		}

		pct := int(b.EstimatedChargeRemaining)
		if pct > 100 {
			pct = 100
		}

		return BatteryInfo{
			HasBattery: true,
			Percent:    pct,
			PluggedIn:  pluggedIn,
			Status:     mapearStatusBateria(b.BatteryStatus),
		}
	}

	// 2. Fallback via GetSystemPowerStatus
	if powerStatusOk && sps.BatteryFlag != 128 && sps.BatteryLifePercent <= 100 {
		return BatteryInfo{
			HasBattery: true,
			Percent:    int(sps.BatteryLifePercent),
			PluggedIn:  sps.ACLineStatus == 1,
			Status:     "OK",
		}
	}

	// 3. Desktop, servidor ou máquina virtual sem bateria
	plugged := true
	if powerStatusOk && sps.ACLineStatus == 0 {
		plugged = false
	}

	return BatteryInfo{
		HasBattery: false,
		Percent:    0,
		PluggedIn:  plugged,
		Status:     "No Battery",
	}
}
