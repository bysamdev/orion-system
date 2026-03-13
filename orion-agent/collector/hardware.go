package collector

import (
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

// Payload is the heartbeat body sent to the backend.
type Payload struct {
	Hostname  string  `json:"hostname"`
	IP        string  `json:"ip"`
	OS        string  `json:"os"`
	OSVersion string  `json:"os_version"`
	CPUUsage  float64 `json:"cpu_usage"`
	RAMTotal  uint64  `json:"ram_total"`
	RAMUsed   uint64  `json:"ram_used"`
	DiskTotal uint64  `json:"disk_total"`
	DiskUsed  uint64  `json:"disk_used"`
	Uptime    uint64  `json:"uptime"`
	CPUModel  string  `json:"cpu_model"`
	GPU       string  `json:"gpu"`
	Disks     []any   `json:"disks"`
	Domain    string  `json:"domain"`
}

// diskRoot returns the primary disk root path for the current OS.
func diskRoot() string {
	if runtime.GOOS == "windows" {
		return "C:\\"
	}
	return "/"
}

// primaryIP returns the first non-loopback IPv4 address.
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

// Collect gathers current hardware metrics and returns a Payload.
func Collect() (*Payload, error) {
	hostname, _ := os.Hostname()

	// Host info (OS, version, uptime)
	hi, err := host.Info()
	if err != nil {
		return nil, fmt.Errorf("host.Info: %w", err)
	}

	// CPU usage — sample over 1 second
	cpuPcts, err := cpu.Percent(1*time.Second, false)
	var cpuUsage float64
	if err == nil && len(cpuPcts) > 0 {
		cpuUsage = cpuPcts[0]
	}

	// CPU model
	var cpuModel string
	cpuInfos, err := cpu.Info()
	if err == nil && len(cpuInfos) > 0 {
		cpuModel = strings.TrimSpace(cpuInfos[0].ModelName)
	}

	// RAM
	vm, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("mem.VirtualMemory: %w", err)
	}

	// Disk
	du, err := disk.Usage(diskRoot())
	if err != nil {
		return nil, fmt.Errorf("disk.Usage: %w", err)
	}

	osName := hi.OS
	if osName == "" {
		osName = runtime.GOOS
	}

	domain := os.Getenv("USERDOMAIN")
	if domain == "" {
		domain = os.Getenv("USERDNSDOMAIN")
	}
	if domain == "" {
		domain = "WORKGROUP"
	}

	return &Payload{
		Hostname:  hostname,
		IP:        primaryIP(),
		OS:        osName,
		OSVersion: hi.PlatformVersion,
		CPUUsage:  cpuUsage,
		RAMTotal:  vm.Total,
		RAMUsed:   vm.Used,
		DiskTotal: du.Total,
		DiskUsed:  du.Used,
		Uptime:    hi.Uptime,
		CPUModel:  cpuModel,
		GPU:       "",
		Disks:     []any{},
		Domain:    domain,
	}, nil
}
