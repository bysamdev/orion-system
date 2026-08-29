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
		Interfaces: []NetworkInterface{
			{
				Name: "Ethernet0",
				MAC:  "00:11:22:33:44:55",
				IPs:  []string{"192.168.1.50"},
			},
			{
				Name: "Wi-Fi",
				MAC:  "AA:BB:CC:DD:EE:FF",
				IPs:  []string{"192.168.1.51"},
			},
		},
		Security: SecurityInfo{
			Antivirus: []AntivirusInfo{
				{Name: "Windows Defender", Active: true},
				{Name: "Kaspersky", Active: false},
			},
			FirewallActive: true,
			BitLocker: []BitLockerInfo{
				{Mount: "C:", Status: "Protected", Active: true},
				{Mount: "D:", Status: "Unprotected", Active: false},
			},
		},
		RemoteSoftware: []RemoteSoftwareInfo{
			{Name: "TeamViewer", Version: "15.80.6", IsRunning: true},
			{Name: "AnyDesk", Version: "9.6.12", IsRunning: false},
		},
		Battery: BatteryInfo{
			HasBattery: true,
			Percent:    85,
			PluggedIn:  true,
			Status:     "Charging",
		},
		UpdateStatus: UpdateStatus{
			RebootRequired: true,
		},
		Activation: ActivationInfo{
			Activated: true,
			Status:    "Licensed",
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

		"# HELP orion_network_interfaces_count Quantidade de interfaces de rede ativas",
		"# TYPE orion_network_interfaces_count gauge",
		`orion_network_interfaces_count{hostname="orion-server-01"} 2`,

		"# HELP orion_network_status Status de conectividade da rede local (1 para conectado, 0 para desconectado)",
		"# TYPE orion_network_status gauge",
		`orion_network_status{hostname="orion-server-01"} 1`,

		"# HELP orion_security_antivirus_status Status do antivírus instalado (1 para ativo/em tempo real, 0 para inativo)",
		"# TYPE orion_security_antivirus_status gauge",
		`orion_security_antivirus_status{hostname="orion-server-01",name="Windows Defender"} 1`,
		`orion_security_antivirus_status{hostname="orion-server-01",name="Kaspersky"} 0`,

		"# HELP orion_security_firewall_status Status do firewall do sistema (1 para ativo, 0 para inativo)",
		"# TYPE orion_security_firewall_status gauge",
		`orion_security_firewall_status{hostname="orion-server-01"} 1`,

		"# HELP orion_security_bitlocker_status Status de proteção BitLocker da unidade (1 para protegido, 0 para desprotegido)",
		"# TYPE orion_security_bitlocker_status gauge",
		`orion_security_bitlocker_status{hostname="orion-server-01",mount="C:"} 1`,
		`orion_security_bitlocker_status{hostname="orion-server-01",mount="D:"} 0`,

		"# HELP orion_software_remote_access Ferramentas de acesso remoto detectadas na máquina",
		"# TYPE orion_software_remote_access gauge",
		`orion_software_remote_access{hostname="orion-server-01",name="TeamViewer",running="true",version="15.80.6"} 1`,
		`orion_software_remote_access{hostname="orion-server-01",name="AnyDesk",running="false",version="9.6.12"} 1`,

		"# HELP orion_battery_level_percent Nível de carga da bateria em porcentagem",
		"# TYPE orion_battery_level_percent gauge",
		`orion_battery_level_percent{hostname="orion-server-01"} 85`,

		"# HELP orion_battery_plugged_in Status de alimentação AC/tomada (1 para conectado, 0 para desconectado)",
		"# TYPE orion_battery_plugged_in gauge",
		`orion_battery_plugged_in{hostname="orion-server-01"} 1`,

		"# HELP orion_windows_reboot_required Status de reinicialização pendente após atualizações (1 para pendente, 0 para não)",
		"# TYPE orion_windows_reboot_required gauge",
		`orion_windows_reboot_required{hostname="orion-server-01"} 1`,

		"# HELP orion_windows_activation_status Status de ativação da licença do Windows (1 para ativado, 0 para não ativado)",
		"# TYPE orion_windows_activation_status gauge",
		`orion_windows_activation_status{hostname="orion-server-01",status="Licensed"} 1`,

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

func TestGeneratePrometheusMetricsNetworkDisconnected(t *testing.T) {
	mock := &Payload{
		Hostname:   "disconnected-host",
		IP:         "",
		Interfaces: nil,
	}
	output := GeneratePrometheusMetrics(mock)
	if !strings.Contains(output, `orion_network_interfaces_count{hostname="disconnected-host"} 0`) {
		t.Errorf("esperava 0 interfaces de rede, obtido:\n%s", output)
	}
	if !strings.Contains(output, `orion_network_status{hostname="disconnected-host"} 0`) {
		t.Errorf("esperava network status 0, obtido:\n%s", output)
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
	if !strings.Contains(metrics, "orion_network_interfaces_count") {
		t.Errorf("ExportPrometheusMetrics não contém orion_network_interfaces_count:\n%s", metrics)
	}
	if !strings.Contains(metrics, "orion_network_status") {
		t.Errorf("ExportPrometheusMetrics não contém orion_network_status:\n%s", metrics)
	}
}

