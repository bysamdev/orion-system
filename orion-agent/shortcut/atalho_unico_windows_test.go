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

	if err := garantirAtalhoUnico(publica, []string{oneDrive, perfil}, "https://orion.exemplo.test", "tok-1"); err != nil {
		t.Fatalf("garantirAtalhoUnico: %v", err)
	}

	if !existeAtalho(t, publica) {
		t.Fatal("atalho deveria existir na Área de Trabalho pública")
	}
	conteudo, _ := os.ReadFile(filepath.Join(publica, nomeAtalho))
	if !strings.Contains(string(conteudo), "token=tok-1") {
		t.Errorf("atalho público sem o token: %q", conteudo)
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

	if err := garantirAtalhoUnico(publicaInacessivel, []string{oneDrive, perfil}, "https://orion.exemplo.test", "tok-1"); err != nil {
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
