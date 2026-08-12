package token

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// AVISO DE SEGURANCA DESTE ARQUIVO DE TESTE
//
// GetTokenPath() devolve um caminho HARDCODED (C:\ProgramData\OrionAgent\machine.token
// no Windows). SaveToken() escreve exatamente nesse caminho e nao aceita injecao de
// diretorio. Por isso NENHUM teste aqui chama SaveToken(): chamar essa funcao dentro da
// suite escreveria de verdade na maquina do usuario (e ainda criaria C:\ProgramData\OrionAgent
// via MkdirAll). Isso e um ACHADO DE TESTABILIDADE, nao uma limitacao do teste.
//
// Consequencia pratica: o comportamento de gravacao/leitura de token so pode ser coberto
// por testes de LOGICA EQUIVALENTE (replicando as mesmas chamadas os.WriteFile/os.ReadFile
// dentro de t.TempDir()). Esses testes estao marcados explicitamente abaixo.

// ---------------------------------------------------------------------------
// Testes da funcao real GetTokenPath (somente leitura, sem efeito colateral)
// ---------------------------------------------------------------------------

// TestGetTokenPathRetornaCaminhoNaoVazio garante que a funcao sempre devolve um caminho
// utilizavel, com o nome de arquivo esperado, em qualquer sistema operacional.
func TestGetTokenPathRetornaCaminhoNaoVazio(t *testing.T) {
	caminho := GetTokenPath()

	if caminho == "" {
		t.Fatal("GetTokenPath() retornou string vazia")
	}
	if base := filepath.Base(caminho); base != "machine.token" {
		t.Errorf("nome de arquivo inesperado: obtido %q, esperado %q", base, "machine.token")
	}
	if !filepath.IsAbs(caminho) {
		t.Errorf("GetTokenPath() deveria retornar caminho absoluto, obtido %q", caminho)
	}
}

// TestGetTokenPathNoWindowsUsaProgramData documenta o contrato atual no Windows.
// Este teste tambem serve de trava: se alguem refatorar o caminho fixo para algo
// configuravel, este teste falha e forca a revisao consciente da mudanca.
func TestGetTokenPathNoWindowsUsaProgramData(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skipf("teste especifico de Windows, GOOS atual = %s", runtime.GOOS)
	}

	caminho := GetTokenPath()
	const esperado = `C:\ProgramData\OrionAgent\machine.token`

	if caminho != esperado {
		t.Errorf("GetTokenPath() = %q, esperado %q", caminho, esperado)
	}
	if !strings.HasSuffix(caminho, `\OrionAgent\machine.token`) {
		t.Errorf("sufixo inesperado em %q", caminho)
	}
}

// TestGetTokenPathEhDeterministicoENaoInjetavel demonstra o achado de testabilidade:
// o caminho nao muda entre chamadas e nao existe nenhum ponto de injecao (parametro,
// variavel de pacote ou variavel de ambiente) que permita redirecionar a escrita.
// Se um dia existir injecao, o valor deixara de ser constante e este teste falhara.
func TestGetTokenPathEhDeterministicoENaoInjetavel(t *testing.T) {
	primeira := GetTokenPath()

	// Tentativas comuns de redirecionamento: nenhuma delas deve surtir efeito hoje.
	t.Setenv("ORION_TOKEN_PATH", filepath.Join(t.TempDir(), "outro.token"))
	t.Setenv("PROGRAMDATA", t.TempDir())

	segunda := GetTokenPath()

	if primeira != segunda {
		t.Fatalf("GetTokenPath() deixou de ser determinista: %q depois %q", primeira, segunda)
	}

	if runtime.GOOS == "windows" {
		t.Logf("ACHADO: caminho fixo e nao injetavel (%q) — SaveToken/LoadToken sao intestaveis sem efeito colateral real", primeira)
	}
}

// TestLoadTokenComArquivoAusenteRetornaErro exercita a FUNCAO REAL LoadToken, que e
// puramente de leitura (os.Stat + ReadFile), portanto segura.
//
// O resultado depende do estado da maquina: se o agente ja estiver instalado, o arquivo
// existe e o teste nao tem o que verificar — nesse caso ele e pulado em vez de falhar
// espuriamente. Nunca escrevemos nada para forcar um dos cenarios.
func TestLoadTokenComArquivoAusenteRetornaErro(t *testing.T) {
	caminho := GetTokenPath()

	if _, err := os.Stat(caminho); err == nil {
		t.Skipf("token real existe em %q nesta maquina; nao vamos alterar o estado do sistema", caminho)
	}

	tok, err := LoadToken()
	if err == nil {
		t.Fatalf("esperado erro quando %q nao existe, obtido token %q e err nil", caminho, tok)
	}
	if tok != "" {
		t.Errorf("token deveria ser vazio em caso de erro, obtido %q", tok)
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("mensagem de erro inesperada: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Testes de LOGICA EQUIVALENTE
//
// As funcoes abaixo replicam LINHA A LINHA o que SaveToken/LoadToken fazem
// (ioutil.WriteFile / os.Stat + ioutil.ReadFile + string(data)), porem sobre um caminho
// recebido por parametro. Elas NAO chamam o codigo de producao — se o codigo de producao
// mudar, estes testes continuarao verdes e a divergencia passara despercebida.
// Essa e exatamente a divida tecnica reportada: sem injecao de caminho, nao ha como
// testar o comportamento real sem escrever em C:\ProgramData.
// ---------------------------------------------------------------------------

// salvarTokenEm e carregarTokenDe delegam para as funcoes REAIS de producao
// (saveTokenTo/loadTokenFrom), que aceitam caminho arbitrario.
//
// Antes da correcao B.12 estes helpers replicavam a logica de SaveToken/LoadToken,
// porque as funcoes publicas so operavam sobre o caminho fixo de GetTokenPath e
// exercita-las escreveria em C:\ProgramData da maquina real. Com o seam interno
// introduzido em token.go, os testes agora cobrem o codigo de producao de verdade.
func salvarTokenEm(caminho, tok string) error {
	return saveTokenTo(caminho, tok)
}

func carregarTokenDe(caminho string) (string, error) {
	return loadTokenFrom(caminho)
}

// TestRoundTripDeSerializacaoDoToken verifica que um token gravado e lido de volta
// e identico, incluindo casos limite (unicode, espacos internos, token longo).
// Roda inteiramente dentro de t.TempDir().
func TestRoundTripDeSerializacaoDoToken(t *testing.T) {
	casos := []struct {
		nome  string
		token string
	}{
		{"token jwt tipico", "eyJhbGciOiJIUzI1NiJ9.eyJtYWNoaW5lIjoiUEMtMDEifQ.abc-_123"},
		{"uuid", "9f8c1d2e-4a5b-6c7d-8e9f-0a1b2c3d4e5f"},
		{"com caracteres unicode", "chave-ação-çãüé"},
		{"token longo", strings.Repeat("a", 4096)},
		{"token vazio", ""},
	}

	for _, caso := range casos {
		t.Run(caso.nome, func(t *testing.T) {
			// Subdiretorio inexistente para exercitar tambem o MkdirAll da logica.
			caminho := filepath.Join(t.TempDir(), "OrionAgent", "machine.token")

			if err := salvarTokenEm(caminho, caso.token); err != nil {
				t.Fatalf("salvarTokenEm falhou: %v", err)
			}

			lido, err := carregarTokenDe(caminho)
			if err != nil {
				t.Fatalf("carregarTokenDe falhou: %v", err)
			}
			if lido != caso.token {
				t.Errorf("round-trip divergente: gravado %q, lido %q", caso.token, lido)
			}
		})
	}
}

// TestCarregarTokenDeArquivoInexistenteRetornaErro cobre o ramo os.IsNotExist da logica.
func TestCarregarTokenDeArquivoInexistenteRetornaErro(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "nao-existe.token")

	tok, err := carregarTokenDe(caminho)
	if err == nil {
		t.Fatalf("esperado erro para arquivo inexistente, obtido token %q", tok)
	}
	if tok != "" {
		t.Errorf("token deveria ser vazio, obtido %q", tok)
	}
}

// TestTokenVazioEhAceitoSemErro documenta um segundo achado: nem SaveToken nem LoadToken
// validam o conteudo. Um arquivo de token vazio (ou zerado por uma escrita interrompida)
// e carregado como string vazia SEM erro, e o agente seguira autenticando com "".
func TestTokenVazioEhAceitoSemErro(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "machine.token")
	if err := os.WriteFile(caminho, []byte(""), 0600); err != nil {
		t.Fatalf("preparacao falhou: %v", err)
	}

	tok, err := carregarTokenDe(caminho)
	if err != nil {
		t.Fatalf("nao esperado erro, obtido: %v", err)
	}
	if tok != "" {
		t.Fatalf("esperado token vazio, obtido %q", tok)
	}

	t.Log("ACHADO: arquivo de token vazio e aceito silenciosamente; LoadToken deveria rejeitar conteudo vazio")
}

// TestLoadTokenDeveIgnorarEspacosEQuebrasDeLinha documenta um BUG REAL do codigo de
// producao: LoadToken faz `return string(data), nil` SEM TrimSpace.
//
// Cenario de falha: um tecnico cria/edita o arquivo a mao — por exemplo
// `echo TOKEN > machine.token` no PowerShell, ou um editor que adiciona newline final.
// O token carregado vira "TOKEN\r\n" e nao bate com o token do servidor: o agente passa
// a receber 401 em todo heartbeat, com o arquivo aparentemente "correto" na inspecao visual.
//
// CORRIGIDO (item B.12): loadTokenFrom agora aplica strings.TrimSpace, e este teste
// protege a correcao contra regressao.
func TestLoadTokenDeveIgnorarEspacosEQuebrasDeLinha(t *testing.T) {
	casos := map[string]string{
		"newline unix":     "meu-token\n",
		"newline windows":  "meu-token\r\n",
		"espaco no final":  "meu-token ",
		"espaco no inicio": " meu-token",
		"bloco de espacos": "\t meu-token \r\n",
	}

	for nome, conteudo := range casos {
		t.Run(nome, func(t *testing.T) {
			caminho := filepath.Join(t.TempDir(), "machine.token")
			if err := os.WriteFile(caminho, []byte(conteudo), 0600); err != nil {
				t.Fatalf("preparacao falhou: %v", err)
			}

			lido, err := carregarTokenDe(caminho)
			if err != nil {
				t.Fatalf("carregarTokenDe falhou: %v", err)
			}
			if lido != "meu-token" {
				t.Errorf("token deveria ser normalizado para %q, obtido %q", "meu-token", lido)
			}
		})
	}
}

// (TestNewlineFinalCorrompeOTokenAtualmente foi removido junto com a correcao B.12:
// ele existia apenas para provar o bug de forma verde enquanto a correcao nao chegava,
// e a propria mensagem de falha instruia a apaga-lo assim que o token fosse normalizado.)
