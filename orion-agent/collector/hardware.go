package collector

import (
	"context"
	"fmt"
	"net"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

// tempoLimiteDisco é o prazo máximo para a varredura de partições. Existe para que
// uma unidade de rede offline não congele a coleta — e, por consequência, o agente
// inteiro — indefinidamente.
const tempoLimiteDisco = 3 * time.Second

// NetworkInterface representa um adaptador de rede físico ou virtual.
type NetworkInterface struct {
	Name string   `json:"name"`
	MAC  string   `json:"mac"`
	IPs  []string `json:"ips"`
}

// DiskInfo detalha uma partição ou unidade de armazenamento detectada.
type DiskInfo struct {
	Device     string `json:"device"`
	Mountpoint string `json:"mountpoint"`
	FSType     string `json:"fs_type"`
	Total      uint64 `json:"total"`
	Used       uint64 `json:"used"`
	// MediaType é "SSD", "HD" ou "" (desconhecido — unidade de rede, disco
	// virtual, ou o WMI não conseguiu associar a letra a um disco físico).
	// Resolvido via coletarTiposDeMidiaPorLetra (MSFT_PhysicalDisk, a mesma
	// classe que o próprio Windows usa em Otimizar Unidades) — não é
	// FSType: NTFS/exFAT/etc é o SISTEMA DE ARQUIVOS, tipo de mídia é o
	// HARDWARE por baixo, os dois são independentes.
	MediaType string `json:"media_type"`
}

// AntivirusInfo representa um software antivírus detectado no sistema.
type AntivirusInfo struct {
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

// BitLockerInfo representa o estado de proteção de um volume de disco.
type BitLockerInfo struct {
	Mount  string `json:"mount"`
	Status string `json:"status"`
	Active bool   `json:"active"`
}

// SecurityInfo agrupa dados de conformidade de segurança (AV, Firewall, BitLocker).
type SecurityInfo struct {
	Antivirus       []AntivirusInfo `json:"antivirus"`
	FirewallActive  bool            `json:"firewall_active"`
	BitLocker       []BitLockerInfo `json:"bitlocker"`
	BitLockerActive bool            `json:"bitlocker_active"`
}

// RemoteSoftwareInfo representa ferramentas de acesso remoto conhecidas instaladas ou em execução.
type RemoteSoftwareInfo struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	IsRunning bool   `json:"is_running"`
}

// BatteryInfo detalha a presença, percentual de carga e status de tomada/alimentação.
type BatteryInfo struct {
	HasBattery bool   `json:"has_battery"`
	Percent    int    `json:"percent"`
	PluggedIn  bool   `json:"plugged_in"`
	Status     string `json:"status"`
}

// UpdateStatus informa se há reinicialização pendente decorrente de atualizações do sistema operacional.
type UpdateStatus struct {
	RebootRequired bool `json:"reboot_required"`
}

// ActivationInfo informa se a licença do Windows está ativada e em que estado.
type ActivationInfo struct {
	Activated bool   `json:"activated"`
	Status    string `json:"status"`
}

// Payload é o corpo principal do "Check-in" enviado ao servidor Orion.
// Contém o estado atual completo da saúde do hardware.
type Payload struct {
	MachineToken   string             `json:"machine_token"`
	MachineUUID    string             `json:"machine_uuid"`
	Hostname       string             `json:"hostname"`
	IP             string             `json:"ip"`
	OS             string             `json:"os"`
	OSVersion      string             `json:"os_version"`
	CPUUsage       float64            `json:"cpu_usage"`
	RAMTotal       uint64             `json:"ram_total"`
	RAMUsed        uint64             `json:"ram_used"`
	DiskTotal      uint64             `json:"disk_total"`
	DiskUsed       uint64             `json:"disk_used"`
	Uptime         uint64             `json:"uptime"`
	CPUModel       string             `json:"cpu_model"`
	GPU            string             `json:"gpu"` // Campo reservado para expansão futura
	Disks          []DiskInfo         `json:"disks"`
	Interfaces     []NetworkInterface `json:"interfaces"`
	Domain         string             `json:"domain"`
	CurrentUser    string             `json:"current_user"`
	CurrentUserSID string             `json:"current_user_sid"`
	MACAddress     string             `json:"mac_address"`
	DeviceType     string             `json:"device_type"`
	// DeviceTypeReason documenta qual sinal decidiu DeviceType (Fase 3 do
	// plano de escalabilidade) — ver tipoEMotivoDoDispositivo().
	DeviceTypeReason string `json:"device_type_reason"`
	// IdentityFallbackReason nunca é enviado ao backend (json:"-") — é
	// diagnóstico puramente local para a camada de serviço logar quando
	// resolverIdentidadeDoUsuario() não conseguiu consultar a sessão de
	// console ativa via WTS e caiu para variáveis de ambiente do processo
	// (o que, rodando como serviço, reporta a conta de serviço em vez de
	// quem está de fato logado na tela — ver session.go).
	IdentityFallbackReason string `json:"-"`
	// AgentVersion não é preenchida aqui: Collect() só lê o estado do
	// sistema, e a versão do binário é responsabilidade da camada de
	// serviço (mesmo motivo de MachineToken ficar de fora — ver
	// service/windows.go tick() e version.Version).
	AgentVersion string `json:"agent_version"`

	// Novos módulos de coleta avançada
	Security       SecurityInfo         `json:"security"`
	RemoteSoftware []RemoteSoftwareInfo `json:"remote_software"`
	Battery        BatteryInfo          `json:"battery"`
	UpdateStatus   UpdateStatus         `json:"update_status"`
	Activation     ActivationInfo       `json:"activation"`
}

// HardwarePayload é um alias semântico para Payload.
type HardwarePayload = Payload

// diskRoot define qual o caminho raiz para medição de disco principal (C: no Windows).
func diskRoot() string {
	if runtime.GOOS == "windows" {
		return "C:\\"
	}
	return "/"
}

// primaryIP tenta identificar o IP principal da máquina (ignora loopback).
//
// Faz sua própria chamada a net.Interfaces() — mantido assim para não quebrar
// quem chama esta função isoladamente (inclusive os testes). Collect() NÃO usa
// esta função: para evitar enumerar as interfaces de rede duas vezes por
// coleta (medido em ~82 ms, quase 65 % do tempo de CPU real de uma coleta —
// ver PERFORMANCE.md §3.1), Collect() faz uma única chamada a net.Interfaces()
// e deriva tanto a lista de interfaces quanto o IP principal do mesmo
// snapshot, via primeiroIPv4NaoLoopback.
func primaryIP() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	return primeiroIPv4NaoLoopback(ifaces)
}

// primeiroIPv4NaoLoopback varre um snapshot já obtido de interfaces e devolve
// o primeiro endereço IPv4 não-loopback de uma interface ativa. Extraída de
// primaryIP para que Collect() possa reusar um único net.Interfaces().
//
// Delega para primeiroIPv4EMacNaoLoopback só para não duplicar o critério de
// varredura em dois lugares — mantida como função própria porque
// primaryIP() e os testes existentes (hardware_test.go) só precisam do IP.
func primeiroIPv4NaoLoopback(ifaces []net.Interface) string {
	ip, _ := primeiroIPv4EMacNaoLoopback(ifaces)
	return ip
}

// isVirtualInterface verifica se a interface é um adaptador virtual conhecido (Hyper-V, WSL, VirtualBox, VMware, Docker, VPN, etc.)
//
// O nome sozinho não basta: adaptadores como o host-only do VirtualBox se
// chamam apenas "Ethernet 2" no Windows. Por isso interfaceVirtual() combina
// esta checagem por nome com a checagem por OUI do MAC.
func isVirtualInterface(name string) bool {
	low := strings.ToLower(name)
	virtualKeywords := []string{
		"vethernet", "hyper-v", "wsl", "virtual", "vbox", "vmware",
		"docker", "tailscale", "zerotier", "tap", "wintun", "tunnel",
		"bluetooth", "pseudo", "loopback", "npcap", "teredo", "isatap",
		// VPNs de acesso remoto: entregam um IP de overlay que não pertence
		// à LAN onde a máquina está fisicamente ligada (ex.: Radmin VPN em
		// 26.0.0.0/8), e por isso não podem ser a fonte do IP interno.
		"vpn", "radmin", "hamachi", "openvpn", "wireguard", "nordlynx",
		"anydesk", "softether", "zscaler", "forticlient", "pangp", "juniper",
	}
	for _, kw := range virtualKeywords {
		if strings.Contains(low, kw) {
			return true
		}
	}
	return false
}

// ouisVirtuais lista os prefixos de MAC (OUI) reservados por hipervisores e
// adaptadores virtuais. Pega os casos em que o nome da interface não denuncia
// nada — o host-only do VirtualBox aparece como "Ethernet 2", por exemplo.
var ouisVirtuais = []string{
	"00:15:5d", // Hyper-V
	"0a:00:27", // VirtualBox host-only
	"08:00:27", // VirtualBox NAT/bridge
	"00:50:56", // VMware
	"00:0c:29", // VMware
	"00:05:69", // VMware
	"00:1c:14", // VMware
	"00:03:ff", // Microsoft Virtual PC
	"02:50:90", // Radmin VPN (MAC administrado localmente)
	"00:ff",    // adaptadores TAP/tunnel da Microsoft
}

// interfaceVirtual decide se um adaptador é virtual olhando nome E MAC.
func interfaceVirtual(iface net.Interface) bool {
	if isVirtualInterface(iface.Name) {
		return true
	}
	mac := strings.ToLower(iface.HardwareAddr.String())
	if mac == "" {
		return false
	}
	for _, oui := range ouisVirtuais {
		if strings.HasPrefix(mac, oui) {
			return true
		}
	}
	// Bit "locally administered" (segundo bit menos significativo do primeiro
	// octeto) ligado: MAC sintetizado por software, não gravado em NIC física.
	if len(iface.HardwareAddr) > 0 && iface.HardwareAddr[0]&0x02 != 0 {
		return true
	}
	return false
}

// redesOverlay são faixas usadas por VPNs peer-to-peer e CGNAT. Um endereço
// aqui nunca é o IP da LAN interna da máquina, mesmo quando chega por uma
// interface que passou pelos filtros acima.
var redesOverlay = []net.IPNet{
	{IP: net.IPv4(25, 0, 0, 0), Mask: net.CIDRMask(8, 32)},     // Hamachi
	{IP: net.IPv4(26, 0, 0, 0), Mask: net.CIDRMask(8, 32)},     // Radmin VPN
	{IP: net.IPv4(100, 64, 0, 0), Mask: net.CIDRMask(10, 32)},  // CGNAT / Tailscale
	{IP: net.IPv4(169, 254, 0, 0), Mask: net.CIDRMask(16, 32)}, // APIPA (link-local)
}

// ipInternoValido aceita só IPv4 que pode ser o endereço da rede interna:
// descarta loopback, link-local e as faixas de overlay/CGNAT.
func ipInternoValido(ip net.IP) bool {
	ip4 := ip.To4()
	if ip4 == nil || ip4.IsLoopback() || ip4.IsUnspecified() || ip4.IsLinkLocalUnicast() {
		return false
	}
	for _, rede := range redesOverlay {
		if rede.Contains(ip4) {
			return false
		}
	}
	return true
}

// ipv4DaInterface devolve os IPv4 configurados numa interface.
func ipv4DaInterface(iface net.Interface) []net.IP {
	addrs, _ := iface.Addrs()
	var ips []net.IP
	for _, addr := range addrs {
		var addrIP net.IP
		switch v := addr.(type) {
		case *net.IPNet:
			addrIP = v.IP
		case *net.IPAddr:
			addrIP = v.IP
		}
		if ip4 := addrIP.To4(); ip4 != nil {
			ips = append(ips, ip4)
		}
	}
	return ips
}

// interfaceAtiva descarta interfaces desligadas e a loopback.
func interfaceAtiva(iface net.Interface) bool {
	return iface.Flags&net.FlagUp != 0 && iface.Flags&net.FlagLoopback == 0
}

// primeiroIPv4EMacNaoLoopback varre um snapshot de interfaces e devolve, de
// uma vez só, o IPv4 da LAN interna onde a máquina está ligada E o MAC da
// interface física que o carrega.
//
// A ordem de preferência resolve dois problemas ao mesmo tempo. Primeiro, a
// máquina com Wi-Fi e cabo ligados ao mesmo tempo deve reportar a placa que
// está realmente carregando o tráfego, não a que aparecer primeiro na
// enumeração. Segundo, o IP da rota default nem sempre é o da rede interna:
// com Radmin VPN, Hamachi ou WireGuard ligados a rota sai pelo túnel e o
// endereço de overlay (ex.: 26.140.184.83) não diz nada sobre a LAN onde o
// equipamento está. Daí:
//
//  1. rota de saída em uso (UDP dial), aceita só se a placa dona for física;
//  2. interface física com IP privado RFC1918 (VPN dona da rota default);
//  3. qualquer interface física com IPv4 utilizável;
//  4. último recurso: qualquer interface ativa, inclusive virtual.
func primeiroIPv4EMacNaoLoopback(ifaces []net.Interface) (ip, mac string) {
	if len(ifaces) == 0 {
		return "", ""
	}

	// 1. Placa que está em uso agora, descoberta pela rota de saída via UDP
	//    dial (não gera tráfego). Só vale se a interface dona for física —
	//    senão estaríamos reportando o endereço do túnel da VPN.
	conn, err := net.DialTimeout("udp", "8.8.8.8:80", 200*time.Millisecond)
	if err == nil {
		localAddr, ok := conn.LocalAddr().(*net.UDPAddr)
		conn.Close()
		if ok && localAddr.IP != nil {
			if outboundIP := localAddr.IP.To4(); outboundIP != nil && ipInternoValido(outboundIP) {
				for _, iface := range ifaces {
					if !interfaceAtiva(iface) || interfaceVirtual(iface) {
						continue
					}
					for _, ip4 := range ipv4DaInterface(iface) {
						if ip4.Equal(outboundIP) {
							return outboundIP.String(), iface.HardwareAddr.String()
						}
					}
				}
			}
		}
	}

	// 2. A rota default não serviu (VPN ligada, ou máquina sem internet):
	//    cai para a primeira placa física com endereço privado RFC1918.
	for _, iface := range ifaces {
		if !interfaceAtiva(iface) || interfaceVirtual(iface) {
			continue
		}
		for _, ip4 := range ipv4DaInterface(iface) {
			if ip4.IsPrivate() && ipInternoValido(ip4) {
				return ip4.String(), iface.HardwareAddr.String()
			}
		}
	}

	// 3. Qualquer interface física com IPv4 utilizável (IP público direto na
	//    NIC, por exemplo — servidor sem NAT).
	for _, iface := range ifaces {
		if !interfaceAtiva(iface) || interfaceVirtual(iface) {
			continue
		}
		for _, ip4 := range ipv4DaInterface(iface) {
			if !ipInternoValido(ip4) {
				continue
			}
			candidateIP := ip4.String()
			if candidateMac := iface.HardwareAddr.String(); candidateMac != "" {
				return candidateIP, candidateMac
			}
			if ip == "" {
				ip = candidateIP
			}
		}
	}

	// 4. Último recurso: máquina só com adaptadores virtuais ativos. Melhor
	//    reportar o IP do túnel do que não reportar nada.
	if ip == "" || mac == "" {
		for _, iface := range ifaces {
			if !interfaceAtiva(iface) {
				continue
			}
			for _, ip4 := range ipv4DaInterface(iface) {
				if ip4.IsLoopback() {
					continue
				}
				if ip == "" {
					ip = ip4.String()
				}
				if mac == "" {
					mac = iface.HardwareAddr.String()
				}
				if ip != "" && mac != "" {
					return ip, mac
				}
			}
		}
	}

	if mac == "" {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagLoopback == 0 && len(iface.HardwareAddr) > 0 {
				mac = iface.HardwareAddr.String()
				break
			}
		}
	}
	return ip, mac
}

// cpuModelUmaVez cacheia o modelo do processador (cpu.Info) — dado estático
// que não muda durante a vida do processo. Antes desta correção, Collect()
// consultava cpu.Info() (WMI, ~44 ms medidos) a cada coleta, para um valor
// que nunca varia. Ver PERFORMANCE.md §3.1/O3.
var (
	cpuModelUmaVez sync.Once
	cpuModelCache  string
)

func modeloDaCPU() string {
	cpuModelUmaVez.Do(func() {
		cpuInfos, err := cpu.Info()
		if err == nil && len(cpuInfos) > 0 {
			cpuModelCache = strings.TrimSpace(cpuInfos[0].ModelName)
		}
	})
	return cpuModelCache
}

// Collect faz uma varredura completa no sistema para extrair métricas de hardware atuais.
func Collect() (*Payload, error) {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = os.Getenv("COMPUTERNAME")
		if hostname == "" {
			hostname = os.Getenv("HOSTNAME")
		}
		if hostname == "" {
			hostname = "unknown-host"
		}
	}

	// 1. Dados Básicos do Host (Sistema Operacional, Versão e Tempo de Atividade)
	hi, err := host.Info()
	if err != nil {
		return nil, fmt.Errorf("Erro ao ler informações do host: %w", err)
	}

	// 2. Uso de CPU — não-bloqueante (correção B.6)
	//
	// MUDANÇA DE SEMÂNTICA DA MÉTRICA cpu_usage, documentada aqui de propósito:
	// cpu.Percent(1*time.Second, false) bloqueava Collect() por 1s inteiro a cada
	// coleta — medido em PERFORMANCE.md §3.1 como 88,7% do tempo de parede de uma
	// coleta (1,0s de 1,13s total), sem consumir CPU real (é um time.Sleep interno
	// do gopsutil, não trabalho de CPU). Com interval(0, false), o gopsutil calcula
	// o percentual desde a ÚLTIMA chamada a cpu.Percent neste processo (estado
	// interno do próprio pacote gopsutil, não gerenciado por nós) — não-bloqueante,
	// e com o intervalo de heartbeat em produção (30s/agent.yaml), o valor reportado
	// passa a ser a média do INTERVALO INTEIRO entre heartbeats, em vez de uma
	// amostra instantânea de 1s a cada 30s.
	//
	// Isso é estritamente melhor para tendência/alerta (uma janela de 30s é mais
	// representativa que 1s a cada 30s), mas os dois regimes não são diretamente
	// comparáveis ponto a ponto — um histórico antigo (amostra de 1s) não deve ser
	// comparado lado a lado com o novo (média de 30s) sem essa ressalva. O único
	// consumidor server-side hoje é o alerta de CPU > 85% (lib/monitoring.go,
	// CriticalAlerts) — o alerta continua funcionando com o novo valor, só passa a
	// reagir a uma média de janela maior em vez de um pico instantâneo de 1s.
	//
	// PRIMEIRA CHAMADA DO PROCESSO: sem uma amostra anterior, o gopsutil calcula o
	// percentual desde o boot do sistema (não desde o início do processo do
	// agente) — um valor menos representativo, mas inofensivo: autocorrige no
	// próximo heartbeat, 30s depois, quando já existe uma amostra anterior deste
	// mesmo processo para comparar.
	cpuPcts, err := cpu.Percent(0, false)
	var cpuUsage float64
	if err == nil && len(cpuPcts) > 0 {
		cpuUsage = cpuPcts[0]
	}

	// 3. Modelo do Processador (cacheado — é estático, ver modeloDaCPU)
	cpuModel := modeloDaCPU()

	// 4. Memória RAM (Total vs Usada)
	vm, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("Erro ao ler memória RAM: %w", err)
	}

	// 5. Uso do Disco Principal (Partição do Sistema)
	du, err := disk.Usage(diskRoot())
	if err != nil {
		return nil, fmt.Errorf("Erro ao ler disco principal: %w", err)
	}

	// 6. Lista Geral de Discos e Partições (paralelo, com prazo máximo)
	//
	// disk.Partitions inclui unidades de rede mapeadas. Se um compartilhamento SMB
	// estiver fora do ar, disk.Usage naquele mountpoint pode bloquear indefinidamente:
	// sem prazo, o wg.Wait() abaixo nunca retornava, Collect() nunca terminava e o
	// agente parava de enviar heartbeat em silêncio, com as goroutines vazadas.
	var disks []DiskInfo
	parts, err := disk.Partitions(false)
	if err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), tempoLimiteDisco)
		defer cancel()

		// Uma única consulta WMI pra todas as letras de unidade — não uma
		// por partição dentro do loop abaixo, que rodaria em paralelo e
		// multiplicaria round-trips ao WMI à toa pro mesmo resultado.
		tiposDeMidia := coletarTiposDeMidiaPorLetra()

		var (
			wg sync.WaitGroup
			mu sync.Mutex
		)
		for _, p := range parts {
			p := p // captura da variável de loop
			wg.Add(1)
			go func() {
				defer wg.Done()
				d, err := disk.UsageWithContext(ctx, p.Mountpoint)
				if err == nil {
					mu.Lock()
					disks = append(disks, DiskInfo{
						Device:     p.Device,
						Mountpoint: p.Mountpoint,
						FSType:     p.Fstype,
						MediaType:  tiposDeMidia[p.Device],
						Total:      d.Total,
						Used:       d.Used,
					})
					mu.Unlock()
				}
			}()
		}

		// Espera limitada: se o prazo estourar, seguimos com as partições que já
		// responderam em vez de travar a coleta inteira. As goroutines restantes
		// observam o cancelamento do contexto e terminam sozinhas.
		concluido := make(chan struct{})
		go func() {
			wg.Wait()
			close(concluido)
		}()

		select {
		case <-concluido:
		case <-ctx.Done():
		}

		// Cópia sob o mesmo mutex das goroutines: em caso de timeout ainda pode haver
		// escrita concorrente em `disks`, então não podemos ler a slice diretamente.
		mu.Lock()
		parciais := make([]DiskInfo, len(disks))
		copy(parciais, disks)
		mu.Unlock()
		disks = parciais
	}

	// 7. Adaptadores de Rede e Endereços IP
	//
	// Uma única chamada a net.Interfaces() alimenta tanto a lista de interfaces
	// abaixo quanto o IP principal (ip, calculado logo adiante) — antes eram duas
	// chamadas separadas (aqui e dentro de primaryIP()), medidas em ~82 ms cada
	// coleta. Ver primeiroIPv4NaoLoopback.
	var interfaces []NetworkInterface
	var ip, macAddress string
	ifaces, err := net.Interfaces()
	if err == nil {
		ip, macAddress = primeiroIPv4EMacNaoLoopback(ifaces)
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp == 0 {
				continue
			}
			addrs, _ := iface.Addrs()
			var ips []string
			for _, addr := range addrs {
				ips = append(ips, addr.String())
			}
			interfaces = append(interfaces, NetworkInterface{
				Name: iface.Name,
				MAC:  iface.HardwareAddr.String(),
				IPs:  ips,
			})
		}
	}

	// Fallback para garantir IP e MACAddress caso a varredura primária não encontre
	if ip == "" {
		ip = primaryIP()
		if ip == "" {
			ip = "127.0.0.1"
		}
	}
	if macAddress == "" && len(interfaces) > 0 {
		for _, iface := range interfaces {
			if iface.MAC != "" {
				macAddress = iface.MAC
				break
			}
		}
	}

	osName := hi.OS
	if osName == "" {
		osName = runtime.GOOS
	}

	// 8/9. Domínio, usuário e SID (correção A.13) da sessão de console ativa.
	// Preferimos a sessão interativa via WTS a os.Getenv: rodando como
	// serviço (NT SERVICE\OrionAgent, ver A.4), as variáveis de ambiente do
	// processo são as da conta de serviço, não as de quem está logado na
	// tela — resolverIdentidadeDoUsuario cai para elas apenas quando não há
	// sessão de console ativa para consultar (ex.: tela de logon, ou
	// plataforma não-Windows).
	domain, currentUser, currentUserSID, identidadeFallbackMotivo := resolverIdentidadeDoUsuario()
	fallbackReason := ""
	if identidadeFallbackMotivo != nil {
		fallbackReason = identidadeFallbackMotivo.Error()
	}
	deviceType, deviceTypeReason := tipoEMotivoDoDispositivo()

	// Montamos o relatório final (Payload)
	return &Payload{
		MachineUUID:            hi.HostID,
		Hostname:               hostname,
		IP:                     ip,
		OS:                     osName,
		OSVersion:              hi.PlatformVersion,
		CPUUsage:               cpuUsage,
		RAMTotal:               vm.Total,
		RAMUsed:                vm.Used,
		DiskTotal:              du.Total,
		DiskUsed:               du.Used,
		Uptime:                 hi.Uptime,
		CPUModel:               cpuModel,
		GPU:                    "",
		Disks:                  disks,
		Interfaces:             interfaces,
		Domain:                 domain,
		CurrentUser:            currentUser,
		CurrentUserSID:         currentUserSID,
		IdentityFallbackReason: fallbackReason,
		MACAddress:             macAddress,
		DeviceType:             deviceType,
		DeviceTypeReason:       deviceTypeReason,
		Security:               segurancaComCache(),
		RemoteSoftware:         softwareRemotoComCache(),
		Battery:                bateriaComCache(),
		UpdateStatus:           atualizacoesComCache(),
		Activation:             ativacaoComCache(),
	}, nil
}

// (Payload.GenerateToken foi removido na correção A.6/B.5: a identidade da máquina
// deixou de ser derivada de MachineUUID/Hostname/MACs — dados legíveis por qualquer
// usuário local e instáveis conforme o estado da rede — e passou a ser um segredo
// aleatório gerado uma única vez. Ver token.GenerateRandomIdentity e
// orion-agent/MACHINE-IDENTITY-OPTIONS.md.)
