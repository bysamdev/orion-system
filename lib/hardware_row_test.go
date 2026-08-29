package lib

import (
	"encoding/json"
	"testing"
)

// TestHardwareRowSerializaDisksComoArrayJSON cobre um bug real: Disks e
// NetworkInterfaces eram tipados como []byte puro. O encoding/json do Go
// serializa []byte como string base64 (comportamento padrão da stdlib), não
// como o array JSON que o campo realmente contém — então a resposta de
// GET /api/monitoring/machines/{id} mandava pro front-end uma string tipo
// "W3siZGV2aWNlIjoi..." em vez de [{"device":"C:",...}], e
// Array.isArray(hw.disks) no InventoryTab.tsx/MachineDrawer.tsx sempre dava
// falso — "Armazenamento & Partições"/"Interfaces de Rede" apareciam vazios
// mesmo com os dados presentes e atualizados em machine_hardware no banco
// (confirmado ao vivo: SAMUEL e NOTE_HELYCK tinham 5/2 discos e 5/4
// interfaces salvos, mas nunca chegavam legíveis no front).
//
// SecurityInfo/RemoteSoftware/BatteryInfo/UpdateStatus já usavam
// json.RawMessage corretamente — só Disks/NetworkInterfaces/RAMSlots
// escaparam desse padrão.
func TestHardwareRowSerializaDisksComoArrayJSON(t *testing.T) {
	diskJSON := []byte(`[{"device":"C:","mountpoint":"C:\\","fs_type":"NTFS","total":500000000000,"used":200000000000}]`)
	ifaceJSON := []byte(`[{"name":"Ethernet","mac":"00:1A:2B:3C:4D:5E","ips":["192.168.1.10"]}]`)

	row := HardwareRow{
		ID:                "hw-1",
		MachineID:         "machine-1",
		Disks:             diskJSON,
		NetworkInterfaces: ifaceJSON,
	}

	out, err := json.Marshal(row)
	if err != nil {
		t.Fatalf("Marshal falhou: %v", err)
	}

	var decoded struct {
		Disks             json.RawMessage `json:"disks"`
		NetworkInterfaces json.RawMessage `json:"network_interfaces"`
	}
	if err := json.Unmarshal(out, &decoded); err != nil {
		t.Fatalf("Unmarshal da resposta falhou: %v", err)
	}

	// O ponto central do teste: "disks" precisa decodificar como ARRAY JSON
	// de verdade (Array.isArray no front dá true), não como string base64.
	var disksArray []map[string]any
	if err := json.Unmarshal(decoded.Disks, &disksArray); err != nil {
		t.Fatalf("campo \"disks\" da resposta não é um array JSON válido (provável regressão do bug de base64): %v\nJSON bruto: %s", err, out)
	}
	if len(disksArray) != 1 || disksArray[0]["mountpoint"] != `C:\` {
		t.Errorf("disks decodificado incorretamente: %+v", disksArray)
	}

	var ifacesArray []map[string]any
	if err := json.Unmarshal(decoded.NetworkInterfaces, &ifacesArray); err != nil {
		t.Fatalf("campo \"network_interfaces\" da resposta não é um array JSON válido: %v\nJSON bruto: %s", err, out)
	}
	if len(ifacesArray) != 1 || ifacesArray[0]["name"] != "Ethernet" {
		t.Errorf("network_interfaces decodificado incorretamente: %+v", ifacesArray)
	}
}
