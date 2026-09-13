package collector

import "testing"

func TestNormalizarMAC(t *testing.T) {
	casos := []struct {
		bruto, esperado string
	}{
		{"3C:7C:3F:79:79:51", "3c:7c:3f:79:79:51"},
		{"3c-7c-3f-79-79-51", "3c:7c:3f:79:79:51"},
		{" 3c7c.3f79.7951 ", "3c:7c:3f:79:79:51"},
		{"", ""},
		{"3C:7C:3F:79:79", ""},
		{"zz:7c:3f:79:79:51", ""},
		{"00:00:00:00:00:00", ""},
		{"ff:ff:ff:ff:ff:ff", ""}, // broadcast
		{"01:00:5e:00:00:01", ""}, // multicast
		{"02:50:f2:00:00:01", ""}, // administrado localmente (MAC aleatório/virtual)
	}
	for _, c := range casos {
		if got := normalizarMAC(c.bruto); got != c.esperado {
			t.Errorf("normalizarMAC(%q) = %q, esperado %q", c.bruto, got, c.esperado)
		}
	}
}

// TestEscolherMACDaPlacaMae_IgnoraVPNEUSBEPrefereCabo usa a lista real de
// adaptadores físicos da máquina que motivou a correção (Realtek integrada +
// TAP do OpenVPN), mais um dongle USB e um Wi-Fi PCI.
func TestEscolherMACDaPlacaMae_IgnoraVPNEUSBEPrefereCabo(t *testing.T) {
	adaptadores := []adaptadorDeRede{
		{Nome: "TAP-Windows Adapter V9", MAC: "00:FF:DC:4B:E9:80", PNPDeviceID: `ROOT\NET\0001`},
		{Nome: "Intel(R) Wi-Fi 6 AX201", MAC: "a4:b1:c1:00:00:01", PNPDeviceID: `PCI\VEN_8086&DEV_A0F0`},
		{Nome: "USB 2.0 Ethernet", MAC: "00:e0:4c:68:00:01", PNPDeviceID: `USB\VID_0BDA&PID_8152\000001`},
		{Nome: "Realtek Gaming 2.5GbE Family Controller", MAC: "3C:7C:3F:79:79:51", PNPDeviceID: `PCI\VEN_10EC&DEV_8125&SUBSYS_87D71043&REV_05\6&30A0F5B4&0&00480211`},
	}
	if got := escolherMACDaPlacaMae(adaptadores); got != "3c:7c:3f:79:79:51" {
		t.Errorf("escolherMACDaPlacaMae = %q, esperado o MAC da Realtek integrada", got)
	}
}

func TestEscolherMACDaPlacaMae_SoWiFiIntegradoAindaServe(t *testing.T) {
	adaptadores := []adaptadorDeRede{
		{Nome: "Intel(R) Wi-Fi 6 AX201", MAC: "a4:b1:c1:00:00:01", PNPDeviceID: `PCI\VEN_8086&DEV_A0F0`},
	}
	if got := escolherMACDaPlacaMae(adaptadores); got != "a4:b1:c1:00:00:01" {
		t.Errorf("escolherMACDaPlacaMae = %q, esperado o Wi-Fi integrado quando é a única placa PCI", got)
	}
}

func TestEscolherMACDaPlacaMae_NaoDependeDaOrdemDeEnumeracao(t *testing.T) {
	a := adaptadorDeRede{Nome: "Ethernet 1", MAC: "3c:7c:3f:00:00:02", PNPDeviceID: `PCI\VEN_10EC&DEV_8125\B`}
	b := adaptadorDeRede{Nome: "Ethernet 2", MAC: "3c:7c:3f:00:00:01", PNPDeviceID: `PCI\VEN_10EC&DEV_8125\A`}
	if escolherMACDaPlacaMae([]adaptadorDeRede{a, b}) != escolherMACDaPlacaMae([]adaptadorDeRede{b, a}) {
		t.Error("a escolha mudou com a ordem dos adaptadores")
	}
}

func TestEscolherMACDaPlacaMae_SemPlacaPCIDevolveVazio(t *testing.T) {
	adaptadores := []adaptadorDeRede{
		{Nome: "TAP-Windows Adapter V9", MAC: "00:FF:DC:4B:E9:80", PNPDeviceID: `ROOT\NET\0001`},
	}
	if got := escolherMACDaPlacaMae(adaptadores); got != "" {
		t.Errorf("escolherMACDaPlacaMae = %q, esperado vazio", got)
	}
}

func TestNormalizarUUIDDeHardware(t *testing.T) {
	casos := []struct {
		bruto, esperado string
	}{
		{"AC21CF1E-3811-02FB-792E-3C7C3F797951", "ac21cf1e-3811-02fb-792e-3c7c3f797951"},
		{"", ""},
		{"00000000-0000-0000-0000-000000000000", ""},
		{"FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF", ""},
		{"03000200-0400-0500-0006-000700080009", ""},
		{"AC21CF1E38110-2FB-792E-3C7C3F797951", ""},
		{"AC21CF1E-3811-02FB-792E-3C7C3F79795G", ""},
	}
	for _, c := range casos {
		if got := normalizarUUIDDeHardware(c.bruto); got != c.esperado {
			t.Errorf("normalizarUUIDDeHardware(%q) = %q, esperado %q", c.bruto, got, c.esperado)
		}
	}
}
