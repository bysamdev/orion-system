package collector

import (
	"fmt"
	"os"
	"strings"
)

// GetHardwareInfo executa a coleta completa do estado de hardware do sistema.
// É um wrapper semântico para Collect().
func GetHardwareInfo() (*Payload, error) {
	return Collect()
}

// escapeLabelValue formata strings para valores de label conforme a especificação do Prometheus.
// Caracteres especiais como aspas duplas, barras invertidas e quebras de linha são escapados.
func escapeLabelValue(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, "\n", `\n`)
	return s
}

// GeneratePrometheusMetrics converte o Payload de hardware em formato de texto OpenMetrics / Prometheus.
func GeneratePrometheusMetrics(p *Payload) string {
	if p == nil {
		return ""
	}

	hostname := p.Hostname
	if hostname == "" {
		if h, err := os.Hostname(); err == nil {
			hostname = h
		} else {
			hostname = "unknown"
		}
	}
	escapedHost := escapeLabelValue(hostname)

	var sb strings.Builder

	// 1. CPU Usage Percent
	sb.WriteString("# HELP orion_cpu_usage_percent Uso de CPU em porcentagem\n")
	sb.WriteString("# TYPE orion_cpu_usage_percent gauge\n")
	sb.WriteString(fmt.Sprintf("orion_cpu_usage_percent{hostname=\"%s\"} %.2f\n\n", escapedHost, p.CPUUsage))

	// 2. Memory Total Bytes
	sb.WriteString("# HELP orion_memory_total_bytes Memória RAM total em bytes\n")
	sb.WriteString("# TYPE orion_memory_total_bytes gauge\n")
	sb.WriteString(fmt.Sprintf("orion_memory_total_bytes{hostname=\"%s\"} %d\n\n", escapedHost, p.RAMTotal))

	// 3. Memory Used Bytes
	sb.WriteString("# HELP orion_memory_used_bytes Memória RAM usada em bytes\n")
	sb.WriteString("# TYPE orion_memory_used_bytes gauge\n")
	sb.WriteString(fmt.Sprintf("orion_memory_used_bytes{hostname=\"%s\"} %d\n\n", escapedHost, p.RAMUsed))

	// 4. Memory Usage Percent
	var memUsagePercent float64
	if p.RAMTotal > 0 {
		memUsagePercent = (float64(p.RAMUsed) / float64(p.RAMTotal)) * 100.0
	}
	sb.WriteString("# HELP orion_memory_usage_percent Uso de memória RAM em porcentagem\n")
	sb.WriteString("# TYPE orion_memory_usage_percent gauge\n")
	sb.WriteString(fmt.Sprintf("orion_memory_usage_percent{hostname=\"%s\"} %.2f\n\n", escapedHost, memUsagePercent))

	// 5. Disk Total Bytes
	sb.WriteString("# HELP orion_disk_total_bytes Espaço total em disco em bytes\n")
	sb.WriteString("# TYPE orion_disk_total_bytes gauge\n")
	if len(p.Disks) > 0 {
		for _, d := range p.Disks {
			mount := d.Mountpoint
			if mount == "" {
				mount = d.Device
			}
			if mount == "" {
				mount = "root"
			}
			sb.WriteString(fmt.Sprintf("orion_disk_total_bytes{hostname=\"%s\",mount=\"%s\"} %d\n", escapedHost, escapeLabelValue(mount), d.Total))
		}
	} else {
		sb.WriteString(fmt.Sprintf("orion_disk_total_bytes{hostname=\"%s\",mount=\"root\"} %d\n", escapedHost, p.DiskTotal))
	}
	sb.WriteString("\n")

	// 6. Disk Used Bytes
	sb.WriteString("# HELP orion_disk_used_bytes Espaço usado em disco em bytes\n")
	sb.WriteString("# TYPE orion_disk_used_bytes gauge\n")
	if len(p.Disks) > 0 {
		for _, d := range p.Disks {
			mount := d.Mountpoint
			if mount == "" {
				mount = d.Device
			}
			if mount == "" {
				mount = "root"
			}
			sb.WriteString(fmt.Sprintf("orion_disk_used_bytes{hostname=\"%s\",mount=\"%s\"} %d\n", escapedHost, escapeLabelValue(mount), d.Used))
		}
	} else {
		sb.WriteString(fmt.Sprintf("orion_disk_used_bytes{hostname=\"%s\",mount=\"root\"} %d\n", escapedHost, p.DiskUsed))
	}
	sb.WriteString("\n")

	// 7. Uptime Seconds
	sb.WriteString("# HELP orion_agent_uptime_seconds Tempo de atividade do sistema em segundos\n")
	sb.WriteString("# TYPE orion_agent_uptime_seconds gauge\n")
	sb.WriteString(fmt.Sprintf("orion_agent_uptime_seconds{hostname=\"%s\"} %d\n\n", escapedHost, p.Uptime))

	// 8. Network Interfaces Count
	sb.WriteString("# HELP orion_network_interfaces_count Quantidade de interfaces de rede ativas\n")
	sb.WriteString("# TYPE orion_network_interfaces_count gauge\n")
	sb.WriteString(fmt.Sprintf("orion_network_interfaces_count{hostname=\"%s\"} %d\n\n", escapedHost, len(p.Interfaces)))

	// 9. Network Status (1 = online/conectado, 0 = desconectado)
	networkStatus := 0
	if len(p.Interfaces) > 0 || p.IP != "" {
		networkStatus = 1
	}
	sb.WriteString("# HELP orion_network_status Status de conectividade da rede local (1 para conectado, 0 para desconectado)\n")
	sb.WriteString("# TYPE orion_network_status gauge\n")
	sb.WriteString(fmt.Sprintf("orion_network_status{hostname=\"%s\"} %d\n", escapedHost, networkStatus))

	// 10. Security - Antivirus Status
	if len(p.Security.Antivirus) > 0 {
		sb.WriteString("\n# HELP orion_security_antivirus_status Status do antivírus instalado (1 para ativo/em tempo real, 0 para inativo)\n")
		sb.WriteString("# TYPE orion_security_antivirus_status gauge\n")
		for _, av := range p.Security.Antivirus {
			avActive := 0
			if av.Active {
				avActive = 1
			}
			sb.WriteString(fmt.Sprintf("orion_security_antivirus_status{hostname=\"%s\",name=\"%s\"} %d\n", escapedHost, escapeLabelValue(av.Name), avActive))
		}
	}

	// 11. Security - Firewall Status
	firewallStatus := 0
	if p.Security.FirewallActive {
		firewallStatus = 1
	}
	sb.WriteString("\n# HELP orion_security_firewall_status Status do firewall do sistema (1 para ativo, 0 para inativo)\n")
	sb.WriteString("# TYPE orion_security_firewall_status gauge\n")
	sb.WriteString(fmt.Sprintf("orion_security_firewall_status{hostname=\"%s\"} %d\n", escapedHost, firewallStatus))

	// 12. Security - BitLocker Status
	sb.WriteString("\n# HELP orion_security_bitlocker_status Status de proteção BitLocker da unidade (1 para protegido, 0 para desprotegido)\n")
	sb.WriteString("# TYPE orion_security_bitlocker_status gauge\n")
	if len(p.Security.BitLocker) > 0 {
		for _, bl := range p.Security.BitLocker {
			mount := bl.Mount
			if mount == "" {
				mount = "C:"
			}
			blActive := 0
			if bl.Active {
				blActive = 1
			}
			sb.WriteString(fmt.Sprintf("orion_security_bitlocker_status{hostname=\"%s\",mount=\"%s\"} %d\n", escapedHost, escapeLabelValue(mount), blActive))
		}
	} else {
		sb.WriteString(fmt.Sprintf("orion_security_bitlocker_status{hostname=\"%s\",mount=\"C:\"} 0\n", escapedHost))
	}

	// 13. Remote Access Software
	if len(p.RemoteSoftware) > 0 {
		sb.WriteString("\n# HELP orion_software_remote_access Ferramentas de acesso remoto detectadas na máquina\n")
		sb.WriteString("# TYPE orion_software_remote_access gauge\n")
		for _, sw := range p.RemoteSoftware {
			runningStr := "false"
			if sw.IsRunning {
				runningStr = "true"
			}
			sb.WriteString(fmt.Sprintf(
				"orion_software_remote_access{hostname=\"%s\",name=\"%s\",running=\"%s\",version=\"%s\"} 1\n",
				escapedHost,
				escapeLabelValue(sw.Name),
				runningStr,
				escapeLabelValue(sw.Version),
			))
		}
	}

	// 14. Battery Level & Power Status
	if p.Battery.HasBattery {
		sb.WriteString("\n# HELP orion_battery_level_percent Nível de carga da bateria em porcentagem\n")
		sb.WriteString("# TYPE orion_battery_level_percent gauge\n")
		sb.WriteString(fmt.Sprintf("orion_battery_level_percent{hostname=\"%s\"} %d\n", escapedHost, p.Battery.Percent))
	}
	pluggedStatus := 0
	if p.Battery.PluggedIn {
		pluggedStatus = 1
	}
	sb.WriteString("\n# HELP orion_battery_plugged_in Status de alimentação AC/tomada (1 para conectado, 0 para desconectado)\n")
	sb.WriteString("# TYPE orion_battery_plugged_in gauge\n")
	sb.WriteString(fmt.Sprintf("orion_battery_plugged_in{hostname=\"%s\"} %d\n", escapedHost, pluggedStatus))

	// 15. Windows Update / Reboot Required
	rebootReq := 0
	if p.UpdateStatus.RebootRequired {
		rebootReq = 1
	}
	sb.WriteString("\n# HELP orion_windows_reboot_required Status de reinicialização pendente após atualizações (1 para pendente, 0 para não)\n")
	sb.WriteString("# TYPE orion_windows_reboot_required gauge\n")
	sb.WriteString(fmt.Sprintf("orion_windows_reboot_required{hostname=\"%s\"} %d\n", escapedHost, rebootReq))

	// 16. Orion Agent Info (Metadata)
	if p.AgentVersion != "" || p.OS != "" || p.DeviceType != "" {
		sb.WriteString("\n# HELP orion_agent_info Metadados informativos da máquina e versão do agente Orion\n")
		sb.WriteString("# TYPE orion_agent_info gauge\n")
		sb.WriteString(fmt.Sprintf(
			"orion_agent_info{agent_version=\"%s\",current_user=\"%s\",device_type=\"%s\",domain=\"%s\",hostname=\"%s\",ip=\"%s\",os=\"%s\",os_version=\"%s\"} 1\n",
			escapeLabelValue(p.AgentVersion),
			escapeLabelValue(p.CurrentUser),
			escapeLabelValue(p.DeviceType),
			escapeLabelValue(p.Domain),
			escapedHost,
			escapeLabelValue(p.IP),
			escapeLabelValue(p.OS),
			escapeLabelValue(p.OSVersion),
		))
	}

	return sb.String()
}

// FormatPrometheusMetrics é um alias para GeneratePrometheusMetrics.
func FormatPrometheusMetrics(p *Payload) string {
	return GeneratePrometheusMetrics(p)
}

// ExportPrometheusMetrics executa a coleta de hardware atual e gera o texto das métricas Prometheus.
func ExportPrometheusMetrics() (string, error) {
	p, err := GetHardwareInfo()
	if err != nil {
		return "", err
	}
	return GeneratePrometheusMetrics(p), nil
}
