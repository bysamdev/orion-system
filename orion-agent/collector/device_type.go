package collector

import "sync"

// tipoDispositivoUmaVez cacheia a classificação do dispositivo — assim como
// modeloDaCPU (hardware.go), é dado estático que não muda durante a vida do
// processo: um notebook não vira desktop entre dois heartbeats. Evita
// repetir consultas WMI (Windows) ou leitura de /sys (Linux) a cada coleta.
var (
	tipoDispositivoUmaVez  sync.Once
	tipoDispositivoCache   string
	motivoDispositivoCache string
)

// tipoDoDispositivo classifica a máquina como "desktop", "notebook",
// "server" ou "unknown" (Fase 3 do plano de escalabilidade: confiança
// insuficiente para os três primeiros vira "unknown" em vez de um "desktop"
// por omissão), alimentando a tela de Inventário de Dispositivos. Celulares
// e tablets não são um alvo do agente — ele só roda como serviço
// Windows/Linux/macOS — então não há (nem deveria haver) um caminho
// "mobile" aqui.
//
// A implementação concreta (detectarTipoDispositivo) é específica por
// plataforma — ver device_type_windows.go e device_type_other.go — mesmo
// padrão de session.go/session_windows.go para identidade do usuário.
func tipoDoDispositivo() string {
	tipo, _ := tipoEMotivoDoDispositivo()
	return tipo
}

// tipoEMotivoDoDispositivo é tipoDoDispositivo() com o motivo/sinal que
// decidiu a classificação — enviado ao backend em Payload.DeviceTypeReason
// para permitir auditar por que uma máquina foi classificada de um jeito
// (útil sobretudo para investigar um "unknown" ou uma classificação
// inesperada num painel de suporte).
func tipoEMotivoDoDispositivo() (tipo, motivo string) {
	tipoDispositivoUmaVez.Do(func() {
		tipoDispositivoCache, motivoDispositivoCache = detectarTipoDispositivo()
	})
	return tipoDispositivoCache, motivoDispositivoCache
}
