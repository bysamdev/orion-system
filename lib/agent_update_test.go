package lib

import (
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
