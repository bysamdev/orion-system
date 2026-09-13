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

const (
	nomeAtalho       = "Abrir Chamado Orion.url"
	nomeAtalhoLegado = "Abrir Portal de Chamados.url"
)

// CreatePortalShortcut garante UM atalho "Abrir Chamado Orion" visível na Área
// de Trabalho, com o ícone do Orion.
//
// Antes, o atalho era gravado ao mesmo tempo na Área de Trabalho pública e na
// do usuário (por dois caminhos diferentes — %USERPROFILE%\Desktop e a pasta
// registrada em User Shell Folders, que com OneDrive é outra). O Explorer
// mostra a pública e a pessoal juntas, então o usuário via o ícone duplicado.
//
// Regra agora: a pública é o lugar certo (vale para todos que usam a
// máquina). Se o atalho existe lá — gravado agora ou já presente e só sem
// permissão para reescrever, caso da bandeja rodando sem elevação —, as cópias
// pessoais são removidas. Só quando não há como tê-lo na pública ele vai para a
// Área de Trabalho do usuário, em uma única pasta.
func CreatePortalShortcut(apiURL string, machineToken string) error {
	if runtime.GOOS != "windows" {
		return nil
	}
	return garantirAtalhoUnico(desktopPublico(), desktopsDoUsuario(), apiURL, machineToken)
}

// RemoverAtalhos apaga o atalho (e o nome legado) de todas as Áreas de
// Trabalho onde alguma versão do agente pode tê-lo gravado. Usado no uninstall.
func RemoverAtalhos() {
	pastas := append([]string{desktopPublico()}, desktopsDoUsuario()...)
	for _, pasta := range pastas {
		removerAtalhosEm(pasta)
	}
}

// garantirAtalhoUnico é a regra de CreatePortalShortcut com as pastas
// injetadas, para ser testável sem tocar nas Áreas de Trabalho reais.
// pessoais vem em ordem de preferência: a primeira é onde o atalho fica
// quando não pode ir para a pública.
func garantirAtalhoUnico(publica string, pessoais []string, apiURL, machineToken string) error {
	if publica != "" {
		_ = os.Remove(filepath.Join(publica, nomeAtalhoLegado))
		caminhoPublico := filepath.Join(publica, nomeAtalho)
		errPublico := criarAtalhoEm(caminhoPublico, apiURL, machineToken)
		if _, err := os.Stat(caminhoPublico); err == nil {
			for _, pasta := range pessoais {
				if !mesmaPasta(pasta, publica) {
					removerAtalhosEm(pasta)
				}
			}
			return nil
		}
		_ = errPublico // sem atalho na pública: segue para a pessoal abaixo
	}

	if len(pessoais) == 0 {
		return fmt.Errorf("nenhuma Área de Trabalho disponível para o atalho")
	}
	principal := pessoais[0]
	_ = os.Remove(filepath.Join(principal, nomeAtalhoLegado))
	if err := criarAtalhoEm(filepath.Join(principal, nomeAtalho), apiURL, machineToken); err != nil {
		return err
	}
	for _, pasta := range pessoais[1:] {
		if !mesmaPasta(pasta, principal) {
			removerAtalhosEm(pasta)
		}
	}
	return nil
}

func removerAtalhosEm(pasta string) {
	if pasta == "" {
		return
	}
	_ = os.Remove(filepath.Join(pasta, nomeAtalho))
	_ = os.Remove(filepath.Join(pasta, nomeAtalhoLegado))
}

func desktopPublico() string {
	publico := os.Getenv("PUBLIC")
	if publico == "" {
		return ""
	}
	return filepath.Join(publico, "Desktop")
}

// desktopsDoUsuario lista as pastas de Área de Trabalho do usuário atual, na
// ordem de preferência: primeiro a registrada em User Shell Folders (é a que o
// Explorer realmente mostra — com OneDrive, C:\Users\x\OneDrive\Desktop), depois
// %USERPROFILE%\Desktop. Sem repetições.
func desktopsDoUsuario() []string {
	var candidatas []string
	if k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders`, registry.QUERY_VALUE); err == nil {
		if valor, _, err := k.GetStringValue("Desktop"); err == nil && valor != "" {
			// O valor costuma ser REG_EXPAND_SZ ("%USERPROFILE%\Desktop");
			// os.ExpandEnv, usado antes, só entende $VAR e deixava o texto cru.
			if expandido, err := registry.ExpandString(valor); err == nil {
				valor = expandido
			}
			candidatas = append(candidatas, valor)
		}
		k.Close()
	}
	if home, err := os.UserHomeDir(); err == nil && home != "" {
		candidatas = append(candidatas, filepath.Join(home, "Desktop"))
	}
	return semPastasRepetidas(candidatas)
}

func semPastasRepetidas(pastas []string) []string {
	var unicas []string
	for _, p := range pastas {
		if p == "" {
			continue
		}
		repetida := false
		for _, u := range unicas {
			if mesmaPasta(p, u) {
				repetida = true
				break
			}
		}
		if !repetida {
			unicas = append(unicas, p)
		}
	}
	return unicas
}

func mesmaPasta(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
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
