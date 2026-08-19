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
	MachineToken string             `json:"machine_token"`
	MachineUUID  string             `json:"machine_uuid"`
	Hostname     string             `json:"hostname"`
	IP           string             `json:"ip"`
	OS           string             `json:"os"`
	OSVersion    string             `json:"os_version"`
	CPUUsage     float64            `json:"cpu_usage"`
	RAMTotal     uint64             `json:"ram_total"`
	RAMUsed      uint64             `json:"ram_used"`
	DiskTotal    uint64             `json:"disk_total"`
	DiskUsed     uint64             `json:"disk_used"`
	Uptime       uint64             `json:"uptime"`
	CPUModel     string             `json:"cpu_model"`
	GPU          string             `json:"gpu"` // Campo reservado para expansão futura
	Disks        []DiskInfo         `json:"disks"`
	Interfaces   []NetworkInterface `json:"interfaces"`
	Domain       string             `json:"domain"`
	CurrentUser  string             `json:"current_user"`
	CurrentUserSID string           `json:"current_user_sid"`
	MACAddress   string             `json:"mac_address"`
	DeviceType   string             `json:"device_type"`
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

// primeiroIPv4EMacNaoLoopback varre um snapshot de interfaces e devolve, de
// uma vez só, o primeiro IPv4 não-loopback ativo E o endereço MAC da
// interface física que o carrega — evita uma segunda varredura de
// net.Interfaces() só para descobrir o MAC "principal" (mesma preocupação
// de custo documentada acima para o IP, ver primaryIP).
func primeiroIPv4EMacNaoLoopback(ifaces []net.Interface) (ip, mac string) {
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			var addrIP net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				addrIP = v.IP
			case *net.IPAddr:
				addrIP = v.IP
			}
			if addrIP == nil || addrIP.IsLoopback() {
				continue
			}
			if ip4 := addrIP.To4(); ip4 != nil {
				ip = ip4.String()
				mac = iface.HardwareAddr.String()
				if mac != "" {
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

	// Montamos o relatório final (Payload)
	return &Payload{
		MachineUUID: hi.HostID,
		Hostname:   hostname,
		IP:         ip,
		OS:         osName,
		OSVersion:  hi.PlatformVersion,
		CPUUsage:   cpuUsage,
		RAMTotal:   vm.Total,
		RAMUsed:    vm.Used,
		DiskTotal:  du.Total,
		DiskUsed:   du.Used,
		Uptime:     hi.Uptime,
		CPUModel:   cpuModel,
		GPU:        "",
		Disks:      disks,
		Interfaces: interfaces,
		Domain:                 domain,
		CurrentUser:            currentUser,
		CurrentUserSID:         currentUserSID,
		IdentityFallbackReason: fallbackReason,
		MACAddress:             macAddress,
		DeviceType:     tipoDoDispositivo(),
		Security:       segurancaComCache(),
		RemoteSoftware: softwareRemotoComCache(),
		Battery:        bateriaComCache(),
		UpdateStatus:   atualizacoesComCache(),
		Activation:     ativacaoComCache(),
	}, nil
}

// (Payload.GenerateToken foi removido na correção A.6/B.5: a identidade da máquina
// deixou de ser derivada de MachineUUID/Hostname/MACs — dados legíveis por qualquer
// usuário local e instáveis conforme o estado da rede — e passou a ser um segredo
// aleatório gerado uma única vez. Ver token.GenerateRandomIdentity e
// orion-agent/MACHINE-IDENTITY-OPTIONS.md.)
