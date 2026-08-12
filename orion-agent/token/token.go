package token

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// GetTokenPath returns the platform-specific path for the machine token.
func GetTokenPath() string {
	if runtime.GOOS == "windows" {
		// Standard path for system-wide service data on Windows
		return `C:\ProgramData\OrionAgent\machine.token`
	}

	// Fallback for development/non-Windows
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	return filepath.Join(dir, "machine.token")
}

// LoadToken reads the stored machine token from disk.
func LoadToken() (string, error) {
	return loadTokenFrom(GetTokenPath())
}

// SaveToken persists the machine token to disk.
func SaveToken(token string) error {
	return saveTokenTo(GetTokenPath(), token)
}

// loadTokenFrom lê o token de um caminho arbitrário.
//
// Existe separada de LoadToken para que os testes exercitem esta lógica real sem
// depender do caminho fixo devolvido por GetTokenPath (que apontaria para
// C:\ProgramData na máquina do usuário).
func loadTokenFrom(path string) (string, error) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return "", errors.New("token file not found")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read token file: %w", err)
	}

	// TrimSpace é obrigatório: o arquivo costuma ser inspecionado e às vezes recriado
	// à mão por técnicos (ex: `echo TOKEN > machine.token` no PowerShell, que grava CRLF).
	// Sem normalizar, o "\r\n" final entra no token e todo heartbeat passa a receber 401,
	// com o arquivo parecendo visualmente correto.
	return strings.TrimSpace(string(data)), nil
}

// saveTokenTo grava o token em um caminho arbitrário. Ver comentário de loadTokenFrom
// sobre por que a lógica é separada da função pública.
func saveTokenTo(path, token string) error {
	// Ensure directory exists
	dir := filepath.Dir(path)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create token directory: %w", err)
		}
	}

	if err := os.WriteFile(path, []byte(token), 0600); err != nil {
		return fmt.Errorf("write token file: %w", err)
	}

	return nil
}
