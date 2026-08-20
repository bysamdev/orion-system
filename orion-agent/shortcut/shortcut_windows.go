package shortcut

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// CreatePortalShortcut cria o atalho "Abrir Chamado Orion" na Área de Trabalho com o ícone do Orion.
func CreatePortalShortcut(apiURL string, machineToken string) error {
	if runtime.GOOS != "windows" {
		return nil
	}

	// Grava no Desktop Público (para aparecer na área de trabalho de todos os usuários)
	publicDesktop := filepath.Join(os.Getenv("PUBLIC"), "Desktop")
	if publicDesktop != "Desktop" && publicDesktop != "" {
		_ = criarAtalhoEm(filepath.Join(publicDesktop, "Abrir Chamado Orion.url"), apiURL, machineToken)
		_ = os.Remove(filepath.Join(publicDesktop, "Abrir Portal de Chamados.url"))
	}

	// Grava no Desktop do usuário atual se acessível
	desktop, err := getDesktopPath()
	if err == nil && desktop != "" {
		_ = criarAtalhoEm(filepath.Join(desktop, "Abrir Chamado Orion.url"), apiURL, machineToken)
		_ = os.Remove(filepath.Join(desktop, "Abrir Portal de Chamados.url"))
	}

	return nil
}

// criarAtalhoEm grava o atalho num caminho arbitrário com o ícone embutido.
func criarAtalhoEm(caminho, apiURL, machineToken string) error {
	targetURL := fmt.Sprintf("%s/api/auth/machine-login?token=%s", apiURL, machineToken)
	
	exePath := `C:\Orion\orion-agent.exe`
	if curExe, err := os.Executable(); err == nil && curExe != "" {
		exePath = curExe
	}

	content := fmt.Sprintf("[InternetShortcut]\nURL=%s\nIconIndex=0\nIconFile=%s\n", targetURL, exePath)

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
	return filepath.Join(home, "Desktop"), nil
}
