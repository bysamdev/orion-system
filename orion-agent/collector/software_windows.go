//go:build windows

package collector

import (
	"sort"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// remoteToolSpec define os padrões de identificação de softwares de acesso remoto.
type remoteToolSpec struct {
	CanonicalName string
	Keywords      []string
	ProcessNames  []string
}

var knownRemoteTools = []remoteToolSpec{
	{
		CanonicalName: "TeamViewer",
		Keywords:      []string{"teamviewer"},
		ProcessNames:  []string{"teamviewer.exe", "teamviewer_service.exe", "tv_w32.exe", "tv_x64.exe"},
	},
	{
		CanonicalName: "AnyDesk",
		Keywords:      []string{"anydesk"},
		ProcessNames:  []string{"anydesk.exe", "anydesk_service.exe"},
	},
	{
		CanonicalName: "RustDesk",
		Keywords:      []string{"rustdesk"},
		ProcessNames:  []string{"rustdesk.exe", "rustdesk_service.exe"},
	},
	{
		CanonicalName: "LogMeIn",
		Keywords:      []string{"logmein", "gotomypc"},
		ProcessNames:  []string{"logmein.exe", "logmeinsystray.exe", "lmiguardiansvc.exe", "gotomypc.exe"},
	},
	{
		CanonicalName: "UltraVNC",
		Keywords:      []string{"ultravnc"},
		ProcessNames:  []string{"winvnc.exe", "ultravnc.exe"},
	},
	{
		CanonicalName: "RealVNC",
		Keywords:      []string{"realvnc", "vnc viewer", "vnc server"},
		ProcessNames:  []string{"vncserver.exe", "vncserverui.exe", "vncviewer.exe"},
	},
	{
		CanonicalName: "TightVNC",
		Keywords:      []string{"tightvnc"},
		ProcessNames:  []string{"tvnserver.exe", "tvnviewer.exe"},
	},
	{
		CanonicalName: "ScreenConnect",
		Keywords:      []string{"screenconnect", "connectwise control"},
		ProcessNames:  []string{"screenconnect.clientservice.exe", "screenconnect.windowsclient.exe"},
	},
}

// listarNomesProcessosAtivos retorna todos os executáveis em execução via snapshot Win32 em < 10ms.
func listarNomesProcessosAtivos() []string {
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(snapshot)

	var entry windows.ProcessEntry32
	entry.Size = uint32(unsafe.Sizeof(entry))

	var procs []string
	if err := windows.Process32First(snapshot, &entry); err != nil {
		return nil
	}

	for {
		name := windows.UTF16ToString(entry.ExeFile[:])
		if name != "" {
			procs = append(procs, name)
		}
		if err := windows.Process32Next(snapshot, &entry); err != nil {
			break
		}
	}
	return procs
}

// coletarSoftwaresRemotos varre o registro e processos ativos para identificar ferramentas de acesso remoto.
func coletarSoftwaresRemotos() []RemoteSoftwareInfo {
	detected := make(map[string]*RemoteSoftwareInfo)

	// 1. Varredura no Registro do Windows
	regPaths := []struct {
		root registry.Key
		path string
	}{
		{registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`},
		{registry.LOCAL_MACHINE, `SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`},
		{registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Uninstall`},
	}

	for _, rp := range regPaths {
		k, err := registry.OpenKey(rp.root, rp.path, registry.READ)
		if err != nil {
			continue
		}
		subkeys, err := k.ReadSubKeyNames(-1)
		k.Close()
		if err != nil {
			continue
		}

		for _, sub := range subkeys {
			sk, err := registry.OpenKey(rp.root, rp.path+`\`+sub, registry.QUERY_VALUE)
			if err != nil {
				continue
			}
			displayName, _, _ := sk.GetStringValue("DisplayName")
			displayVersion, _, _ := sk.GetStringValue("DisplayVersion")
			sk.Close()

			if displayName == "" {
				continue
			}

			lowerName := strings.ToLower(displayName)
			for _, tool := range knownRemoteTools {
				match := false
				for _, kw := range tool.Keywords {
					if strings.Contains(lowerName, kw) {
						match = true
						break
					}
				}
				if match {
					if existing, ok := detected[tool.CanonicalName]; ok {
						if existing.Version == "" && displayVersion != "" {
							existing.Version = displayVersion
						}
					} else {
						detected[tool.CanonicalName] = &RemoteSoftwareInfo{
							Name:      tool.CanonicalName,
							Version:   displayVersion,
							IsRunning: false,
						}
					}
					break
				}
			}
		}
	}

	// 2. Varredura de Processos em Execução (ultrarrápida via Win32 Toolhelp32)
	procNames := listarNomesProcessosAtivos()
	runningToolMap := make(map[string]bool)
	for _, procName := range procNames {
		lowerProc := strings.ToLower(procName)
		for _, tool := range knownRemoteTools {
			for _, knownProc := range tool.ProcessNames {
				if lowerProc == knownProc || strings.Contains(lowerProc, strings.TrimSuffix(knownProc, ".exe")) {
					runningToolMap[tool.CanonicalName] = true
					break
				}
			}
		}
	}

	for canonName := range runningToolMap {
		if existing, ok := detected[canonName]; ok {
			existing.IsRunning = true
		} else {
			// Detectado apenas via processo ativo (ex.: versão portable)
			detected[canonName] = &RemoteSoftwareInfo{
				Name:      canonName,
				Version:   "",
				IsRunning: true,
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
