package shortcut

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Testes da regra de atalho único (garantirAtalhoUnico), com as Áreas de
// Trabalho simuladas em t.TempDir() — nenhuma pasta real do usuário é tocada.

func existeAtalho(t *testing.T, pasta string) bool {
	t.Helper()
	_, err := os.Stat(filepath.Join(pasta, nomeAtalho))
	return err == nil
}

func plantarAtalho(t *testing.T, pasta, nome string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(pasta, nome), []byte("[InternetShortcut]\nURL=https://antigo\n"), 0644); err != nil {
		t.Fatal(err)
	}
}

// TestGarantirAtalhoUnico_PublicaRemoveCopiasPessoais reproduz o caso
// relatado: atalho na pública e outro na Área de Trabalho do OneDrive.
func TestGarantirAtalhoUnico_PublicaRemoveCopiasPessoais(t *testing.T) {
	publica, oneDrive, perfil := t.TempDir(), t.TempDir(), t.TempDir()
	plantarAtalho(t, oneDrive, nomeAtalho)
	plantarAtalho(t, perfil, nomeAtalhoLegado)

	if err := garantirAtalhoUnicoComGravacao(publica, []string{oneDrive, perfil}, "https://orion.exemplo.test", "tok-1", atalhoDeTeste(t)); err != nil {
		t.Fatalf("garantirAtalhoUnico: %v", err)
	}

	if !existeAtalho(t, publica) {
		t.Fatal("atalho deveria existir na Área de Trabalho pública")
	}
	// O atalho leva à tela de login e NÃO carrega o token da máquina: o
	// login sem senha foi retirado em 19/09/2026 (ver machineLogin no
	// backend e CreatePortalShortcut). Este teste guarda essa decisão.
	conteudo, _ := os.ReadFile(filepath.Join(publica, nomeAtalho))
	if !strings.Contains(string(conteudo), "https://orion.exemplo.test/auth") {
		t.Errorf("atalho público não aponta para a tela de login: %q", conteudo)
	}
	if strings.Contains(string(conteudo), "tok-1") {
		t.Errorf("atalho público carrega o token da máquina: %q", conteudo)
	}
	for _, pasta := range []string{oneDrive, perfil} {
		if existeAtalho(t, pasta) {
			t.Errorf("cópia pessoal não removida em %s", pasta)
		}
		if _, err := os.Stat(filepath.Join(pasta, nomeAtalhoLegado)); err == nil {
			t.Errorf("atalho legado não removido em %s", pasta)
		}
	}
}

// TestGarantirAtalhoUnico_SemPublicaFicaSoNaPrimeiraPessoal cobre a bandeja sem
// permissão na pública e sem atalho lá: um único atalho, na pasta que o
// Explorer mostra.
func TestGarantirAtalhoUnico_SemPublicaFicaSoNaPrimeiraPessoal(t *testing.T) {
	publicaInacessivel := filepath.Join(t.TempDir(), "nao-existe")
	oneDrive, perfil := t.TempDir(), t.TempDir()
	plantarAtalho(t, perfil, nomeAtalho)

	if err := garantirAtalhoUnicoComGravacao(publicaInacessivel, []string{oneDrive, perfil}, "https://orion.exemplo.test", "tok-1", atalhoDeTeste(t)); err != nil {
		t.Fatalf("garantirAtalhoUnico: %v", err)
	}

	if !existeAtalho(t, oneDrive) {
		t.Error("atalho deveria ficar na primeira Área de Trabalho pessoal")
	}
	if existeAtalho(t, perfil) {
		t.Error("cópia na segunda Área de Trabalho pessoal deveria ter sido removida")
	}
}

func TestSemPastasRepetidas_IgnoraCaixaEBarraFinal(t *testing.T) {
	got := semPastasRepetidas([]string{`C:\Users\x\Desktop`, `c:\users\x\desktop\`, "", `C:\Users\x\OneDrive\Desktop`})
	if len(got) != 2 {
		t.Fatalf("semPastasRepetidas = %v, esperado 2 pastas distintas", got)
	}
}
