//go:build !windows

package collector

import (
	"sort"
	"strings"

	"github.com/shirou/gopsutil/v3/process"
)

var knownRemoteProcessNames = map[string]string{
	"teamviewer":      "TeamViewer",
	"anydesk":         "AnyDesk",
	"rustdesk":        "RustDesk",
	"logmein":         "LogMeIn",
	"x11vnc":          "VNC",
	"vncserver":       "RealVNC",
	"tightvnc":        "TightVNC",
	"screenconnect":   "ScreenConnect",
}

// coletarSoftwaresRemotos retorna lista de softwares de acesso remoto em execução em sistemas não-Windows.
func coletarSoftwaresRemotos() []RemoteSoftwareInfo {
	detected := make(map[string]*RemoteSoftwareInfo)
	procs, err := process.Processes()
	if err == nil {
		for _, p := range procs {
			name, err := p.Name()
			if err != nil {
				continue
			}
			lower := strings.ToLower(name)
			for procKey, canonName := range knownRemoteProcessNames {
				if strings.Contains(lower, procKey) {
					detected[canonName] = &RemoteSoftwareInfo{
						Name:      canonName,
						Version:   "",
						IsRunning: true,
					}
					break
				}
			}
		}
	}

	var resultado []RemoteSoftwareInfo
	for _, item := range detected {
		resultado = append(resultado, *item)
	}

	sort.Slice(resultado, func(i, j int) bool {
		return resultado[i].Name < resultado[j].Name
	})

	return resultado
}
