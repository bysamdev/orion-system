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
