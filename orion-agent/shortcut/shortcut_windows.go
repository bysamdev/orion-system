package shortcut

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"golang.org/x/sys/windows/registry"

	"orion-agent/tray"
)

// CreatePortalShortcut cria o atalho "Abrir Chamado Orion" na Área de Trabalho com o ícone do Orion.
func CreatePortalShortcut(apiURL string, machineToken string) error {
	if runtime.GOOS != "windows" {
		return nil
	}

	// 1. Grava no Desktop Público (para aparecer na área de trabalho de todos os usuários)
	publicDesktop := filepath.Join(os.Getenv("PUBLIC"), "Desktop")
	if publicDesktop != "Desktop" && publicDesktop != "" {
		_ = criarAtalhoEm(filepath.Join(publicDesktop, "Abrir Chamado Orion.url"), apiURL, machineToken)
		_ = os.Remove(filepath.Join(publicDesktop, "Abrir Portal de Chamados.url"))
	}

	// 2. Grava no Desktop do usuário atual via UserHomeDir
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		userDesktop := filepath.Join(home, "Desktop")
		_ = criarAtalhoEm(filepath.Join(userDesktop, "Abrir Chamado Orion.url"), apiURL, machineToken)
		_ = os.Remove(filepath.Join(userDesktop, "Abrir Portal de Chamados.url"))
	}

	// 3. Grava no Desktop do usuário atual via Registro do Windows (User Shell Folders)
	if k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders`, registry.QUERY_VALUE); err == nil {
		defer k.Close()
		if regDesktop, _, err := k.GetStringValue("Desktop"); err == nil && regDesktop != "" {
			regDesktop = os.ExpandEnv(regDesktop)
			_ = criarAtalhoEm(filepath.Join(regDesktop, "Abrir Chamado Orion.url"), apiURL, machineToken)
			_ = os.Remove(filepath.Join(regDesktop, "Abrir Portal de Chamados.url"))
		}
	}

	return nil
}

// criarAtalhoEm grava o atalho num caminho arbitrário com o ícone real do
// Orion System (o mesmo .ico multi-resolução que a bandeja usa — ver
// tray.DataIcon), não o ícone genérico embutido no .exe. IconFile de um
// atalho .url só aceita um caminho de arquivo, então o .ico precisa existir
// em disco antes.
func criarAtalhoEm(caminho, apiURL, machineToken string) error {
	apiURL = strings.TrimRight(strings.TrimSpace(apiURL), "/")
	if apiURL == "" {
		apiURL = "https://orion.bysam.dev"
	}
	var targetURL string
	if machineToken != "" {
		targetURL = fmt.Sprintf("%s/api/auth/machine-login?token=%s", apiURL, machineToken)
	} else {
		targetURL = fmt.Sprintf("%s/novo-ticket", apiURL)
	}

	iconPath, err := gravarIconeOrion()
	if err != nil {
		// Sem o .ico, o atalho ainda funciona — só cai de volta pro ícone
		// genérico do orion-agent.exe instalado (SEMPRE em C:\Orion, nunca
		// o processo atual — ver comentário em gravarIconeOrion sobre por
		// que os.Executable() aqui é o bug real, não a correção).
		iconPath = `C:\Orion\orion-agent.exe`
	}

	content := fmt.Sprintf("[InternetShortcut]\nURL=%s\nIconIndex=0\nIconFile=%s\n", targetURL, iconPath)

	if atual, err := os.ReadFile(caminho); err == nil && string(atual) == content {
		return nil
	}

	if err := os.WriteFile(caminho, []byte(content), 0644); err != nil {
		return fmt.Errorf("erro ao criar arquivo .url: %v", err)
	}

	return nil
}

// gravarIconeOrion garante que tray.DataIcon exista em C:\Orion\orion.ico
// (a pasta de instalação FIXA — ver pastaDestino em cmd/installer/main.go,
// nunca inferida de os.Executable()) e devolve o caminho.
//
// Usar os.Executable() aqui era o bug real, não uma conveniência: esta
// função também é chamada durante a instalação/auto-atualização, quando o
// processo em execução é o PRÓPRIO INSTALADOR (rodando de um download em
// %TEMP%, Downloads, ou onde o técnico salvou o .exe) — não o
// orion-agent.exe instalado. O .ico acabava gravado ao lado do instalador,
// num caminho efêmero que some assim que o arquivo é limpo/movido,
// deixando o atalho da Área de Trabalho com IconFile apontando pro nada
// (ícone em branco) e um .ico órfão espalhado por aí (inclusive na própria
// Área de Trabalho, se foi de lá que o instalador rodou). Best-effort e
// idempotente — grava de novo só se o conteúdo mudou (ex: ícone atualizado
// numa nova versão do agente).
func gravarIconeOrion() (string, error) {
	return gravarIconeEm(`C:\Orion`)
}

// gravarIconeEm faz o trabalho de verdade sobre uma pasta arbitrária —
// separada de gravarIconeOrion (que fixa C:\Orion) só pra permitir que o
// teste de idempotência escreva num t.TempDir() em vez de tocar na
// instalação real da máquina que roda `go test`.
func gravarIconeEm(pasta string) (string, error) {
	caminhoIco := filepath.Join(pasta, "orion.ico")

	if atual, err := os.ReadFile(caminhoIco); err == nil && string(atual) == string(tray.DataIcon) {
		return caminhoIco, nil
	}
	if err := os.WriteFile(caminhoIco, tray.DataIcon, 0644); err != nil {
		return "", fmt.Errorf("gravar orion.ico: %w", err)
	}
	return caminhoIco, nil
}

func getDesktopPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Desktop"), nil
}
