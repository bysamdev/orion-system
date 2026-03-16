package token

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
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
	path := GetTokenPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return "", errors.New("token file not found")
	}
	
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read token file: %w", err)
	}
	
	return string(data), nil
}

// SaveToken persists the machine token to disk.
func SaveToken(token string) error {
	path := GetTokenPath()
	
	// Ensure directory exists
	dir := filepath.Dir(path)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create token directory: %w", err)
		}
	}
	
	if err := ioutil.WriteFile(path, []byte(token), 0600); err != nil {
		return fmt.Errorf("write token file: %w", err)
	}
	
	return nil
}
