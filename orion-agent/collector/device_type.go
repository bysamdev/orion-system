package collector

import "sync"

// tipoDispositivoUmaVez cacheia a classificação do dispositivo — assim como
// modeloDaCPU (hardware.go), é dado estático que não muda durante a vida do
// processo: um notebook não vira desktop entre dois heartbeats. Evita
// repetir consultas WMI (Windows) ou leitura de /sys (Linux) a cada coleta.
var (
	tipoDispositivoUmaVez sync.Once
	tipoDispositivoCache  string
)

// tipoDoDispositivo classifica a máquina como "desktop", "notebook" ou
// "server", alimentando a tela de Inventário de Dispositivos. Celulares e
// tablets não são um alvo do agente — ele só roda como serviço
// Windows/Linux/macOS — então não há (nem deveria haver) um caminho
// "mobile" aqui.
//
// A implementação concreta (detectarTipoDispositivo) é específica por
// plataforma — ver device_type_windows.go e device_type_other.go — mesmo
// padrão de session.go/session_windows.go para identidade do usuário.
func tipoDoDispositivo() string {
	tipoDispositivoUmaVez.Do(func() {
		tipoDispositivoCache = detectarTipoDispositivo()
	})
	return tipoDispositivoCache
}
