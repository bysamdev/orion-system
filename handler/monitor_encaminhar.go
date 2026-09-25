package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"orion-api/monitor"
)

// Repasse dos heartbeats ao Orion Monitor — fase 1 da separação do
// monitoramento (card "Separar o monitoramento em serviço próprio").
//
// Modo sombra: o heartbeat continua sendo processado aqui exatamente como
// antes, e só DEPOIS de aceito uma cópia vai para o Monitor. Nada depende da
// resposta dele. Isso deixa validar o serviço novo com tráfego real sem
// arriscar o que já funciona.
//
// Síncrono e curto de propósito: na Vercel uma goroutine que sobrevive à
// resposta pode ser congelada junto com a função, e o repasse se perderia sem
// aviso. Com o servidor de monitoramento fora do ar, o custo é no máximo
// timeoutRepasse a mais no heartbeat, que o agente tolera com folga (o
// timeout dele é de 15 s).
const timeoutRepasse = 2 * time.Second

var clienteRepasse = &http.Client{Timeout: timeoutRepasse}

// Devolve a configuração de sonda de links quando o Monitor manda uma na
// resposta (a máquina é o servidor que mede os links do cliente); nil nos
// demais casos, inclusive falha.
func encaminharAoMonitor(ctx context.Context, a monitor.Amostra) *monitor.ConfigDaSonda {
	url := strings.TrimSpace(cfg.MonitorIngestURL)
	if url == "" || cfg.MonitorIngestSecret == "" {
		return nil
	}
	corpo, err := json.Marshal(a)
	if err != nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, timeoutRepasse)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimSuffix(url, "/")+"/v1/ingest/heartbeat", bytes.NewReader(corpo))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.MonitorIngestSecret)

	resp, err := clienteRepasse.Do(req)
	if err != nil {
		log.Printf("[AVISO] repasse ao monitor falhou para %s: %v", a.Hostname, err)
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("[AVISO] monitor respondeu %d ao repasse de %s", resp.StatusCode, a.Hostname)
		return nil
	}
	var resposta struct {
		Sonda *monitor.ConfigDaSonda `json:"sonda"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&resposta); err != nil {
		return nil
	}
	return resposta.Sonda
}

// amostraDoHeartbeat monta a cópia enviada ao Monitor a partir do heartbeat já
// aceito, com a máquina e a empresa resolvidas por aqui.
func amostraDoHeartbeat(req *heartbeatReq, machineID, companyID, deviceType string, recebidaEm time.Time) monitor.Amostra {
	return monitor.Amostra{
		MachineID: machineID, CompanyID: companyID, Hostname: req.Hostname, DeviceType: deviceType,
		AgentVersion: req.AgentVersion, OS: req.OS, OSVersion: req.OSVersion, IP: req.IP, CurrentUser: req.CurrentUser,
		CPUUsage: req.CPUUsage, RAMTotal: req.RAMTotal, RAMUsed: req.RAMUsed,
		DiskTotal: req.DiskTotal, DiskUsed: req.DiskUsed, Uptime: req.Uptime,
		// Mesma normalização do inventário do Supabase (ver normalizarOrdem):
		// sem ela o Monitor também regravaria o inventário a cada heartbeat.
		CPUModel: req.CPUModel, GPU: req.GPU,
		Disks:          normalizarOrdem(arredondarUsoDosDiscos(req.Disks)),
		Interfaces:     normalizarOrdem(req.Interfaces),
		Security:       normalizarOrdem(req.Security),
		RemoteSoftware: normalizarOrdem(req.RemoteSoftware),
		Battery:        normalizarOrdem(req.Battery),
		UpdateStatus:   normalizarOrdem(req.UpdateStatus),
		Links:          req.Links,
		RecebidaEm:     recebidaEm,
	}
}
