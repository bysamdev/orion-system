//go:build !windows

package collector

import (
	"os"
	"path/filepath"
	"strings"
)

// detectarTipoDispositivo em plataformas não-Windows usa sinais disponíveis
// sem privilégio elevado: presença de bateria (Linux) e o texto de
// /etc/os-release para distribuições explicitamente "server". macOS não
// expõe /sys/class/power_supply — um MacBook cai no default "desktop" aqui;
// não há, no momento, um sinal equivalente ao Win32_Battery/ChassisTypes
// para diferenciar MacBook de Mac desktop sem depender de IOKit via cgo.
func detectarTipoDispositivo() string {
	if temBateria() {
		return "notebook"
	}
	if pareceServidorLinux() {
		return "server"
	}
	return "desktop"
}

// temBateria verifica a existência de /sys/class/power_supply/BAT* — padrão
// do kernel Linux para baterias de notebook, ausente em desktops e
// servidores.
func temBateria() bool {
	matches, err := filepath.Glob("/sys/class/power_supply/BAT*")
	return err == nil && len(matches) > 0
}

// pareceServidorLinux inspeciona /etc/os-release em busca do termo
// "server" — cobre distribuições cujo nome ou variante o declaram
// explicitamente (ex.: Ubuntu Server). Ausência do arquivo (ou de
// permissão para lê-lo) não é erro: apenas não há sinal de servidor.
func pareceServidorLinux() bool {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return false
	}
	return strings.Contains(strings.ToLower(string(data)), "server")
}
