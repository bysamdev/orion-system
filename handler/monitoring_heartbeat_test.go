package handler

import (
	"encoding/json"
	"testing"
)

func TestHeartbeatReqJSONDecoding(t *testing.T) {
	payload := `{
		"agent_key": "test-key",
		"machine_token": "token-123",
		"machine_uuid": "uuid-456",
		"hostname": "DESKTOP-ORION",
		"ip": "192.168.1.100",
		"os": "windows",
		"os_version": "10.0.19045",
		"agent_version": "1.2.0",
		"cpu_usage": 45.5,
		"ram_total": 16000000000,
		"ram_used": 8000000000,
		"disk_total": 500000000000,
		"disk_used": 200000000000,
		"uptime": 3600,
		"cpu_model": "Intel Core i7",
		"gpu": "NVIDIA RTX 3060",
		"domain": "CORP.LOCAL",
		"mac_address": "00:1A:2B:3C:4D:5E",
		"current_user": "CORP\\Administrator",
		"device_type": "desktop",
		"security": {
			"antivirus": [
				{"name": "Windows Defender", "active": true}
			],
			"firewall_active": true,
			"bitlocker": [
				{"mount": "C:", "status": "FullyEncrypted", "active": true}
			]
		},
		"remote_software": [
			{"name": "AnyDesk", "version": "7.0.0", "is_running": true}
		],
		"battery": {
			"has_battery": true,
			"percent": 85,
			"plugged_in": true,
			"status": "Charging"
		},
		"update_status": {
			"reboot_required": false
		}
	}`

	var req heartbeatReq
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		t.Fatalf("falha ao decodificar heartbeatReq: %v", err)
	}

	if req.Domain != "CORP.LOCAL" {
		t.Errorf("Domain = %q, esperado 'CORP.LOCAL'", req.Domain)
	}
	if req.MACAddress != "00:1A:2B:3C:4D:5E" {
		t.Errorf("MACAddress = %q, esperado '00:1A:2B:3C:4D:5E'", req.MACAddress)
	}
	if req.CurrentUser != "CORP\\Administrator" {
		t.Errorf("CurrentUser = %q, esperado 'CORP\\Administrator'", req.CurrentUser)
	}

	var sec securityData
	if err := json.Unmarshal(req.Security, &sec); err != nil {
		t.Fatalf("falha ao decodificar Security: %v", err)
	}
	if len(sec.Antivirus) != 1 || !sec.Antivirus[0].Active || sec.Antivirus[0].Name != "Windows Defender" {
		t.Errorf("Security Antivirus incorreto: %+v", sec.Antivirus)
	}
	if !sec.FirewallActive {
		t.Errorf("FirewallActive deveria ser true")
	}

	var upd updateStatusData
	if err := json.Unmarshal(req.UpdateStatus, &upd); err != nil {
		t.Fatalf("falha ao decodificar UpdateStatus: %v", err)
	}
	if upd.RebootRequired {
		t.Errorf("RebootRequired deveria ser false")
	}
}

func TestSecurityComplianceEvaluation(t *testing.T) {
	casos := []struct {
		nome                string
		secJSON             string
		updJSON             string
		esperaAlertaAV      bool
		esperaAlertaFW      bool
		esperaAlertaUpdates bool
	}{
		{
			nome: "Tudo seguro",
			secJSON: `{
				"antivirus": [{"name": "Windows Defender", "active": true}],
				"firewall_active": true
			}`,
			updJSON:             `{"reboot_required": false}`,
			esperaAlertaAV:      false,
			esperaAlertaFW:      false,
			esperaAlertaUpdates: false,
		},
		{
			nome: "Sem antivírus ativo",
			secJSON: `{
				"antivirus": [{"name": "Windows Defender", "active": false}],
				"firewall_active": true
			}`,
			updJSON:             `{"reboot_required": false}`,
			esperaAlertaAV:      true,
			esperaAlertaFW:      false,
			esperaAlertaUpdates: false,
		},
		{
			nome: "Lista de antivírus vazia",
			secJSON: `{
				"antivirus": [],
				"firewall_active": true
			}`,
			updJSON:             `{"reboot_required": false}`,
			esperaAlertaAV:      true,
			esperaAlertaFW:      false,
			esperaAlertaUpdates: false,
		},
		{
			nome: "Firewall inativo",
			secJSON: `{
				"antivirus": [{"name": "Kaspersky", "active": true}],
				"firewall_active": false
			}`,
			updJSON:             `{"reboot_required": false}`,
			esperaAlertaAV:      false,
			esperaAlertaFW:      true,
			esperaAlertaUpdates: false,
		},
		{
			nome: "Reboot pendente",
			secJSON: `{
				"antivirus": [{"name": "Windows Defender", "active": true}],
				"firewall_active": true
			}`,
			updJSON:             `{"reboot_required": true}`,
			esperaAlertaAV:      false,
			esperaAlertaFW:      false,
			esperaAlertaUpdates: true,
		},
		{
			nome: "Windows Defender ativo e outro AV inativo (sem falso positivo)",
			secJSON: `{
				"antivirus": [
					{"name": "Windows Defender", "active": true},
					{"name": "McAfee Remnant", "active": false}
				],
				"firewall_active": true
			}`,
			updJSON:             `{"reboot_required": false}`,
			esperaAlertaAV:      false,
			esperaAlertaFW:      false,
			esperaAlertaUpdates: false,
		},
		{
			nome: "Múltiplos problemas (AV inativo + Firewall inativo + Reboot pendente)",
			secJSON: `{
				"antivirus": [],
				"firewall_active": false
			}`,
			updJSON:             `{"reboot_required": true}`,
			esperaAlertaAV:      true,
			esperaAlertaFW:      true,
			esperaAlertaUpdates: true,
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			var sec securityData
			if err := json.Unmarshal([]byte(c.secJSON), &sec); err != nil {
				t.Fatalf("unmarshal security: %v", err)
			}

			hasActiveAV := false
			for _, av := range sec.Antivirus {
				if av.Active {
					hasActiveAV = true
					break
				}
			}
			alertaAV := !hasActiveAV
			if alertaAV != c.esperaAlertaAV {
				t.Errorf("alertaAV = %v, esperado %v", alertaAV, c.esperaAlertaAV)
			}

			alertaFW := !sec.FirewallActive
			if alertaFW != c.esperaAlertaFW {
				t.Errorf("alertaFW = %v, esperado %v", alertaFW, c.esperaAlertaFW)
			}

			var upd updateStatusData
			if err := json.Unmarshal([]byte(c.updJSON), &upd); err != nil {
				t.Fatalf("unmarshal update: %v", err)
			}
			alertaUpd := upd.RebootRequired
			if alertaUpd != c.esperaAlertaUpdates {
				t.Errorf("alertaUpd = %v, esperado %v", alertaUpd, c.esperaAlertaUpdates)
			}

			hasAlert := alertaAV || alertaFW || alertaUpd
			esperaAlgumAlerta := c.esperaAlertaAV || c.esperaAlertaFW || c.esperaAlertaUpdates
			if hasAlert != esperaAlgumAlerta {
				t.Errorf("hasAlert = %v, esperado %v", hasAlert, esperaAlgumAlerta)
			}
		})
	}
}
