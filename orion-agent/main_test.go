package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestRedigirQueryRemoveCredencialDaURL cobre a correcao A.8.
//
// As URLs do portal carregam o machine_token na query string. Antes desta correcao,
// cada clique na bandeja gravava essa credencial em texto plano no agent.log.
// Este teste garante que nenhum valor de query volte a aparecer em log.
func TestRedigirQueryRemoveCredencialDaURL(t *testing.T) {
	const tokenSecreto = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

	casos := []struct {
		nome     string
		entrada  string
		esperado string
	}{
		{
			nome:     "url do portal com token",
			entrada:  "https://orion.bysam.dev/api/auth/machine-login?token=" + tokenSecreto,
			esperado: "https://orion.bysam.dev/api/auth/machine-login?[redigido]",
		},
		{
			nome:     "url de novo chamado com token e redirect",
			entrada:  "https://orion.bysam.dev/api/auth/machine-login?token=" + tokenSecreto + "&redirect_to=/novo-ticket",
			esperado: "https://orion.bysam.dev/api/auth/machine-login?[redigido]",
		},
		{
			nome:     "url sem query permanece intacta",
			entrada:  "https://orion.bysam.dev/portal",
			esperado: "https://orion.bysam.dev/portal",
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			obtido := redigirQuery(c.entrada)
			if obtido != c.esperado {
				t.Errorf("redigirQuery() = %q, esperado %q", obtido, c.esperado)
			}
		})
	}
}

// TestRedigirQueryNuncaVazaOToken e a asserçao de seguranca central: independentemente
// do formato da URL, o valor do token nao pode sobreviver a redação.
func TestRedigirQueryNuncaVazaOToken(t *testing.T) {
	const tokenSecreto = "TOKEN-QUE-NAO-PODE-VAZAR-EM-LOG"

	entradas := []string{
		"https://orion.bysam.dev/api/auth/machine-login?token=" + tokenSecreto,
		"https://orion.bysam.dev/x?a=1&token=" + tokenSecreto + "&b=2",
		"http://localhost:8080/api/auth/machine-login?token=" + tokenSecreto,
	}

	for _, entrada := range entradas {
		obtido := redigirQuery(entrada)
		if strings.Contains(obtido, tokenSecreto) {
			t.Errorf("token vazou no log: redigirQuery(%q) = %q", entrada, obtido)
		}
	}
}

// TestRedigirQueryComURLInvalidaNaoEntraEmPanic garante que uma URL corrompida
// degrade para um marcador, em vez de derrubar o caminho de log.
func TestRedigirQueryComURLInvalidaNaoEntraEmPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("redigirQuery entrou em panic: %v", r)
		}
	}()

	// Byte de controle torna a URL inparseável.
	if obtido := redigirQuery("http://exemplo\x7f.com/?token=abc"); strings.Contains(obtido, "abc") {
		t.Errorf("token vazou mesmo com URL inválida: %q", obtido)
	}
}

// TestBinarioFoiAtualizado cobre a checagem de auto-restart da bandeja
// (ver main(), goroutine de mtime periódico): a bandeja interativa não é
// morta pelo taskkill do auto-update quando ele roda em modo silencioso
// sob NT SERVICE\OrionAgent (sem privilégio cross-sessão), então ela
// precisa se auto-detectar desatualizada comparando o mtime do próprio
// executável.
func TestBinarioFoiAtualizado(t *testing.T) {
	base := time.Now()

	casos := []struct {
		nome     string
		atual    time.Time
		esperado bool
	}{
		{"mtime mais novo indica atualização", base.Add(time.Second), true},
		{"mtime igual não indica atualização", base, false},
		{"mtime mais antigo não indica atualização", base.Add(-time.Second), false},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if obtido := binarioFoiAtualizado(base, c.atual); obtido != c.esperado {
				t.Errorf("binarioFoiAtualizado(%v, %v) = %v, esperado %v", base, c.atual, obtido, c.esperado)
			}
		})
	}
}

// TestSetupLoggerUsaNomeDeArquivoInformado cobre a correção B.15: o nome do
// arquivo de log vem de cfg.LogFile, não mais hardcoded como "agent.log".
//
// setupLogger só aceita o NOME do arquivo por parâmetro — o DIRETÓRIO ainda
// vem de os.Executable() (mesma limitação de token.GetTokenPath, já
// documentada). Isso é seguro de chamar aqui porque, sob `go test`, o binário
// roda de um diretório de build descartável, não da instalação real do
// agente — e o arquivo criado é removido ao final do teste.
func TestSetupLoggerUsaNomeDeArquivoInformado(t *testing.T) {
	const nomeArquivo = "teste-setuplogger-b15.log"

	logger, f, err := setupLogger(nomeArquivo)
	if err != nil {
		t.Fatalf("setupLogger falhou: %v", err)
	}
	defer f.Close()
	defer os.Remove(f.Name())

	if base := filepath.Base(f.Name()); base != nomeArquivo {
		t.Errorf("nome do arquivo de log = %q, esperado %q", base, nomeArquivo)
	}

	logger.Println("linha de teste")
	f.Sync()

	conteudo, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatalf("leitura do arquivo de log falhou: %v", err)
	}
	if !strings.Contains(string(conteudo), "linha de teste") {
		t.Errorf("conteúdo gravado pelo logger não apareceu no arquivo: %q", string(conteudo))
	}
}

// TestSetupLoggerComNomeVazioUsaAgentLogComoFallback garante que, se
// cfg.LogFile chegar vazio (não deveria — config.Load já aplica um default),
// setupLogger não quebra: cai em "agent.log" como última rede de segurança.
func TestSetupLoggerComNomeVazioUsaAgentLogComoFallback(t *testing.T) {
	_, f, err := setupLogger("")
	if err != nil {
		t.Fatalf("setupLogger(\"\") falhou: %v", err)
	}
	defer f.Close()
	defer os.Remove(f.Name())

	if base := filepath.Base(f.Name()); base != "agent.log" {
		t.Errorf("nome do arquivo de log com entrada vazia = %q, esperado %q", base, "agent.log")
	}
}
