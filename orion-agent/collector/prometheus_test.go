package collector

import (
	"strings"
	"testing"
)

func TestGeneratePrometheusMetrics(t *testing.T) {
	mockPayload := &Payload{
		Hostname:     "orion-server-01",
		CPUUsage:     32.45,
		RAMTotal:     16000000000,
		RAMUsed:      8000000000,
		DiskTotal:    500000000000,
		DiskUsed:     250000000000,
		Uptime:       86400,
		OS:           "windows",
		OSVersion:    "10.0.19045",
		DeviceType:   "desktop",
		Domain:       "CORP",
		CurrentUser:  "john.doe",
		IP:           "192.168.1.50",
		AgentVersion: "1.2.0",
		Disks: []DiskInfo{
			{
				Device:     "C:",
				Mountpoint: `C:\`,
				Total:      500000000000,
				Used:       250000000000,
			},
			{
				Device:     "D:",
				Mountpoint: `D:\Data`,
				Total:      1000000000000,
				Used:       100000000000,
			},
		},
	}

	output := GeneratePrometheusMetrics(mockPayload)

	linhasEsperadas := []string{
		"# HELP orion_cpu_usage_percent Uso de CPU em porcentagem",
		"# TYPE orion_cpu_usage_percent gauge",
		`orion_cpu_usage_percent{hostname="orion-server-01"} 32.45`,

		"# HELP orion_memory_total_bytes Memória RAM total em bytes",
		"# TYPE orion_memory_total_bytes gauge",
		`orion_memory_total_bytes{hostname="orion-server-01"} 16000000000`,

		"# HELP orion_memory_used_bytes Memória RAM usada em bytes",
		"# TYPE orion_memory_used_bytes gauge",
		`orion_memory_used_bytes{hostname="orion-server-01"} 8000000000`,

		"# HELP orion_memory_usage_percent Uso de memória RAM em porcentagem",
		"# TYPE orion_memory_usage_percent gauge",
		`orion_memory_usage_percent{hostname="orion-server-01"} 50.00`,

		"# HELP orion_disk_total_bytes Espaço total em disco em bytes",
		"# TYPE orion_disk_total_bytes gauge",
		`orion_disk_total_bytes{hostname="orion-server-01",mount="C:\\"} 500000000000`,
		`orion_disk_total_bytes{hostname="orion-server-01",mount="D:\\Data"} 1000000000000`,

		"# HELP orion_disk_used_bytes Espaço usado em disco em bytes",
		"# TYPE orion_disk_used_bytes gauge",
		`orion_disk_used_bytes{hostname="orion-server-01",mount="C:\\"} 250000000000`,
		`orion_disk_used_bytes{hostname="orion-server-01",mount="D:\\Data"} 100000000000`,

		"# HELP orion_agent_uptime_seconds Tempo de atividade do sistema em segundos",
		"# TYPE orion_agent_uptime_seconds gauge",
		`orion_agent_uptime_seconds{hostname="orion-server-01"} 86400`,

		"# HELP orion_agent_info Metadados informativos da máquina e versão do agente Orion",
		"# TYPE orion_agent_info gauge",
		`orion_agent_info{agent_version="1.2.0",current_user="john.doe",device_type="desktop",domain="CORP",hostname="orion-server-01",ip="192.168.1.50",os="windows",os_version="10.0.19045"} 1`,
	}

	for _, esperada := range linhasEsperadas {
		if !strings.Contains(output, esperada) {
			t.Errorf("Saída Prometheus não contém a linha esperada:\n%s\n\nSaída completa:\n%s", esperada, output)
		}
	}
}

func TestGeneratePrometheusMetricsNil(t *testing.T) {
	if got := GeneratePrometheusMetrics(nil); got != "" {
		t.Errorf("GeneratePrometheusMetrics(nil) esperava string vazia, obtido: %q", got)
	}
}

func TestGeneratePrometheusMetricsZeroRAM(t *testing.T) {
	mock := &Payload{
		Hostname: "zero-ram",
		RAMTotal: 0,
		RAMUsed:  0,
	}
	output := GeneratePrometheusMetrics(mock)
	if !strings.Contains(output, `orion_memory_usage_percent{hostname="zero-ram"} 0.00`) {
		t.Errorf("com RAM total 0, esperava porcentagem 0.00, obtido:\n%s", output)
	}
}

func TestGeneratePrometheusMetricsDisksFallback(t *testing.T) {
	mock := &Payload{
		Hostname:  "fallback-disks",
		DiskTotal: 123456789,
		DiskUsed:  98765432,
		Disks:     nil,
	}
	output := GeneratePrometheusMetrics(mock)

	esperadoTotal := `orion_disk_total_bytes{hostname="fallback-disks",mount="root"} 123456789`
	esperadoUsado := `orion_disk_used_bytes{hostname="fallback-disks",mount="root"} 98765432`

	if !strings.Contains(output, esperadoTotal) {
		t.Errorf("esperava fallback de disk total %q, obtido:\n%s", esperadoTotal, output)
	}
	if !strings.Contains(output, esperadoUsado) {
		t.Errorf("esperava fallback de disk used %q, obtido:\n%s", esperadoUsado, output)
	}
}

func TestEscapeLabelValue(t *testing.T) {
	casos := []struct {
		entrada  string
		esperado string
	}{
		{`simples`, `simples`},
		{`C:\Users\test`, `C:\\Users\\test`},
		{`com "aspas"`, `com \"aspas\"`},
		{"com\nquebra", `com\nquebra`},
		{`tudo \"junto\" \n`, `tudo \\\"junto\\\" \\n`},
	}

	for _, c := range casos {
		got := escapeLabelValue(c.entrada)
		if got != c.esperado {
			t.Errorf("escapeLabelValue(%q) = %q, esperado %q", c.entrada, got, c.esperado)
		}
	}
}

func TestFormatPrometheusMetricsAlias(t *testing.T) {
	mock := &Payload{Hostname: "alias-test", CPUUsage: 10.0}
	if FormatPrometheusMetrics(mock) != GeneratePrometheusMetrics(mock) {
		t.Errorf("FormatPrometheusMetrics não bate com GeneratePrometheusMetrics")
	}
}

func TestGetHardwareInfoEExportPrometheusMetrics(t *testing.T) {
	payload, err := GetHardwareInfo()
	if err != nil {
		t.Fatalf("GetHardwareInfo falhou: %v", err)
	}
	if payload == nil {
		t.Fatalf("GetHardwareInfo retornou payload nulo")
	}

	metrics, err := ExportPrometheusMetrics()
	if err != nil {
		t.Fatalf("ExportPrometheusMetrics falhou: %v", err)
	}
	if !strings.Contains(metrics, "orion_cpu_usage_percent") {
		t.Errorf("ExportPrometheusMetrics não contém orion_cpu_usage_percent:\n%s", metrics)
	}
	if !strings.Contains(metrics, "orion_memory_total_bytes") {
		t.Errorf("ExportPrometheusMetrics não contém orion_memory_total_bytes:\n%s", metrics)
	}
}
