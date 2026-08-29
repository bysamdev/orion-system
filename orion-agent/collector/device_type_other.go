//go:build !windows

package collector

import (
	"os"
	"path/filepath"
	"strings"
)

// detectarTipoDispositivo em plataformas não-Windows usa sinais disponíveis
// sem privilégio elevado: presença de bateria (Linux) e o texto de
// /etc/os-release para distribuições explicitamente "server".
//
// Devolve também o motivo (Fase 3 do plano de escalabilidade). macOS não
// expõe /sys/class/power_supply nem /etc/os-release — nenhum dos dois
// sinais está disponível, então o resultado é "unknown" em vez de
// presumir "desktop" sem nenhuma base: não há, no momento, um sinal
// equivalente ao Win32_Battery/ChassisTypes para diferenciar MacBook de Mac
// desktop sem depender de IOKit via cgo.
func detectarTipoDispositivo() (tipo, motivo string) {
	bateriaDisponivel, temBat := temBateria()
	if temBat {
		return "notebook", "/sys/class/power_supply/BAT* presente"
	}

	osReleaseDisponivel, servidor := pareceServidorLinux()
	if servidor {
		return "server", `/etc/os-release contém "server"`
	}

	if !bateriaDisponivel && !osReleaseDisponivel {
		return "unknown", "nenhum sinal disponível nesta plataforma (nem /sys/class/power_supply nem /etc/os-release — típico de macOS)"
	}
	return "desktop", "sem sinal de bateria ou servidor"
}

// temBateria verifica a existência de /sys/class/power_supply/BAT* — padrão
// do kernel Linux para baterias de notebook, ausente em desktops e
// servidores. disponivel indica se o próprio diretório /sys/class/power_supply
// existe (Linux sempre tem esse caminho, mesmo vazio; macOS não tem) — é o
// que diferencia "checamos e não achamos bateria" de "não há como checar
// aqui".
func temBateria() (disponivel, tem bool) {
	if _, err := os.Stat("/sys/class/power_supply"); err != nil {
		return false, false
	}
	matches, err := filepath.Glob("/sys/class/power_supply/BAT*")
	return true, err == nil && len(matches) > 0
}

// pareceServidorLinux inspeciona /etc/os-release em busca do termo
// "server" — cobre distribuições cujo nome ou variante o declaram
// explicitamente (ex.: Ubuntu Server). disponivel indica se o arquivo pôde
// ser lido — sua ausência (ex.: macOS não tem /etc/os-release) não é
// tratada como "não é servidor", mas como "sem sinal".
func pareceServidorLinux() (disponivel, servidor bool) {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return false, false
	}
	return true, strings.Contains(strings.ToLower(string(data)), "server")
}
