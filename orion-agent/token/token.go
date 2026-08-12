package token

import (
	"crypto/rand"
	"encoding/hex"
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

// GenerateRandomIdentity cria uma nova identidade de máquina: 32 bytes de alta
// entropia (crypto/rand), codificados em hex — 64 caracteres, o mesmo comprimento
// do token anterior, para não exigir nenhuma mudança de schema ou de parsing a
// jusante (o backend trata machine_token como TEXT opaco).
//
// Substitui Payload.GenerateToken (removida de collector/hardware.go), que
// derivava a identidade de MachineUUID+Hostname+MACs. Esse desenho tinha dois
// problemas documentados: o valor não era segredo — MachineUUID é lido de uma
// chave de registro legível por qualquer usuário local, confirmado empiricamente
// em SECURITY-AUTO-PROVISIONING.md §1.2 — e não era estável, porque a lista de
// MACs muda com o estado da rede (VPN, Wi-Fi, USB), achado B.5 confirmado por
// teste. Um valor aleatório, gerado uma única vez e nunca recalculado a partir de
// hardware, resolve os dois ao mesmo tempo.
func GenerateRandomIdentity() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("gerar identidade aleatória da máquina: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// loadTokenFrom lê e decifra o token de um caminho arbitrário.
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
	if len(data) == 0 {
		return "", nil
	}

	if plain, err := unprotect(data); err == nil {
		return strings.TrimSpace(string(plain)), nil
	}

	// Não decifrou como blob DPAPI: ou é um machine.token gravado por uma versão
	// do agente anterior a esta correção (texto plano, sem proteção), ou o arquivo
	// está corrompido. Em ambos os casos, tratamos os bytes brutos como o token —
	// isso é a ponte de migração que evita que a frota já instalada re-registre
	// como "máquina nova" no primeiro heartbeat após o deploy desta versão. A
	// próxima chamada a SaveToken regrava o mesmo valor já protegido.
	//
	// TrimSpace cobre o mesmo caso do B.12: arquivo editado/recriado à mão por um
	// técnico, com CRLF ou espaço no fim.
	return strings.TrimSpace(string(data)), nil
}

// saveTokenTo cifra e grava o token em um caminho arbitrário. Ver comentário de
// loadTokenFrom sobre por que a lógica é separada da função pública.
func saveTokenTo(path, token string) error {
	dir := filepath.Dir(path)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create token directory: %w", err)
		}
	}

	// Reaplicada em toda gravação, não só na criação (correção A.4): a conta
	// sob a qual o serviço roda pode mudar entre versões do agente — por
	// exemplo, ao reduzir de LocalSystem para uma conta de serviço virtual
	// (NT SERVICE\OrionAgent, ver ServiceConfig em service/windows.go). Uma
	// instalação já existente, com o diretório criado sob a conta antiga,
	// ficaria sem acesso ao próprio token se a ACL só fosse aplicada na
	// criação. icacls /inheritance:r /grant:r é idempotente — reaplicar o
	// mesmo estado não tem custo real (SaveToken só roda ~1x por processo,
	// não é caminho quente).
	if err := endurecerACLDoDiretorio(dir); err != nil {
		return fmt.Errorf("endurecer permissões do diretório de identidade: %w", err)
	}

	if token == "" {
		// Mantém o comportamento pré-existente para este caso degenerado (achado
		// documentado em TestTokenVazioEhAceitoSemErro, não é objeto desta
		// correção): um token vazio é aceito e grava um arquivo vazio.
		return os.WriteFile(path, nil, 0600)
	}

	protegido, err := protect([]byte(token))
	if err != nil {
		return fmt.Errorf("proteger token antes de gravar: %w", err)
	}

	if err := os.WriteFile(path, protegido, 0600); err != nil {
		return fmt.Errorf("write token file: %w", err)
	}

	return nil
}
