package lib

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"testing"
)

func TestMontarInstaladorPersonalizado_AnexaMarcadorTamanhoEJSON(t *testing.T) {
	out, err := MontarInstaladorPersonalizado("chave-123", "https://orion.exemplo.com", "iBReady")
	if err != nil {
		t.Fatalf("MontarInstaladorPersonalizado: %v", err)
	}

	if !bytes.HasPrefix(out, instaladorGenerico) {
		t.Fatal("saída não começa com os bytes do instalador genérico embutido")
	}

	// LastIndex, não Index: o instalador genérico já contém o marcador uma
	// vez dentro de si mesmo (é uma string literal no próprio código-fonte
	// compilado de selfconfig.go — o programa precisa saber o que
	// procurar). O leitor real (lerConfigAnexada, no módulo do agente)
	// também usa LastIndex por isso mesmo; o teste precisa espelhar essa
	// mesma lógica pra validar o caminho real.
	idx := bytes.LastIndex(out, marcadorConfigInstalador)
	if idx == -1 {
		t.Fatal("marcador não encontrado na saída")
	}
	if idx != len(instaladorGenerico) {
		t.Errorf("marcador anexado não está logo após o fim do instalador genérico: idx=%d, len(instaladorGenerico)=%d", idx, len(instaladorGenerico))
	}

	inicioTamanho := idx + len(marcadorConfigInstalador)
	tamanho := binary.BigEndian.Uint32(out[inicioTamanho : inicioTamanho+4])
	inicioJSON := inicioTamanho + 4
	payload := out[inicioJSON : inicioJSON+int(tamanho)]

	var cfg configInstaladorAnexada
	if err := json.Unmarshal(payload, &cfg); err != nil {
		t.Fatalf("decodificar JSON anexado: %v", err)
	}
	if cfg.AgentKey != "chave-123" || cfg.APIURL != "https://orion.exemplo.com" || cfg.CompanyName != "iBReady" {
		t.Errorf("config anexada = %+v; esperava chave-123/https://orion.exemplo.com/iBReady", cfg)
	}
	if len(out) != inicioJSON+int(tamanho) {
		t.Errorf("sobrou %d bytes depois do JSON — esperado nada além do payload", len(out)-(inicioJSON+int(tamanho)))
	}
}

func TestSanitizarNomeArquivo(t *testing.T) {
	casos := map[string]string{
		"iBReady":            "iBReady",
		"iBReady Ltda.":      "iBReady Ltda.",
		`Cliente/Teste`:      "Cliente-Teste",
		`C:\Windows`:         "C--Windows",
		`"Aspas" <e> outros`: "-Aspas- -e- outros",
		"":                   "empresa",
		"   ":                "empresa",
	}
	for in, want := range casos {
		if got := SanitizarNomeArquivo(in); got != want {
			t.Errorf("SanitizarNomeArquivo(%q) = %q; esperado %q", in, got, want)
		}
	}
}
