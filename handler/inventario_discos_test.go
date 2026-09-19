package handler

import (
	"encoding/json"
	"testing"
)

func TestArredondarUsoDosDiscos_MudancaPequenaNaoMudaOInventario(t *testing.T) {
	antes := arredondarUsoDosDiscos(json.RawMessage(`[{"device":"C:","total":254920355840,"used":136775553024,"media_type":"SSD"}]`))
	depois := arredondarUsoDosDiscos(json.RawMessage(`[{"device":"C:","total":254920355840,"used":136775600000,"media_type":"SSD"}]`))
	if string(antes) != string(depois) {
		t.Errorf("alguns KB de diferença mudaram o inventário:\n%s\n%s", antes, depois)
	}
	var p []map[string]any
	_ = json.Unmarshal(antes, &p)
	if p[0]["used"].(float64) != 127*umGiB || p[0]["total"].(float64) != 254920355840 || p[0]["media_type"] != "SSD" {
		t.Errorf("partição = %v", p[0])
	}
}

func TestArredondarUsoDosDiscos_MudancaDeUmGBAparece(t *testing.T) {
	a := arredondarUsoDosDiscos(json.RawMessage(`[{"used":10737418240}]`))
	b := arredondarUsoDosDiscos(json.RawMessage(`[{"used":12884901888}]`))
	if string(a) == string(b) {
		t.Error("2 GB de diferença não mudaram o inventário")
	}
}

func TestArredondarUsoDosDiscos_FormatoInesperadoVoltaIntacto(t *testing.T) {
	for _, bruto := range []string{``, `null`, `{"x":1}`, `[1,2]`, `nao-json`} {
		if got := string(arredondarUsoDosDiscos(json.RawMessage(bruto))); got != bruto {
			t.Errorf("%q virou %q", bruto, got)
		}
	}
}

func TestNormalizarOrdem_MesmaListaEmOutraOrdemDaOMesmoTexto(t *testing.T) {
	a := normalizarOrdem(json.RawMessage(`{"antivirus":[{"name":"Windows Defender","active":false},{"name":"Kaspersky","active":true}],"firewall_active":true}`))
	b := normalizarOrdem(json.RawMessage(`{"firewall_active":true,"antivirus":[{"active":true,"name":"Kaspersky"},{"name":"Windows Defender","active":false}]}`))
	if string(a) != string(b) {
		t.Errorf("ordem diferente gerou texto diferente:\n%s\n%s", a, b)
	}
	d1 := normalizarOrdem(arredondarUsoDosDiscos(json.RawMessage(`[{"device":"C:","used":10737418240},{"device":"G:","used":1},{"device":"D:","used":2}]`)))
	d2 := normalizarOrdem(arredondarUsoDosDiscos(json.RawMessage(`[{"device":"D:","used":3},{"device":"C:","used":10737418241},{"device":"G:","used":0}]`)))
	if string(d1) != string(d2) {
		t.Errorf("discos em outra ordem mudaram o inventário:\n%s\n%s", d1, d2)
	}
}

func TestNormalizarOrdem_NaoPerdeNemInventaElementos(t *testing.T) {
	var saida []map[string]any
	_ = json.Unmarshal(normalizarOrdem(json.RawMessage(`[{"n":"b"},{"n":"a"},{"n":"c"}]`)), &saida)
	if len(saida) != 3 || saida[0]["n"] != "a" || saida[1]["n"] != "b" || saida[2]["n"] != "c" {
		t.Errorf("saída = %v", saida)
	}
	for _, bruto := range []string{``, `null`, `nao-json`} {
		if got := string(normalizarOrdem(json.RawMessage(bruto))); got != bruto {
			t.Errorf("%q virou %q", bruto, got)
		}
	}
}
