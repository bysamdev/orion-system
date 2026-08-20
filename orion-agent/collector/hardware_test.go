package collector

import (
	"encoding/json"
	"net"
	"os"
	"regexp"
	"runtime"
	"strings"
	"testing"
	"time"
)

// -----------------------------------------------------------------------------
// A) DETECÇÃO DE USUÁRIO E DOMÍNIO
//
// Correção A.13: Collect() passou a preferir a sessão de console ATIVA (via
// WTS — ver session_windows.go/usuarioDaSessaoAtiva) às variáveis de
// ambiente do processo. É isso que resolve corretamente o usuário quando o
// agente roda como serviço (NT SERVICE\OrionAgent, correção A.4): antes,
// os.Getenv("USERNAME") nesse contexto refletia a conta de serviço, não
// quem estava de fato logado na tela.
//
// Consequência para os testes: numa máquina com sessão interativa real
// (como esta, de desenvolvimento), USERDOMAIN/USERNAME deixam de ter efeito
// sobre Collect() — a cadeia de fallback baseada em env var só entra em
// jogo quando NÃO há sessão de console ativa para consultar (ex.: serviço
// rodando sem ninguém logado). Essa cadeia de fallback foi isolada em
// identidadeViaEnv (session.go) e é coberta exaustivamente, sem I/O de
// hardware nem dependência do estado da máquina real, em session_test.go —
// os antigos testes aqui (TestCollect_DeteccaoDeDominio_CadeiaDeFallback e
// TestCollect_DeteccaoDeUsuario_CadeiaDeFallback, que manipulavam env vars
// e esperavam vê-las refletidas em Collect()) ficaram obsoletos por essa
// mudança de precedência e foram substituídos pela verificação abaixo.
// -----------------------------------------------------------------------------

// coletaOuPula executa Collect() e falha o teste se a coleta retornar erro.
// A coleta é apenas de LEITURA do sistema — nenhum caminho real é escrito.
func coletaOuFalha(t *testing.T) *Payload {
	t.Helper()
	p, err := Collect()
	if err != nil {
		t.Fatalf("Collect() retornou erro inesperado neste ambiente: %v", err)
	}
	if p == nil {
		t.Fatal("Collect() retornou payload nil sem erro")
	}
	return p
}

// TestCollect_PreencheDominioEUsuario documenta que, com uma sessão de
// console ativa (o caso desta máquina de desenvolvimento), Collect() resolve
// Domain/CurrentUser via WTS — não fica vazio nem depende de env vars terem
// sido setadas manualmente. A cadeia de fallback em si (USERDOMAIN ->
// USERDNSDOMAIN -> WORKGROUP, USERNAME -> USER) é testada isoladamente em
// session_test.go, sem depender do estado desta máquina.
func TestCollect_PreencheDominioEUsuario(t *testing.T) {
	p := coletaOuFalha(t)

	if p.Domain == "" {
		t.Error("Domain vazio; esperado domínio/hostname resolvido via sessão de console ativa")
	}
	if p.CurrentUser == "" {
		t.Error("CurrentUser vazio; esperado usuário resolvido via sessão de console ativa")
	}
}

func TestCollect_SecurityInspection(t *testing.T) {
	p := coletaOuFalha(t)
	data, _ := json.MarshalIndent(map[string]any{
		"hostname":        p.Hostname,
		"ip":              p.IP,
		"mac_address":     p.MACAddress,
		"domain":          p.Domain,
		"user":            p.CurrentUser,
		"security":        p.Security,
		"remote_software": p.RemoteSoftware,
		"battery":         p.Battery,
		"update_status":   p.UpdateStatus,
	}, "", "  ")
	t.Logf("Collected Payload:\n%s", string(data))
}

// -----------------------------------------------------------------------------
// B) (removida — ver token/token_test.go)
//
// Esta seção continha os testes de Payload.GenerateToken(), removida na correção
// A.6/B.5: a identidade da máquina deixou de ser derivada de hardware
// (MachineUUID|Hostname|MACs — instável conforme o estado da rede, achado
// confirmado nesta mesma suíte, e não-secreta, achado de
// SECURITY-AUTO-PROVISIONING.md §1.2) e passou a ser um segredo aleatório gerado
// uma única vez e persistido. A cobertura equivalente agora vive em
// token.GenerateRandomIdentity (token/token_test.go): determinismo virou
// "unicidade entre gerações" e as antigas colisões por serialização ambígua
// deixaram de ser aplicáveis, porque não há mais concatenação de campos.
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// C) primaryIP() e diskRoot()
// -----------------------------------------------------------------------------

// TestDiskRoot_PorPlataforma garante a raiz correta por sistema operacional.
// Serve de regressão caso alguém troque o caminho ou remova o branch do Windows.
func TestDiskRoot_PorPlataforma(t *testing.T) {
	t.Parallel()

	raiz := diskRoot()

	if runtime.GOOS == "windows" {
		if raiz != "C:\\" {
			t.Errorf("diskRoot() = %q no Windows; esperado %q", raiz, "C:\\")
		}
	} else if raiz != "/" {
		t.Errorf("diskRoot() = %q em %s; esperado %q", raiz, runtime.GOOS, "/")
	}
}

// TestDiskRoot_CaminhoExisteNoSistema garante que a raiz devolvida é um diretório
// real e legível — só leitura, nada é escrito.
func TestDiskRoot_CaminhoExisteNoSistema(t *testing.T) {
	t.Parallel()

	info, err := os.Stat(diskRoot())
	if err != nil {
		t.Fatalf("diskRoot() = %q não é acessível: %v", diskRoot(), err)
	}
	if !info.IsDir() {
		t.Errorf("diskRoot() = %q não é um diretório", diskRoot())
	}
}

// TestDiskRoot_Determinismo garante que a função é pura (mesma saída sempre).
func TestDiskRoot_Determinismo(t *testing.T) {
	t.Parallel()

	primeiro := diskRoot()
	for i := 0; i < 10; i++ {
		if atual := diskRoot(); atual != primeiro {
			t.Fatalf("diskRoot() não é determinística: %q != %q", atual, primeiro)
		}
	}
}

// TestPrimaryIP_Determinismo garante que chamadas seguidas devolvem o mesmo IP
// (a rede não muda dentro da janela do teste).
func TestPrimaryIP_Determinismo(t *testing.T) {
	t.Parallel()

	primeiro := primaryIP()
	for i := 0; i < 5; i++ {
		if atual := primaryIP(); atual != primeiro {
			t.Fatalf("primaryIP() oscilou entre chamadas: %q != %q", atual, primeiro)
		}
	}
}

// TestPrimaryIP_FormatoEValidade garante o contrato da função: ou string vazia,
// ou um IPv4 válido, não-loopback, sem máscara de rede (sem "/").
func TestPrimaryIP_FormatoEValidade(t *testing.T) {
	t.Parallel()

	ipStr := primaryIP()
	if ipStr == "" {
		t.Skip("nenhuma interface de rede ativa não-loopback neste ambiente")
	}

	if strings.Contains(ipStr, "/") {
		t.Errorf("primaryIP() = %q contém máscara de rede; deveria devolver só o endereço", ipStr)
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		t.Fatalf("primaryIP() = %q não é um IP válido", ipStr)
	}
	if ip.To4() == nil {
		t.Errorf("primaryIP() = %q não é IPv4", ipStr)
	}
	if ip.IsLoopback() {
		t.Errorf("primaryIP() = %q é loopback e deveria ter sido ignorado", ipStr)
	}
	if ip.IsUnspecified() {
		t.Errorf("primaryIP() = %q é endereço não especificado", ipStr)
	}
}

// TestPrimaryIP_PertenceAUmaInterfaceAtiva garante que o IP devolvido realmente
// pertence a uma interface UP e não-loopback da máquina — pega o caso de a
// função passar a devolver um valor fabricado ou de outra interface.
func TestPrimaryIP_PertenceAUmaInterfaceAtiva(t *testing.T) {
	t.Parallel()

	ipStr := primaryIP()
	if ipStr == "" {
		t.Skip("nenhuma interface de rede ativa não-loopback neste ambiente")
	}

	ifaces, err := net.Interfaces()
	if err != nil {
		t.Skipf("não foi possível enumerar interfaces neste ambiente: %v", err)
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip4 := ip.To4(); ip4 != nil && ip4.String() == ipStr {
				return // encontrado: contrato satisfeito
			}
		}
	}

	t.Errorf("primaryIP() = %q não pertence a nenhuma interface ativa não-loopback", ipStr)
}

// TestCollect_IPEInterfacesConsistentes garante que o IP principal do payload é
// o mesmo devolvido por primaryIP() e que as interfaces coletadas estão ativas.
func TestCollect_IPEInterfacesConsistentes(t *testing.T) {
	p := coletaOuFalha(t)

	if p.IP != primaryIP() {
		t.Errorf("Payload.IP = %q diverge de primaryIP() = %q", p.IP, primaryIP())
	}
	if p.Hostname == "" {
		t.Error("Hostname vazio no payload coletado")
	}
	if p.OS == "" {
		t.Error("OS vazio no payload coletado (fallback para runtime.GOOS deveria cobrir)")
	}
	if p.RAMTotal == 0 {
		t.Error("RAMTotal = 0; a leitura de memória falhou silenciosamente")
	}
	if p.DiskTotal == 0 {
		t.Errorf("DiskTotal = 0 para a raiz %q", diskRoot())
	}
}

// -----------------------------------------------------------------------------
// D) modeloDaCPU() e primeiroIPv4NaoLoopback() — correção B.7
//
// Antes desta correção, Collect() chamava cpu.Info() (WMI) e net.Interfaces()
// duas vezes cada coleta, para dados que ou são estáticos (modelo da CPU) ou já
// tinham sido obtidos no mesmo ciclo (lista de interfaces). Medido em
// PERFORMANCE.md §3.1: ~44 ms + ~82 ms desperdiçados por coleta.
// -----------------------------------------------------------------------------

// TestModeloDaCPU_EhConsistenteEntreChamadas garante que múltiplas chamadas
// devolvem o mesmo valor — é o contrato externo do cache (sync.Once), já que
// não dá para observar de fora se cpu.Info() foi chamado 1 ou N vezes.
func TestModeloDaCPU_EhConsistenteEntreChamadas(t *testing.T) {
	primeiro := modeloDaCPU()
	for i := 0; i < 20; i++ {
		if atual := modeloDaCPU(); atual != primeiro {
			t.Fatalf("modeloDaCPU() não é estável: chamada %d devolveu %q, esperado %q", i, atual, primeiro)
		}
	}
}

// TestModeloDaCPU_ConcorrenciaSemPanic exercita o sync.Once em paralelo — não
// prova ausência de data race sozinho (esta máquina não tem toolchain C para
// -race, ver IMPROVEMENT_PLAN.md B.4), mas pelo menos garante que chamadas
// concorrentes não corrompem o valor cacheado nem entram em pânico.
func TestModeloDaCPU_ConcorrenciaSemPanic(t *testing.T) {
	const goroutines = 16
	resultados := make([]string, goroutines)
	done := make(chan int, goroutines)

	for i := 0; i < goroutines; i++ {
		go func(idx int) {
			resultados[idx] = modeloDaCPU()
			done <- idx
		}(i)
	}
	for i := 0; i < goroutines; i++ {
		<-done
	}

	esperado := resultados[0]
	for i, r := range resultados {
		if r != esperado {
			t.Errorf("goroutine %d obteve %q, esperado %q (todas deveriam ver o mesmo valor cacheado)", i, r, esperado)
		}
	}
}

// TestPrimeiroIPv4NaoLoopback_ListaVaziaRetornaVazio cobre o caminho seguro
// com entrada vazia — não é possível construir net.Interface sintéticas com
// endereços fake sem uma abstração sobre Addrs() (método, não campo, resolvido
// via consulta ao SO pelo índice da interface), então a cobertura de
// filtragem por IP real já é feita indiretamente por
// TestCollect_IPEInterfacesConsistentes e TestPrimaryIP_FormatoEValidade.
func TestPrimeiroIPv4NaoLoopback_ListaVaziaRetornaVazio(t *testing.T) {
	if got := primeiroIPv4NaoLoopback(nil); got != "" {
		t.Errorf("primeiroIPv4NaoLoopback(nil) = %q, esperado \"\"", got)
	}
	if got := primeiroIPv4NaoLoopback([]net.Interface{}); got != "" {
		t.Errorf("primeiroIPv4NaoLoopback([]) = %q, esperado \"\"", got)
	}
}

// TestPrimaryIPEPrimeiroIPv4NaoLoopback_Concordam garante que os dois caminhos
// de código (primaryIP, que faz sua própria net.Interfaces(), e a extração
// usada por Collect() a partir de um snapshot já obtido) continuam
// concordando após a refatoração do B.7.
func TestPrimaryIPEPrimeiroIPv4NaoLoopback_Concordam(t *testing.T) {
	ifaces, err := net.Interfaces()
	if err != nil {
		t.Skipf("não foi possível enumerar interfaces neste ambiente: %v", err)
	}

	viaSnapshot := primeiroIPv4NaoLoopback(ifaces)
	viaPrimaryIP := primaryIP()

	if viaSnapshot != viaPrimaryIP {
		t.Errorf("primeiroIPv4NaoLoopback(snapshot) = %q diverge de primaryIP() = %q", viaSnapshot, viaPrimaryIP)
	}
}

// -----------------------------------------------------------------------------
// E) Collect() não pode mais bloquear por 1s — correção B.6
// -----------------------------------------------------------------------------

// TestCollect_NaoBloqueiaPorUmSegundo é o teste de regressão da correção B.6:
// antes, cpu.Percent(1*time.Second, false) sozinho já garantia que Collect()
// nunca terminava em menos de 1s (medido em PERFORMANCE.md §3.1: 1,0s de 1,13s
// de tempo de parede total, 88,7%). Com cpu.Percent(0, false) (não-bloqueante),
// uma coleta completa — incluindo host.Info, disco, rede — deveria terminar bem
// abaixo de 1s. O teto de 500ms dá margem para máquinas mais lentas sem deixar
// passar uma reintrodução do bloqueio de 1s.
func TestCollect_NaoBloqueiaPorUmSegundo(t *testing.T) {
	inicio := time.Now()
	if _, err := Collect(); err != nil {
		t.Skipf("Collect() indisponível neste ambiente: %v", err)
	}
	decorrido := time.Since(inicio)

	const teto = 500 * time.Millisecond
	if decorrido >= teto {
		t.Errorf("Collect() levou %v — esperado bem abaixo de %v; "+
			"possível regressão para cpu.Percent(1*time.Second, false) bloqueante (ver B.6)", decorrido, teto)
	}
}

// -----------------------------------------------------------------------------
// F) device_type e mac_address — campos novos para a tela de Inventário de
// Dispositivos (estilo Milvus). A lógica de detecção em si é específica por
// plataforma (device_type_windows.go/device_type_other.go) e coberta à parte
// nos arquivos *_test.go correspondentes; aqui verificamos só o contrato
// exposto por Collect(): os campos existem, têm formato válido e são
// consistentes com as funções que os alimentam.
// -----------------------------------------------------------------------------

var regexMACValido = regexp.MustCompile(`^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$`)

// TestCollect_DeviceTypeEhUmValorValido garante que Collect() só devolve um
// dos três valores que a tela de inventário (useDeviceInventory.ts,
// resolveDeviceType) e a coluna machines.device_type sabem interpretar —
// qualquer string fora desse conjunto cairia como "desconhecido" no
// frontend ou seria normalizada silenciosamente para "desktop" no backend
// (lib.UpsertMachine).
func TestCollect_DeviceTypeEhUmValorValido(t *testing.T) {
	p := coletaOuFalha(t)

	switch p.DeviceType {
	case "desktop", "notebook", "server":
	default:
		t.Errorf("Payload.DeviceType = %q; esperado um de \"desktop\", \"notebook\" ou \"server\"", p.DeviceType)
	}
}

// TestCollect_DeviceTypeConcordaComTipoDoDispositivo garante que Collect()
// não tem seu próprio caminho de decisão paralelo — ele sempre reflete o
// mesmo valor cacheado que tipoDoDispositivo() devolve.
func TestCollect_DeviceTypeConcordaComTipoDoDispositivo(t *testing.T) {
	p := coletaOuFalha(t)

	if p.DeviceType != tipoDoDispositivo() {
		t.Errorf("Payload.DeviceType = %q diverge de tipoDoDispositivo() = %q", p.DeviceType, tipoDoDispositivo())
	}
}

// TestTipoDoDispositivo_EhConsistenteEntreChamadas espelha
// TestModeloDaCPU_EhConsistenteEntreChamadas: é o contrato externo do cache
// (sync.Once) em device_type.go — não dá para observar de fora se
// detectarTipoDispositivo() foi chamada 1 ou N vezes, só que o resultado não
// muda.
func TestTipoDoDispositivo_EhConsistenteEntreChamadas(t *testing.T) {
	primeiro := tipoDoDispositivo()
	for i := 0; i < 20; i++ {
		if atual := tipoDoDispositivo(); atual != primeiro {
			t.Fatalf("tipoDoDispositivo() não é estável: chamada %d devolveu %q, esperado %q", i, atual, primeiro)
		}
	}
}

// TestCollect_MacAddressFormatoValido garante que, quando preenchido,
// MACAddress segue o formato AA:BB:CC:DD:EE:FF (contrato de
// net.HardwareAddr.String() para Ethernet/Wi-Fi) — string vazia é aceitável
// e esperada em ambientes sem interface física ativa (mesmo critério de
// TestPrimaryIP_FormatoEValidade para o IP).
func TestCollect_MacAddressFormatoValido(t *testing.T) {
	p := coletaOuFalha(t)

	if p.MACAddress == "" {
		t.Skip("nenhuma interface de rede ativa não-loopback neste ambiente")
	}
	if !regexMACValido.MatchString(p.MACAddress) {
		t.Errorf("Payload.MACAddress = %q não está no formato AA:BB:CC:DD:EE:FF", p.MACAddress)
	}
}

// TestCollect_MacAddressPertenceAInterfaceDoIPPrincipal garante que o MAC
// devolvido é realmente o da MESMA interface que forneceu o IP principal —
// não o de uma interface física qualquer da máquina. Comparação feita
// consultando net.Interfaces() de novo (independente da varredura interna de
// Collect()), como já fazem os testes de primaryIP().
func TestCollect_MacAddressPertenceAInterfaceDoIPPrincipal(t *testing.T) {
	p := coletaOuFalha(t)

	if p.IP == "" {
		t.Skip("nenhum IP principal resolvido neste ambiente")
	}

	ifaces, err := net.Interfaces()
	if err != nil {
		t.Skipf("não foi possível enumerar interfaces neste ambiente: %v", err)
	}

	for _, iface := range ifaces {
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip4 := ip.To4(); ip4 != nil && ip4.String() == p.IP {
				if got := iface.HardwareAddr.String(); got != p.MACAddress {
					t.Errorf("Payload.MACAddress = %q; interface %q dona do IP %q tem MAC %q", p.MACAddress, iface.Name, p.IP, got)
				}
				return
			}
		}
	}
	t.Errorf("nenhuma interface encontrada com o IP %q reportado em Payload.IP", p.IP)
}

func TestPayloadJSONTagsExactas(t *testing.T) {
	p := &Payload{
		MachineToken: "tok-123",
		MachineUUID:  "uuid-456",
		Hostname:     "host-test",
		IP:           "192.168.1.100",
		OS:           "windows",
		OSVersion:    "11.0",
		Domain:       "ORION.LOCAL",
		CurrentUser:  `ORION\suporte`,
		MACAddress:   "00:11:22:33:44:55",
		DeviceType:   "desktop",
		AgentVersion: "1.2.0",
		Security: SecurityInfo{
			Antivirus: []AntivirusInfo{
				{Name: "Defender", Active: true},
			},
			FirewallActive:  true,
			BitLocker:       []BitLockerInfo{{Mount: "C:", Status: "Protected", Active: true}},
			BitLockerActive: true,
		},
		RemoteSoftware: []RemoteSoftwareInfo{
			{Name: "AnyDesk", Version: "8.0", IsRunning: true},
		},
		Battery: BatteryInfo{
			HasBattery: true,
			Percent:    95,
			PluggedIn:  true,
			Status:     "Charging",
		},
		UpdateStatus: UpdateStatus{
			RebootRequired: false,
		},
	}

	data, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("Marshal falhou: %v", err)
	}

	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("Unmarshal raw falhou: %v", err)
	}

	// Verifica tags do topo
	chavesObrigatorias := []string{"domain", "current_user", "ip", "mac_address", "hostname", "security", "remote_software", "battery", "update_status"}
	for _, k := range chavesObrigatorias {
		if _, ok := raw[k]; !ok {
			t.Errorf("Campo obrigatório %q ausente no JSON do Payload", k)
		}
	}

	// Verifica security
	sec, ok := raw["security"].(map[string]any)
	if !ok {
		t.Fatalf("security não é um objeto JSON: %v", raw["security"])
	}
	if _, ok := sec["antivirus"]; !ok {
		t.Errorf("security.antivirus ausente")
	}
	if _, ok := sec["firewall_active"]; !ok {
		t.Errorf("security.firewall_active ausente")
	}
	if _, ok := sec["bitlocker"]; !ok {
		t.Errorf("security.bitlocker ausente")
	}

	// Verifica remote_software
	rem, ok := raw["remote_software"].([]any)
	if !ok || len(rem) == 0 {
		t.Fatalf("remote_software inválido ou vazio: %v", raw["remote_software"])
	}
	rem0 := rem[0].(map[string]any)
	if _, ok := rem0["name"]; !ok {
		t.Errorf("remote_software[0].name ausente")
	}
	if _, ok := rem0["version"]; !ok {
		t.Errorf("remote_software[0].version ausente")
	}
	if _, ok := rem0["is_running"]; !ok {
		t.Errorf("remote_software[0].is_running ausente")
	}

	// Verifica battery
	bat, ok := raw["battery"].(map[string]any)
	if !ok {
		t.Fatalf("battery não é um objeto JSON: %v", raw["battery"])
	}
	if _, ok := bat["has_battery"]; !ok {
		t.Errorf("battery.has_battery ausente")
	}
	if _, ok := bat["percent"]; !ok {
		t.Errorf("battery.percent ausente")
	}
	if _, ok := bat["plugged_in"]; !ok {
		t.Errorf("battery.plugged_in ausente")
	}

	// Verifica update_status
	upd, ok := raw["update_status"].(map[string]any)
	if !ok {
		t.Fatalf("update_status não é um objeto JSON: %v", raw["update_status"])
	}
	if _, ok := upd["reboot_required"]; !ok {
		t.Errorf("update_status.reboot_required ausente")
	}
}
