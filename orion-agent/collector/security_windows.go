//go:build windows

package collector

import (
	"context"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"github.com/yusufpapurcu/wmi"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// win32AntiVirusProduct espelha os campos necessários do WMI root\SecurityCenter2.
type win32AntiVirusProduct struct {
	DisplayName  string
	ProductState uint32
}

// win32FirewallProduct espelha os campos necessários do WMI root\SecurityCenter2.
type win32FirewallProduct struct {
	DisplayName  string
	ProductState uint32
}

// win32EncryptableVolume espelha os campos do BitLocker no WMI root\CIMV2\Security\MicrosoftVolumeEncryption.
type win32EncryptableVolume struct {
	DriveLetter      string
	ProtectionStatus uint32 // 0 = Unprotected, 1 = Protected, 2 = Unknown
	ConversionStatus uint32
}

// isProductStateActive verifica se a proteção em tempo real está habilitada no SecurityCenter2.
// Em productState (formato 0xWXYZZ), os bits 12-15 (0x1000) indicam se o antivírus/firewall está ativo.
func isProductStateActive(state uint32) bool {
	return (state & 0x1000) != 0
}

// coletarSeguranca executa a coleta dos status de Antivírus, Firewall e BitLocker no Windows.
func coletarSeguranca() SecurityInfo {
	av := coletarAntivirus()
	fw := coletarFirewall()
	bl := coletarBitLocker()

	blActive := false
	for _, b := range bl {
		if b.Active {
			blActive = true
			break
		}
	}

	return SecurityInfo{
		Antivirus:       av,
		FirewallActive:  fw,
		BitLocker:       bl,
		BitLockerActive: blActive,
	}
}

// coletarAntivirus consulta o WMI root\SecurityCenter2 para obter os antivírus instalados e seu estado.
func coletarAntivirus() []AntivirusInfo {
	var prods []win32AntiVirusProduct
	err := wmi.QueryNamespace("SELECT DisplayName, ProductState FROM AntiVirusProduct", &prods, `root\SecurityCenter2`)
	if err != nil || len(prods) == 0 {
		return []AntivirusInfo{}
	}

	resultadoMap := make(map[string]bool)
	for _, p := range prods {
		name := strings.TrimSpace(p.DisplayName)
		if name == "" {
			continue
		}
		active := isProductStateActive(p.ProductState)
		// Se já existir entrada com o mesmo nome, mantém como ativa se qualquer instância estiver ativa
		if cur, ok := resultadoMap[name]; ok {
			resultadoMap[name] = cur || active
		} else {
			resultadoMap[name] = active
		}
	}

	var resultado []AntivirusInfo
	for name, active := range resultadoMap {
		resultado = append(resultado, AntivirusInfo{
			Name:   name,
			Active: active,
		})
	}
	return resultado
}

// coletarFirewall verifica se o firewall está ativo via Registro, SecurityCenter2 ou netsh.
func coletarFirewall() bool {
	// 1. Consulta no Registro do Windows (Firewall Nativo - ultrarrápido)
	profiles := []string{"StandardProfile", "DomainProfile", "PublicProfile"}
	for _, p := range profiles {
		k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\`+p, registry.QUERY_VALUE)
		if err == nil {
			val, _, err := k.GetIntegerValue("EnableFirewall")
			k.Close()
			if err == nil && val == 1 {
				return true
			}
		}
	}

	// 2. Consulta WMI root\SecurityCenter2 -> FirewallProduct
	var fws []win32FirewallProduct
	if err := wmi.QueryNamespace("SELECT DisplayName, ProductState FROM FirewallProduct", &fws, `root\SecurityCenter2`); err == nil && len(fws) > 0 {
		for _, f := range fws {
			if isProductStateActive(f.ProductState) {
				return true
			}
		}
	}

	return false
}

// isProcessElevated verifica se o processo possui privilégios de Administrador / SYSTEM.
func isProcessElevated() bool {
	var token windows.Token
	proc := windows.CurrentProcess()
	if err := windows.OpenProcessToken(proc, windows.TOKEN_QUERY, &token); err != nil {
		return false
	}
	defer token.Close()
	return token.IsElevated()
}

// coletarBitLocker consulta o status de criptografia de volumes BitLocker (disco C: prioritário).
func coletarBitLocker() []BitLockerInfo {
	if !isProcessElevated() {
		return []BitLockerInfo{
			{
				Mount:  "C:",
				Status: "Unknown",
				Active: false,
			},
		}
	}

	var volumes []win32EncryptableVolume
	err := wmi.QueryNamespace("SELECT DriveLetter, ProtectionStatus, ConversionStatus FROM Win32_EncryptableVolume", &volumes, `root\CIMV2\Security\MicrosoftVolumeEncryption`)
	if err == nil && len(volumes) > 0 {
		var resultado []BitLockerInfo
		for _, v := range volumes {
			mount := strings.TrimSpace(v.DriveLetter)
			if mount == "" {
				mount = "C:"
			}
			active := (v.ProtectionStatus == 1)
			statusStr := "Unprotected"
			if active {
				statusStr = "Protected"
			}
			resultado = append(resultado, BitLockerInfo{
				Mount:  mount,
				Status: statusStr,
				Active: active,
			})
		}
		return resultado
	}

	// Se erro for de permissão negada, retornamos seguro imediatamente sem travar
	if err != nil {
		errStr := strings.ToLower(err.Error())
		if strings.Contains(errStr, "negado") || strings.Contains(errStr, "denied") || strings.Contains(errStr, "0x80041003") {
			return []BitLockerInfo{
				{
					Mount:  "C:",
					Status: "Unknown",
					Active: false,
				},
			}
		}
	}

	// Fallback via manage-bde -status C: com timeout estrito
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	cmd := exec.CommandContext(ctx, "manage-bde", "-status", "C:")
	// Sem isso, essa coleta periódica de segurança abre e fecha uma janela
	// de console visível a cada ciclo — mesmo motivo do fix em
	// service/windows.go (executeCommand/runInstaller).
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if out, err := cmd.CombinedOutput(); err == nil {
		outStr := string(out)
		active := strings.Contains(outStr, "Protection On") ||
			strings.Contains(outStr, "Proteção Ativada") ||
			strings.Contains(outStr, "ProtectionStatus: 1")
		statusStr := "Unprotected"
		if active {
			statusStr = "Protected"
		}
		return []BitLockerInfo{
			{
				Mount:  "C:",
				Status: statusStr,
				Active: active,
			},
		}
	}

	return []BitLockerInfo{
		{
			Mount:  "C:",
			Status: "Unknown",
			Active: false,
		},
	}
}
