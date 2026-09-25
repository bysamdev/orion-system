//go:build !windows

package sonda

import (
	"net"
	"time"
)

// PingarICMP ainda não existe fora do Windows: a sonda roda no servidor de
// AD do cliente.
func PingarICMP(net.IP, time.Duration) (time.Duration, error) { return 0, ErrNaoSuportado }
