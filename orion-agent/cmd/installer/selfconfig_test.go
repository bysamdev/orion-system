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

func TestConfigAnexada_JSONSemAgentKeyDaErro(t *testing.T) {
	caminho := anexarConfigDeTeste(t, []byte("base"), configAnexada{APIURL: "https://x.com"})
	if _, err := lerConfigDeArquivo(t, caminho); err == nil {
		t.Fatal("esperava erro para agent_key vazio")
	}
}

func TestGerarConfigComChave_SubstituiSoAChaveEAURL(t *testing.T) {
	original := configTemplate
	t.Cleanup(func() { configTemplate = original })
	configTemplate = []byte("api_url: https://padrao.exemplo.com\nagent_key: " + placeholderAgentKey + "\ninterval_seconds: 30\n")

	saida := gerarConfigComChave(&configAnexada{AgentKey: "chave-real", APIURL: "https://cliente.exemplo.com"})
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

	saida := gerarConfigComChave(&configAnexada{AgentKey: "chave-real"})
	texto := string(saida)

	if !strings.Contains(texto, "api_url: https://padrao.exemplo.com") {
		t.Errorf("api_url deveria continuar com o valor padrão do template: %s", texto)
	}
}
