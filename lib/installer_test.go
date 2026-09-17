package lib

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"testing"
)

func TestMontarInstaladorPersonalizado_AnexaMarcadorTamanhoEJSON(t *testing.T) {
	out, err := MontarInstaladorPersonalizado("https://orion.exemplo.com", "iBReady")
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
	if cfg.APIURL != "https://orion.exemplo.com" || cfg.CompanyName != "iBReady" {
		t.Errorf("config anexada = %+v; esperava https://orion.exemplo.com/iBReady", cfg)
	}

	// A credencial da empresa não pode entrar no bloco anexado. É o teste que
	// impede alguém de reintroduzir o embutimento que causou o incidente do
	// VirusTotal: um .exe distribuído carregando a chave é uma chave
	// publicada.
	//
	// A checagem é no PAYLOAD, não no binário inteiro: o instalador genérico
	// contém a string "agent_key" no template do agent.yaml que ele mesmo
	// grava, e olhar o arquivo todo daria falso positivo eterno.
	if bytes.Contains(payload, []byte("agent_key")) {
		t.Errorf("o bloco anexado não pode conter agent_key: %s", payload)
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
