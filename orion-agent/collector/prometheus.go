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
	sb.WriteString(fmt.Sprintf("orion_agent_uptime_seconds{hostname=\"%s\"} %d\n", escapedHost, p.Uptime))

	// 8. Orion Agent Info (Metadata)
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
