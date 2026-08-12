//go:build !windows

package tray

import (
	"fmt"
	"sync"

	"github.com/pkg/browser"
)

// TrayManager organiza as ações e o estado da bandeja do sistema vinculadas ao agente (stub para Linux/macOS).
type TrayManager struct {
	OnOpenPortal func()
	OnOpenTicket func()
	OnExit       func()
	mu           sync.Mutex
	status       string
}

// New constrói o gerenciador stub para compilação cruzada em sistemas não-Windows.
func New(onOpen func(), onTicket func(), onExit func()) *TrayManager {
	return &TrayManager{
		OnOpenPortal: onOpen,
		OnOpenTicket: onTicket,
		OnExit:       onExit,
	}
}

// Run stub em plataformas não-Windows.
func (tm *TrayManager) Run() {}

// SetStatus stub em plataformas não-Windows.
func (tm *TrayManager) SetStatus(msg string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.status = msg
}

// UpdateStatus stub em plataformas não-Windows.
func (tm *TrayManager) UpdateStatus(status string) {
	tm.SetStatus(status)
}

func OpenURL(url string) {
	err := browser.OpenURL(url)
	if err != nil {
		fmt.Printf("Erro ao abrir URL: %v\n", err)
	}
}
