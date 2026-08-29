//go:build windows

package tray

import (
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/getlantern/systray"
	"github.com/pkg/browser"

	"orion-agent/version"
)

// tooltipVersao monta o texto do tooltip do ícone com a versão instalada —
// o usuário pedia isso ao passar o mouse pra confirmar se a máquina já
// pegou uma atualização recente sem precisar abrir o painel.
func tooltipVersao(status string) string {
	return fmt.Sprintf("Orion System v%s — %s", version.Version, status)
}

// TrayManager organiza as ações e o estado da bandeja do sistema vinculadas ao agente.
type TrayManager struct {
	OnOpenPortal func()
	OnOpenTicket func()
	OnExit       func()

	// mu protege o item de status, que é criado na goroutine do systray (onReady)
	// e atualizado a partir dos callbacks de clique.
	mu      sync.Mutex
	mStatus *systray.MenuItem
	status  string
}

// New constrói o gerenciador com as funções de callback para abertura de portal, abertura de chamado e encerramento.
func New(onOpen func(), onTicket func(), onExit func()) *TrayManager {
	return &TrayManager{
		OnOpenPortal: onOpen,
		OnOpenTicket: onTicket,
		OnExit:       onExit,
	}
}

// Run inicia o loop principal da bandeja do sistema (bloqueante).
func (tm *TrayManager) Run() {
	systray.Run(tm.onReady, tm.onExitInternal)
}

// onReady configura os itens de menu, ícone e tooltip assim que a bandeja está pronta.
func (tm *TrayManager) onReady() {
	systray.SetIcon(DataIcon) // Ícone embutido no arquivo icon_data.go
	systray.SetTitle("Orion Agent")
	systray.SetTooltip(tooltipVersao("Suporte Ativo"))

	// Linha de status no topo do menu. Fica desabilitada (não é clicável): serve
	// apenas para o usuário enxergar o estado real do agente. Antes disso, clicar
	// em "Abrir Portal" antes do primeiro check-in simplesmente não fazia nada,
	// sem nenhuma indicação visual do porquê.
	tm.mu.Lock()
	tm.mStatus = systray.AddMenuItem("Status: iniciando…", "Estado atual do Orion Agent")
	tm.mStatus.Disable()
	// Aplica o status que SetStatus tenha guardado antes de Run() — agora que
	// mStatus existe, aplicarStatusLocked também acerta o tooltip.
	if tm.status != "" {
		tm.aplicarStatusLocked()
	}
	tm.mu.Unlock()
	systray.AddSeparator()

	// Itens do menu de contexto (clique direito no ícone)
	mOpen := systray.AddMenuItem("Abrir Portal de Suporte", "Acessar o portal de chamados e suporte")
	mTicket := systray.AddMenuItem("Abrir Chamado", "Criar um novo chamado de suporte técnico")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Sair", "Encerrar o Orion Agent completamente")

	// Monitoramos sinais do sistema (Ctrl+C, etc) para garantir um desligamento limpo.
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Iniciamos uma goroutine para reagir às interações do usuário sem travar a interface.
	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				// Quando clica em abrir, executamos a função passada no New().
				tm.OnOpenPortal()
			case <-mTicket.ClickedCh:
				// Abre o navegador direto na página de novo chamado.
				tm.OnOpenTicket()
			case <-mQuit.ClickedCh:
				// Finalizamos o systray, o que chamará o tm.onExitInternal.
				systray.Quit()
				return
			case <-sigChan:
				// Caso o Windows peça para encerrar o processo.
				systray.Quit()
				return
			}
		}
	}()
}

// SetStatus atualiza a linha de status do menu e o tooltip do ícone.
//
// É seguro chamar antes de Run(): o texto fica guardado e é aplicado quando o
// menu é construído em onReady.
//
// mStatus != nil é o sinal de que onReady já rodou, ou seja, de que o systray
// terminou de inicializar. TODA chamada à API do systray precisa ficar atrás
// dessa guarda: systray.SetTooltip estava fora dela e entrava em
// "nil pointer dereference" (winTray.setTooltip) quando SetStatus era chamado
// antes de Run() — o que acontece sempre que o serviço já está no ar e o
// status inicial vira "conectado" (main.go), justamente o estado logo depois
// de instalar ou auto-atualizar. Resultado: a bandeja morria antes de
// desenhar o ícone, sem nada no log.
func (tm *TrayManager) SetStatus(msg string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	tm.status = msg
	tm.aplicarStatusLocked()
}

// aplicarStatusLocked reflete tm.status no menu e no tooltip. Não faz nada
// enquanto o systray não terminou de inicializar. Exige tm.mu já travado.
func (tm *TrayManager) aplicarStatusLocked() {
	if tm.mStatus == nil {
		return
	}
	tm.mStatus.SetTitle("Status: " + tm.status)
	systray.SetTooltip(tooltipVersao(tm.status))
}

// Quit encerra a bandeja programaticamente, fora de um clique de menu —
// mesmo caminho que "Sair" usa (systray.Quit() -> onExitInternal() ->
// OnExit), reaproveitado pela checagem de auto-atualização em main.go: o
// processo da bandeja precisa se encerrar sozinho depois de relançar uma
// cópia nova de si mesmo (ver comentário sobre taskkill entre sessões em
// main.go).
func (tm *TrayManager) Quit() {
	systray.Quit()
}

// onExitInternal é executado quando o systray finaliza, garantindo que o agente limpe seus recursos.
func (tm *TrayManager) onExitInternal() {
	if tm.OnExit != nil {
		tm.OnExit()
	}
}

func OpenURL(url string) {
	err := browser.OpenURL(url)
	if err != nil {
		fmt.Printf("Erro ao abrir URL: %v\n", err)
	}
}
