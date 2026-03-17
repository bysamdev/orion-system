package collector

import (
	"crypto/sha256"
	"fmt"
	"net"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

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
func primaryIP() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
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

	// 3. Modelo do Processador
	var cpuModel string
	cpuInfos, err := cpu.Info()
	if err == nil && len(cpuInfos) > 0 {
		cpuModel = strings.TrimSpace(cpuInfos[0].ModelName)
	}

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

	// 6. Lista Geral de Discos e Partições
	var disks []DiskInfo
	parts, err := disk.Partitions(false)
	if err == nil {
		for _, p := range parts {
			d, err := disk.Usage(p.Mountpoint)
			if err == nil {
				disks = append(disks, DiskInfo{
					Device:     p.Device,
					Mountpoint: p.Mountpoint,
					FSType:     p.Fstype,
					Total:      d.Total,
					Used:       d.Used,
				})
			}
		}
	}

	// 7. Adaptadores de Rede e Endereços IP
	var interfaces []NetworkInterface
	ifaces, err := net.Interfaces()
	if err == nil {
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
		IP:         primaryIP(),
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

// GenerateToken cria uma "Digital" estável e única para a máquina baseada no ID do hardware e MAC addresses.
// Isso evita que a máquina mude de identidade se formatar o Windows (usando o MachineUUID).
func (p *Payload) GenerateToken() string {
	var macs []string
	for _, iface := range p.Interfaces {
		if iface.MAC != "" {
			macs = append(macs, iface.MAC)
		}
	}
	
	raw := fmt.Sprintf("%s|%s|%s", p.MachineUUID, p.Hostname, strings.Join(macs, ","))
	hash := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", hash)
}
