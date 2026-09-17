package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// anexarConfigDeTeste monta os bytes exatamente como o backend faz —
// [binário][marcadorConfig][tamanho 4 bytes big-endian][JSON] — e escreve
// num executável de teste temporário. Espelha o formato real pra pegar
// qualquer divergência entre o que o backend gera e o que lerConfigAnexada
// entende.
func anexarConfigDeTeste(t *testing.T, base []byte, cfg configAnexada) string {
	t.Helper()

	payload, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	tamanho := make([]byte, 4)
	binary.BigEndian.PutUint32(tamanho, uint32(len(payload)))

	var buf bytes.Buffer
	buf.Write(base)
	buf.Write(marcadorConfig)
	buf.Write(tamanho)
	buf.Write(payload)

	caminho := filepath.Join(t.TempDir(), "instalador-teste.exe")
	if err := os.WriteFile(caminho, buf.Bytes(), 0755); err != nil {
		t.Fatalf("escrever executável de teste: %v", err)
	}
	return caminho
}

// comoSeExecutando reexecuta lerConfigAnexada como se os.Executable()
// apontasse pro caminho dado — não dá pra trocar os.Executable() de
// verdade, então o teste chama a lógica de leitura direto sobre os bytes,
// igual lerConfigAnexada faz internamente a partir do caminho.
func lerConfigDeArquivo(t *testing.T, caminho string) (*configAnexada, error) {
	t.Helper()
	dados, err := os.ReadFile(caminho)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	return decodificarConfigAnexada(dados)
}

func TestConfigAnexada_RoundTrip(t *testing.T) {
	base := []byte("MZ...conteudo-fake-de-um-PE-qualquer...")
	original := configAnexada{AgentKey: "chave-super-secreta", APIURL: "https://orion.exemplo.com", CompanyName: "iBReady"}
	caminho := anexarConfigDeTeste(t, base, original)

	got, err := lerConfigDeArquivo(t, caminho)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if got == nil {
		t.Fatal("esperava configuração encontrada, veio nil")
	}
	if got.AgentKey != original.AgentKey || got.APIURL != original.APIURL || got.CompanyName != original.CompanyName {
		t.Errorf("config lida = %+v; esperada %+v", got, original)
	}
}

func TestConfigAnexada_SemMarcadorDevolveNilSemErro(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "instalador-generico.exe")
	if err := os.WriteFile(caminho, []byte("MZ...binario generico sem nada anexado..."), 0755); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	got, err := lerConfigDeArquivo(t, caminho)
	if err != nil {
		t.Fatalf("instalador genérico não deveria dar erro: %v", err)
	}
	if got != nil {
		t.Errorf("esperava nil (sem config anexada), veio %+v", got)
	}
}

func TestConfigAnexada_TamanhoTruncadoDaErro(t *testing.T) {
	// Marcador presente, mas sem os 4 bytes de tamanho depois.
	dados := append([]byte("base"), marcadorConfig...)
	caminho := filepath.Join(t.TempDir(), "instalador-corrompido.exe")
	if err := os.WriteFile(caminho, dados, 0755); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	if _, err := lerConfigDeArquivo(t, caminho); err == nil {
		t.Fatal("esperava erro para dados truncados")
	}
}

// Desde 2026-09-17 o backend embute só api_url/company_name: a chave é
// digitada na instalação (ou passada por -agent-key=). Bloco sem agent_key
// virou o caso NORMAL, não erro — se voltasse a ser erro, todo instalador
// gerado depois da mudança seria recusado pelo próprio instalador.
func TestConfigAnexada_JSONSemAgentKeyEhValido(t *testing.T) {
	caminho := anexarConfigDeTeste(t, []byte("base"), configAnexada{APIURL: "https://x.com", CompanyName: "iBReady"})

	cfg, err := lerConfigDeArquivo(t, caminho)
	if err != nil {
		t.Fatalf("bloco sem agent_key não deveria dar erro: %v", err)
	}
	if cfg == nil || cfg.APIURL != "https://x.com" || cfg.CompanyName != "iBReady" {
		t.Fatalf("config anexada lida errado: %+v", cfg)
	}
	if cfg.AgentKey != "" {
		t.Errorf("agent_key deveria vir vazio, obtive %q", cfg.AgentKey)
	}
}

func TestGerarConfigComChave_SubstituiSoAChaveEAURL(t *testing.T) {
	original := configTemplate
	t.Cleanup(func() { configTemplate = original })
	configTemplate = []byte("api_url: https://padrao.exemplo.com\nagent_key: " + placeholderAgentKey + "\ninterval_seconds: 30\n")

	saida := gerarConfigComChave("chave-real", &configAnexada{APIURL: "https://cliente.exemplo.com"})
	texto := string(saida)

	if !strings.Contains(texto, "agent_key: chave-real") {
		t.Errorf("agent_key não foi substituída: %s", texto)
	}
	if !strings.Contains(texto, "api_url: https://cliente.exemplo.com") {
		t.Errorf("api_url não foi substituída: %s", texto)
	}
	if !strings.Contains(texto, "interval_seconds: 30") {
		t.Errorf("linhas fora do escopo da substituição não deveriam mudar: %s", texto)
	}
}

func TestGerarConfigComChave_SemAPIURLMantemPadraoDoTemplate(t *testing.T) {
	original := configTemplate
	t.Cleanup(func() { configTemplate = original })
	configTemplate = []byte("api_url: https://padrao.exemplo.com\nagent_key: " + placeholderAgentKey + "\n")

	saida := gerarConfigComChave("chave-real", nil)
	texto := string(saida)

	if !strings.Contains(texto, "api_url: https://padrao.exemplo.com") {
		t.Errorf("api_url deveria continuar com o valor padrão do template: %s", texto)
	}
}

// ─────────────────────────────────────────────────────────────
// Token da empresa: flag > prompt, e nunca mais o que veio embutido no .exe
// ─────────────────────────────────────────────────────────────

func TestResolverChave_FlagTemPrioridadeSobreChaveEmbutida(t *testing.T) {
	// Instaladores gerados antes de 2026-09-17 ainda trazem agent_key colada.
	// Ela não pode voltar a valer: foi essa chave dentro do .exe que vazou no
	// VirusTotal.
	cfg := &configAnexada{AgentKey: "chave-vazada-do-exe", CompanyName: "iBReady"}

	chave, err := resolverChaveDaEmpresaDe(strings.NewReader(""), "orion_daflag", false, cfg)
	if err != nil {
		t.Fatalf("resolverChaveDaEmpresaDe: %v", err)
	}
	if chave != "orion_daflag" {
		t.Errorf("chave = %q, esperava a da flag", chave)
	}
}

func TestResolverChave_IgnoraChaveEmbutidaEUsaODigitado(t *testing.T) {
	cfg := &configAnexada{AgentKey: "chave-vazada-do-exe"}

	chave, err := resolverChaveDaEmpresaDe(strings.NewReader("orion_digitado\n"), "", false, cfg)
	if err != nil {
		t.Fatalf("resolverChaveDaEmpresaDe: %v", err)
	}
	if chave != "orion_digitado" {
		t.Errorf("chave = %q, esperava a digitada — a embutida não pode mais valer", chave)
	}
}

func TestResolverChave_SilenciosoSemFlagFalha(t *testing.T) {
	// GPO/MSI passam -agent-key=. Sem a flag e sem ninguém para digitar,
	// seguir criaria uma instalação que nunca faz check-in, e o motivo só
	// apareceria muito depois.
	if _, err := resolverChaveDaEmpresaDe(strings.NewReader(""), "", true, nil); err == nil {
		t.Fatal("esperava erro em instalação silenciosa sem -agent-key=")
	}
}

func TestResolverChave_VazioDigitadoFalha(t *testing.T) {
	if _, err := resolverChaveDaEmpresaDe(strings.NewReader("   \n"), "", false, nil); err == nil {
		t.Fatal("esperava erro quando o operador não digita nada")
	}
}

func TestResolverChave_AparaEspacosDoCopiaECola(t *testing.T) {
	chave, err := resolverChaveDaEmpresaDe(strings.NewReader("  orion_abc123  \r\n"), "", false, nil)
	if err != nil {
		t.Fatalf("resolverChaveDaEmpresaDe: %v", err)
	}
	if chave != "orion_abc123" {
		t.Errorf("chave = %q, esperava sem espaços nem CR", chave)
	}
}

// TestDevePedirToken_AutoAtualizacaoNaoPergunta protege o caminho que congela
// a frota se quebrar: a atualização remota roda este instalador com "-silent"
// e sem -agent-key=, sobre uma máquina que já tem chave. Se isso passar a
// pedir token, toda auto-atualização falha em modo silencioso.
func TestDevePedirToken_AutoAtualizacaoNaoPergunta(t *testing.T) {
	if devePedirTokenDaEmpresa("", true) {
		t.Error("atualização sobre instalação já configurada não pode pedir token")
	}
}

func TestDevePedirToken_PrimeiraInstalacaoPergunta(t *testing.T) {
	if !devePedirTokenDaEmpresa("", false) {
		t.Error("instalação nova, sem chave configurada, precisa pedir o token")
	}
}

func TestDevePedirToken_FlagSempreReaplica(t *testing.T) {
	// Troca de chave numa máquina já instalada (empresa rotacionou o token).
	if !devePedirTokenDaEmpresa("orion_nova", true) {
		t.Error("-agent-key= explícito deve reaplicar mesmo com chave já configurada")
	}
}
