package shortcut

// Testes do pacote shortcut.
//
// CreatePortalShortcut real não é chamada aqui: ela usa getDesktopPath(),
// que não aceita injeção de caminho e escreveria de verdade na Área de
// Trabalho do usuário que rodar a suíte (mesmo achado de testabilidade já
// documentado para token.GetTokenPath). Os testes abaixo exercitam
// criarAtalhoEm — a lógica real, sobre um caminho arbitrário em t.TempDir().

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestCriarAtalhoEm_CriaArquivoComFormatoEsperado garante o formato .url e
// que a URL embutida contém o endpoint e o token corretos.
func TestCriarAtalhoEm_CriaArquivoComFormatoEsperado(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "Abrir Chamado Orion.url")

	if err := criarAtalhoEm(caminho, "https://orion.exemplo.test", "tok-123"); err != nil {
		t.Fatalf("criarAtalhoEm falhou: %v", err)
	}

	conteudo, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatalf("arquivo não foi criado: %v", err)
	}

	str := string(conteudo)
	if !strings.Contains(str, "URL=https://orion.exemplo.test/api/auth/machine-login?token=tok-123") {
		t.Errorf("conteúdo = %q, esperado conter URL correta", str)
	}
	if !strings.Contains(str, "IconIndex=0") || !strings.Contains(str, "IconFile=") {
		t.Errorf("conteúdo = %q, esperado conter ícone", str)
	}
}

// TestCriarAtalhoEm_NaoRegravaConteudoIdentico cobre a correção B.8: uma
// segunda chamada com os MESMOS api_url/machineToken não deve tocar no
// arquivo. Verificado pelo ModTime — se o arquivo fosse reescrito, o
// ModTime mudaria mesmo com conteúdo idêntico.
func TestCriarAtalhoEm_NaoRegravaConteudoIdentico(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "Abrir Portal de Chamados.url")

	if err := criarAtalhoEm(caminho, "https://orion.exemplo.test", "tok-123"); err != nil {
		t.Fatalf("primeira gravação falhou: %v", err)
	}

	infoAntes, err := os.Stat(caminho)
	if err != nil {
		t.Fatalf("stat falhou: %v", err)
	}
	modTimeAntes := infoAntes.ModTime()

	// Espera garantir resolução de ModTime suficiente no sistema de arquivos
	// para que uma regravação indevida seja detectável.
	time.Sleep(20 * time.Millisecond)

	if err := criarAtalhoEm(caminho, "https://orion.exemplo.test", "tok-123"); err != nil {
		t.Fatalf("segunda chamada (conteúdo idêntico) falhou: %v", err)
	}

	infoDepois, err := os.Stat(caminho)
	if err != nil {
		t.Fatalf("stat pós-segunda-chamada falhou: %v", err)
	}

	if !infoDepois.ModTime().Equal(modTimeAntes) {
		t.Errorf("arquivo foi regravado com conteúdo idêntico: ModTime mudou de %v para %v",
			modTimeAntes, infoDepois.ModTime())
	}
}

// TestCriarAtalhoEm_RegravaQuandoTokenMuda garante que o skip de escrita não
// vira um cache indevido: mudando o token (ex.: reconfiguração da máquina),
// o arquivo precisa refletir o novo valor.
func TestCriarAtalhoEm_RegravaQuandoTokenMuda(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "Abrir Portal de Chamados.url")

	if err := criarAtalhoEm(caminho, "https://orion.exemplo.test", "tok-antigo"); err != nil {
		t.Fatalf("primeira gravação falhou: %v", err)
	}
	if err := criarAtalhoEm(caminho, "https://orion.exemplo.test", "tok-novo"); err != nil {
		t.Fatalf("segunda gravação (token novo) falhou: %v", err)
	}

	conteudo, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatalf("leitura falhou: %v", err)
	}
	if !strings.Contains(string(conteudo), "tok-novo") {
		t.Errorf("arquivo não foi atualizado para o novo token: %q", string(conteudo))
	}
	if strings.Contains(string(conteudo), "tok-antigo") {
		t.Errorf("arquivo ainda contém o token antigo: %q", string(conteudo))
	}
}

// TestCriarAtalhoEm_ArquivoInexistenteEhCriadoNormalmente garante que o
// ramo "leitura falhou" (arquivo ainda não existe, primeira execução) não
// bloqueia a criação — o os.ReadFile deve falhar silenciosamente e cair no
// caminho de escrita normal.
func TestCriarAtalhoEm_ArquivoInexistenteEhCriadoNormalmente(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "nao-existe-ainda.url")

	if _, err := os.Stat(caminho); err == nil {
		t.Fatal("pré-condição falhou: arquivo já existia")
	}

	if err := criarAtalhoEm(caminho, "https://orion.exemplo.test", "tok-1"); err != nil {
		t.Fatalf("criarAtalhoEm falhou na primeira execução: %v", err)
	}

	if _, err := os.Stat(caminho); err != nil {
		t.Fatalf("arquivo não foi criado: %v", err)
	}
}
