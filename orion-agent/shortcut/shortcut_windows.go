package shortcut

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// CreatePortalShortcut creates a desktop shortcut to the Orion Support Portal.
// On Windows, it creates a .url file.
func CreatePortalShortcut(apiURL string, machineToken string) error {
	if runtime.GOOS != "windows" {
		return nil // Currently only Windows support as requested
	}

	desktop, err := getDesktopPath()
	if err != nil {
		return fmt.Errorf("não foi possível localizar a Área de Trabalho: %v", err)
	}

	return criarAtalhoEm(filepath.Join(desktop, "Abrir Portal de Chamados.url"), apiURL, machineToken)
}

// criarAtalhoEm grava o atalho num caminho arbitrário. Separada de
// CreatePortalShortcut para que os testes exercitem esta lógica real sem
// escrever na Área de Trabalho de verdade (getDesktopPath não aceita injeção
// de caminho — mesmo achado de testabilidade já documentado para
// token.GetTokenPath).
func criarAtalhoEm(caminho, apiURL, machineToken string) error {
	targetURL := fmt.Sprintf("%s/api/auth/machine-login?token=%s", apiURL, machineToken)
	content := fmt.Sprintf("[InternetShortcut]\nURL=%s\n", targetURL)

	// Só grava se o conteúdo realmente mudou. Antes desta correção, o atalho era
	// reescrito a cada chamada — e CreatePortalShortcut é chamada a cada tick()
	// (a cada 30 s em produção), reescrevendo um arquivo idêntico ~2.880 vezes
	// por dia sem necessidade (PERFORMANCE.md §3.5). O conteúdo só muda quando
	// api_url ou machineToken mudam, o que é raro (reconfiguração ou primeiro
	// heartbeat da máquina).
	if atual, err := os.ReadFile(caminho); err == nil && string(atual) == content {
		return nil
	}

	if err := os.WriteFile(caminho, []byte(content), 0644); err != nil {
		return fmt.Errorf("erro ao criar arquivo .url: %v", err)
	}

	return nil
}

func getDesktopPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	
	// Standard Windows desktop path
	return filepath.Join(home, "Desktop"), nil
}
