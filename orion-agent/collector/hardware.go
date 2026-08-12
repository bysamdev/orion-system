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
}

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
func primeiroIPv4NaoLoopback(ifaces []net.Interface) string {
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
			if ip == nil || ip.IsLoopback() {
				continue
			}
			if ip4 := ip.To4(); ip4 != nil {
				return ip4.String()
			}
		}
	}
	return ""
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

	// 1. Dados Básicos do Host (Sistema Operacional, Versão e Tempo de Atividade)
	hi, err := host.Info()
	if err != nil {
		return nil, fmt.Errorf("Erro ao ler informações do host: %w", err)
	}

	// 2. Uso de CPU — Fazemos uma média rápida durante 1 segundo
	cpuPcts, err := cpu.Percent(1*time.Second, false)
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
	var ip string
	ifaces, err := net.Interfaces()
	if err == nil {
		ip = primeiroIPv4NaoLoopback(ifaces)
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

	osName := hi.OS
	if osName == "" {
		osName = runtime.GOOS
	}

	// 8. Domínio ou Grupo de Trabalho
	domain := os.Getenv("USERDOMAIN")
	if domain == "" {
		domain = os.Getenv("USERDNSDOMAIN")
	}
	if domain == "" {
		domain = "WORKGROUP"
	}

	// 9. Identificamos qual usuário está logado no momento da coleta
	currentUser := os.Getenv("USERNAME")
	if currentUser == "" {
		currentUser = os.Getenv("USER")
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
		Domain:     domain,
		CurrentUser: currentUser,
	}, nil
}

// (Payload.GenerateToken foi removido na correção A.6/B.5: a identidade da máquina
// deixou de ser derivada de MachineUUID/Hostname/MACs — dados legíveis por qualquer
// usuário local e instáveis conforme o estado da rede — e passou a ser um segredo
// aleatório gerado uma única vez. Ver token.GenerateRandomIdentity e
// orion-agent/MACHINE-IDENTITY-OPTIONS.md.)
