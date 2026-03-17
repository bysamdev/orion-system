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

	shortcutPath := filepath.Join(desktop, "Abrir Portal de Chamados.url")
	
	// If it already exists, we might want to overwrite it to ensure the URL is correct
	targetURL := fmt.Sprintf("%s/api/auth/machine-login?token=%s", apiURL, machineToken)
	
	content := fmt.Sprintf("[InternetShortcut]\nURL=%s\n", targetURL)
	
	err = os.WriteFile(shortcutPath, []byte(content), 0644)
	if err != nil {
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
