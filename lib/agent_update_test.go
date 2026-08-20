package lib

import (
	"bytes"
	"os"
	"path/filepath"
	"regexp"
	"testing"
)

// Estas regexes são uma cópia literal de parseOrionInstallArgs em
// orion-agent/service/windows.go — os dois módulos Go são separados (não
// dá pra importar a função real de lá), então o teste replica o parser de
// verdade pra travar o contrato: se ComandoAutoUpdate mudar de formato sem
// o parser do agente mudar junto (ou vice-versa), este teste quebra ANTES
// de virar um comando que o agente simplesmente não consegue interpretar
// em produção.
var (
	testeURLRegex  = regexp.MustCompile(`--url="([^"]+)"|--url=([^\s]+)`)
	testeHashRegex = regexp.MustCompile(`--hash="([^"]+)"|--hash=([^\s]+)`)
	testeArgsRegex = regexp.MustCompile(`--args="([^"]+)"`)
)

func TestComandoAutoUpdate_FormatoEntendidoPeloParserDoAgente(t *testing.T) {
	comando := ComandoAutoUpdate("https://exemplo.com/OrionInstaller-Cliente.exe?token=abc&download=x", "deadbeef")

	urlMatch := testeURLRegex.FindStringSubmatch(comando)
	if urlMatch == nil || urlMatch[1] != "https://exemplo.com/OrionInstaller-Cliente.exe?token=abc&download=x" {
		t.Fatalf("--url não extraído corretamente de %q: %v", comando, urlMatch)
	}

	hashMatch := testeHashRegex.FindStringSubmatch(comando)
	if hashMatch == nil || hashMatch[1] != "deadbeef" {
		t.Fatalf("--hash não extraído corretamente de %q: %v", comando, hashMatch)
	}

	argsMatch := testeArgsRegex.FindStringSubmatch(comando)
	if argsMatch == nil || argsMatch[1] != "-silent" {
		t.Fatalf("--args não extraído corretamente de %q: %v", comando, argsMatch)
	}
}

func TestComandoAutoUpdate_ComecaComOrionInstall(t *testing.T) {
	// pollAndExecuteCommands (orion-agent/service/windows.go) só entra no
	// fluxo de instalação quando strings.HasPrefix(comando, "orion-install")
	// — sem isso, o comando cairia no executor genérico via cmd /C.
	comando := ComandoAutoUpdate("https://exemplo.com/x.exe", "hash")
	prefixo := "orion-install "
	if len(comando) < len(prefixo) || comando[:len(prefixo)] != prefixo {
		t.Fatalf("comando não começa com %q: %q", prefixo, comando)
	}
}

func TestHasPendingUpdateCommand_MarcadorConsistente(t *testing.T) {
	comando := ComandoAutoUpdate("https://exemplo.com/x.exe", "hash")
	if !regexp.MustCompile(regexp.QuoteMeta(marcadorAutoUpdate)).MatchString(comando) {
		t.Fatalf("comando gerado não contém marcadorAutoUpdate (%q): %q", marcadorAutoUpdate, comando)
	}
}

// TestLatestAgentVersionEmSincronia é o guarda-corpo do fluxo de
// auto-atualização. O mecanismo só dispara quando o agent_version reportado no
// heartbeat difere de LatestAgentVersion, e o binário que será instalado é o
// que está embutido aqui via go:embed — então três coisas precisam andar
// juntas a cada mudança em orion-agent/:
//
//  1. orion-agent/version/version.go:Version
//  2. lib/agent_update.go:LatestAgentVersion (este módulo)
//  3. os binários reconstruídos e recommitados
//
// Já aconteceu de (1) e (2) ficarem para trás depois de mudar o código do
// agente: o backend seguiu achando que toda máquina estava atualizada e a
// auto-atualização nunca disparou, mesmo com binário novo pronto. E o caso
// inverso (bumpar as constantes sem reconstruir o binário) publicaria um
// instalador que se reporta com a versão antiga — a máquina atualizaria em
// loop, sem nunca "chegar" na versão esperada.
func TestLatestAgentVersionEmSincronia(t *testing.T) {
	t.Run("bate com orion-agent/version/version.go", func(t *testing.T) {
		// Módulos Go separados: não dá pra importar a constante, então o
		// valor é lido do fonte como texto.
		fonte, err := os.ReadFile(filepath.Join("..", "orion-agent", "version", "version.go"))
		if err != nil {
			t.Fatalf("ler version.go do agente: %v", err)
		}
		m := regexp.MustCompile(`const\s+Version\s*=\s*"([^"]+)"`).FindSubmatch(fonte)
		if m == nil {
			t.Fatal("não encontrei `const Version = \"...\"` em orion-agent/version/version.go")
		}
		if got := string(m[1]); got != LatestAgentVersion {
			t.Errorf("orion-agent/version.Version = %q, mas lib.LatestAgentVersion = %q — "+
				"bump os dois juntos, senão a auto-atualização entra em loop ou nunca dispara", got, LatestAgentVersion)
		}
	})

	t.Run("binário embutido foi reconstruído nesta versão", func(t *testing.T) {
		// A string da constante fica nos dados do binário compilado, então a
		// ausência dela denuncia binário antigo commitado junto de uma
		// constante nova.
		if !bytes.Contains(instaladorGenerico, []byte(LatestAgentVersion)) {
			t.Errorf("OrionInstaller.exe embutido não contém a string %q — "+
				"reconstrua os binários (orion-agent/packaging/msi/build.ps1) antes de commitar", LatestAgentVersion)
		}
	})
}
