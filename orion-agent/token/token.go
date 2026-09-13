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

// ErrIdentidadeJaExiste indica que SaveNewToken encontrou uma identidade já
// gravada por outro processo do agente.
var ErrIdentidadeJaExiste = errors.New("identidade da máquina já existe em disco")

// SaveNewToken grava uma identidade RECÉM-GERADA só se ainda não houver
// nenhuma em disco (criação exclusiva, O_EXCL).
//
// SaveToken sobrescreve, e isso duplicava máquinas no inventário: na
// instalação, serviço e bandeja sobem juntos, os dois não acham arquivo,
// cada um gera uma identidade aleatória e o último a gravar vence — mas os
// dois já tinham feito check-in com a sua. Foi o que criou três registros
// WIN-AGM431 no mesmo segundo. Com criação exclusiva, quem perde a corrida
// recebe ErrIdentidadeJaExiste e passa a usar a identidade do vencedor.
func SaveNewToken(token string) error {
	return saveNewTokenTo(GetTokenPath(), token)
}

// GarantirPermissoesDoDiretorio reaplica a ACL do diretório de identidade
// quando ele já existe. O serviço chama a cada start: instalações anteriores
// a esta correção criaram o diretório sem a leitura para usuários
// interativos (ver endurecerACLDoDiretorio), e SaveToken — o único ponto que
// aplicava a ACL — não roda mais depois que a identidade existe.
func GarantirPermissoesDoDiretorio() error {
	dir := filepath.Dir(GetTokenPath())
	if _, err := os.Stat(dir); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return endurecerACLDoDiretorio(dir)
}

// prepararDiretorioDeIdentidade cria o diretório se preciso e aplica a ACL.
func prepararDiretorioDeIdentidade(dir string) error {
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
	// criação. icacls /inheritance:r /grant:r é idempotente.
	if err := endurecerACLDoDiretorio(dir); err != nil {
		return fmt.Errorf("endurecer permissões do diretório de identidade: %w", err)
	}
	return nil
}

func saveNewTokenTo(path, token string) error {
	if strings.TrimSpace(token) == "" {
		return errors.New("identidade vazia não pode ser gravada")
	}
	if err := prepararDiretorioDeIdentidade(filepath.Dir(path)); err != nil {
		return err
	}

	protegido, err := protect([]byte(token))
	if err != nil {
		return fmt.Errorf("proteger token antes de gravar: %w", err)
	}

	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		if os.IsExist(err) {
			return ErrIdentidadeJaExiste
		}
		return fmt.Errorf("write token file: %w", err)
	}
	if _, err := f.Write(protegido); err != nil {
		f.Close()
		_ = os.Remove(path)
		return fmt.Errorf("write token file: %w", err)
	}
	return f.Close()
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
	if err := prepararDiretorioDeIdentidade(filepath.Dir(path)); err != nil {
		return err
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
