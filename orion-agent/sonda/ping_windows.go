//go:build windows

package sonda

import (
	"errors"
	"net"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Ping pela API ICMP do Windows (iphlpapi). Diferente de socket ICMP cru, não
// exige administrador: funciona na conta de serviço NT SERVICE\OrionAgent.

var (
	iphlpapi            = windows.NewLazySystemDLL("iphlpapi.dll")
	procIcmpCreateFile  = iphlpapi.NewProc("IcmpCreateFile")
	procIcmpCloseHandle = iphlpapi.NewProc("IcmpCloseHandle")
	procIcmpSendEcho    = iphlpapi.NewProc("IcmpSendEcho")
)

var dadosDoPing = []byte("orion-sonda-links")

// PingarICMP envia um eco para um IPv4.
func PingarICMP(alvo net.IP, timeout time.Duration) (time.Duration, error) {
	ip4 := alvo.To4()
	if ip4 == nil {
		return 0, errors.New("só IPv4")
	}
	h, _, err := procIcmpCreateFile.Call()
	if h == uintptr(windows.InvalidHandle) || h == 0 {
		return 0, err
	}
	defer procIcmpCloseHandle.Call(h)

	// IPAddr é o endereço na ordem da rede, lido como uint32 da memória.
	destino := *(*uint32)(unsafe.Pointer(&ip4[0]))
	// ICMP_ECHO_REPLY (40 bytes em 64 bits) + dados + 8 de folga, como pede a
	// documentação; o resto é margem.
	resposta := make([]byte, 40+len(dadosDoPing)+8+64)
	n, _, _ := procIcmpSendEcho.Call(h, uintptr(destino),
		uintptr(unsafe.Pointer(&dadosDoPing[0])), uintptr(len(dadosDoPing)), 0,
		uintptr(unsafe.Pointer(&resposta[0])), uintptr(len(resposta)), uintptr(timeout.Milliseconds()))
	if n == 0 {
		return 0, errors.New("sem resposta")
	}
	// Campos iniciais: Address (4), Status (4), RoundTripTime em ms (4).
	if status := *(*uint32)(unsafe.Pointer(&resposta[4])); status != 0 {
		return 0, errors.New("eco com erro")
	}
	rtt := *(*uint32)(unsafe.Pointer(&resposta[8]))
	return time.Duration(rtt) * time.Millisecond, nil
}
