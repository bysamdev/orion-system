package shortcut

// Testes do pacote shortcut.
//
// CreatePortalShortcut real não é chamada aqui: ela usa getDesktopPath(),
// que não aceita injeção de caminho e escreveria de verdade na Área de
// Trabalho do usuário que rodar a suíte (mesmo achado de testabilidade já
// documentado para token.GetTokenPath). Os testes abaixo exercitam
// criarAtalhoComIconeEm — a lógica real, com caminho e ícone em t.TempDir().

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func iconeDeTeste(t *testing.T) func() (string, error) {
	t.Helper()
	pasta := t.TempDir()
	return func() (string, error) { return gravarIconeEm(pasta) }
}

func atalhoDeTeste(t *testing.T) func(string, string, string) error {
	gravarIcone := iconeDeTeste(t)
	return func(caminho, apiURL, machineToken string) error {
		return criarAtalhoComIconeEm(caminho, apiURL, machineToken, gravarIcone)
	}
}

// TestCriarAtalhoEm_CriaArquivoComFormatoEsperado garante o formato .url e
// que a URL embutida leva à tela de login e não carrega o token.
func TestCriarAtalhoEm_CriaArquivoComFormatoEsperado(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "Abrir Chamado Orion.url")

	if err := criarAtalhoComIconeEm(caminho, "https://orion.exemplo.test", "tok-123", iconeDeTeste(t)); err != nil {
		t.Fatalf("criarAtalhoEm falhou: %v", err)
	}

	conteudo, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatalf("arquivo não foi criado: %v", err)
	}

	str := string(conteudo)
	if !strings.Contains(str, "URL=https://orion.exemplo.test/auth\n") || strings.Contains(str, "tok-123") {
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

	gravarIcone := iconeDeTeste(t)
	if err := criarAtalhoComIconeEm(caminho, "https://orion.exemplo.test", "tok-123", gravarIcone); err != nil {
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

	if err := criarAtalhoComIconeEm(caminho, "https://orion.exemplo.test", "tok-123", gravarIcone); err != nil {
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

// TestCriarAtalhoEm_RegravaQuandoServidorMuda garante que o skip de escrita
// não vira um cache indevido: mudando o endereço do servidor, o arquivo
// precisa refletir o novo valor.
func TestCriarAtalhoEm_RegravaQuandoServidorMuda(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "Abrir Portal de Chamados.url")

	gravarIcone := iconeDeTeste(t)
	if err := criarAtalhoComIconeEm(caminho, "https://antigo.exemplo.test", "tok", gravarIcone); err != nil {
		t.Fatalf("primeira gravação falhou: %v", err)
	}
	if err := criarAtalhoComIconeEm(caminho, "https://novo.exemplo.test", "tok", gravarIcone); err != nil {
		t.Fatalf("segunda gravação (servidor novo) falhou: %v", err)
	}

	conteudo, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatalf("leitura falhou: %v", err)
	}
	if !strings.Contains(string(conteudo), "https://novo.exemplo.test/auth") {
		t.Errorf("arquivo não foi atualizado para o novo servidor: %q", string(conteudo))
	}
	if strings.Contains(string(conteudo), "antigo") {
		t.Errorf("arquivo ainda aponta para o servidor antigo: %q", string(conteudo))
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

	if err := criarAtalhoComIconeEm(caminho, "https://orion.exemplo.test", "tok-1", iconeDeTeste(t)); err != nil {
		t.Fatalf("criarAtalhoEm falhou na primeira execução: %v", err)
	}

	if _, err := os.Stat(caminho); err != nil {
		t.Fatalf("arquivo não foi criado: %v", err)
	}
}

// TestCriarAtalhoEm_ApontaParaOIconeRealDoOrion cobre o pedido: o atalho
// precisa mostrar a logo do Orion, não o ícone genérico do .exe. IconFile
// deve apontar pro orion.ico gravado ao lado do executável (o mesmo
// tray.DataIcon usado na bandeja), não pro próprio orion-agent.exe.
func TestCriarAtalhoEm_ApontaParaOIconeRealDoOrion(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "atalho.url")

	if err := criarAtalhoComIconeEm(caminho, "https://orion.exemplo.test", "tok-1", iconeDeTeste(t)); err != nil {
		t.Fatalf("criarAtalhoEm: %v", err)
	}

	conteudo, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatal(err)
	}
	str := string(conteudo)
	if strings.Contains(str, "IconFile=") && strings.HasSuffix(strings.TrimSpace(strings.SplitN(str, "IconFile=", 2)[1]), "orion-agent.exe") {
		t.Error("IconFile aponta pro .exe (ícone genérico) em vez de orion.ico (logo do Orion)")
	}
	if !strings.Contains(str, "orion.ico") {
		t.Errorf("esperava IconFile apontando pra orion.ico, saída: %s", str)
	}
}

// TestGravarIconeEm_EhIdempotente garante que gravar o mesmo ícone duas
// vezes não regrava o arquivo à toa. Usa gravarIconeEm (não a pública
// gravarIconeOrion, que agora é fixa em C:\Orion — ver comentário no bug
// abaixo) sobre t.TempDir(), pra não tocar na instalação real da máquina
// que roda `go test`.
func TestGravarIconeEm_EhIdempotente(t *testing.T) {
	pasta := t.TempDir()
	caminho, err := gravarIconeEm(pasta)
	if err != nil {
		t.Fatalf("gravarIconeEm: %v", err)
	}

	info1, err := os.Stat(caminho)
	if err != nil {
		t.Fatalf("orion.ico não foi criado: %v", err)
	}

	if _, err := gravarIconeEm(pasta); err != nil {
		t.Fatalf("segunda chamada: %v", err)
	}
	info2, err := os.Stat(caminho)
	if err != nil {
		t.Fatal(err)
	}
	if info1.ModTime() != info2.ModTime() {
		t.Error("gravarIconeEm regravou um arquivo com conteúdo idêntico")
	}
}

// TestGravarIconeOrion_IgnoraProcessoAtualEUsaSempreCOrion é o teste de
// regressão direto do bug reproduzido em máquina real: gravarIconeOrion
// usava os.Executable() pra decidir onde gravar orion.ico — quando chamada
// de dentro do INSTALADOR (rodando de %TEMP%, Downloads, ou da própria
// Área de Trabalho), o .ico saía gravado nesse caminho efêmero em vez de
// C:\Orion, deixando o atalho com IconFile pra um arquivo que some assim
// que o instalador é limpo/movido (confirmado: um atalho real apontava pra
// "...\Temp\orion.ico", outro direto pro .exe do instalador em
// "...\Temp\OrionInstaller-1.1.15.exe" — nenhum dos dois mais existia).
// gravarIconeOrion() usa um caminho fixo; o teste confere essa escolha sem
// criar/apagar o ícone da instalação real.
func TestGravarIconeOrion_IgnoraProcessoAtualEUsaSempreCOrion(t *testing.T) {
	if pasta := pastaIconeOrion(); pasta != `C:\Orion` {
		t.Errorf("ícone seria gravado em %q, esperado C:\\Orion", pasta)
	}
}
