package lib

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ─── Mesclagem de máquina reinstalada ────────────────────────────────────────
//
// O machine_token é aleatório e vive no disco da máquina; formatar o Windows o
// apaga, e a reinstalação do agente chegava como máquina nova — o mesmo
// computador aparecia duas vezes no inventário (caso real: SAMUEL e
// SAM-DESKTOP). Quando um heartbeat traz um token desconhecido, procuramos o
// registro da instalação anterior pelo que sobrevive à formatação: o UUID do
// SMBIOS e o MAC da placa de rede integrada (enviados pelo agente, ver
// orion-agent/collector/board_identity.go) — ou, para registros de agentes
// antigos que não mandavam esses campos, o mac_address salvo e os MACs do
// inventário de interfaces. Achando exatamente um, o registro antigo recebe o
// token novo: histórico, alertas, aprovação e chamados continuam no mesmo id.
//
// Salvaguardas:
//   - só dentro da mesma empresa;
//   - só registro sem check-in há JanelaParaMesclarReinstalacao. A agent_key
//     está em toda máquina da empresa; sem esta trava, quem a tivesse poderia
//     forjar o MAC de uma máquina ATIVA e tomar o registro (e o login do portal)
//     dela. Máquina formatada está parada por definição;
//   - UUID de hardware ou MAC de placa-mãe já gravados e DIFERENTES dos
//     recebidos descartam o candidato (mesmo dock USB, placas diferentes);
//   - mais de um candidato = ambíguo, não mescla;
//   - MAC zerado, multicast ou administrado localmente (aleatório/virtual) e
//     UUID genérico de firmware não contam como chave.
//   Máquina rejeitada continua rejeitada: reinstalar não contorna a rejeição.

// JanelaParaMesclarReinstalacao é há quanto tempo, no mínimo, o registro
// antigo precisa estar sem check-in para ser reaproveitado. Três intervalos de
// estação (300s, ver collectionIntervalSeconds em handler/mon_handlers.go).
const JanelaParaMesclarReinstalacao = 15 * time.Minute

// NormalizarMACDeIdentidade devolve o MAC em minúsculas separado por ":", ou
// "" quando não serve para identificar o computador físico. Mesma regra do
// agente, repetida aqui porque o backend não confia no que recebe.
func NormalizarMACDeIdentidade(bruto string) string {
	limpo := strings.NewReplacer(":", "", "-", "", ".", "").Replace(strings.ToLower(strings.TrimSpace(bruto)))
	if len(limpo) != 12 {
		return ""
	}
	var octetos [6]byte
	for i := range octetos {
		v, err := strconv.ParseUint(limpo[i*2:i*2+2], 16, 8)
		if err != nil {
			return ""
		}
		octetos[i] = byte(v)
	}
	// Zerado, multicast/broadcast (bit 0x01) ou administrado localmente (bit 0x02).
	if octetos == [6]byte{} || octetos[0]&0x03 != 0 {
		return ""
	}
	partes := make([]string, len(octetos))
	for i, o := range octetos {
		partes[i] = fmt.Sprintf("%02x", o)
	}
	return strings.Join(partes, ":")
}

var uuidsGenericosDeFirmware = map[string]struct{}{
	"03000200-0400-0500-0006-000700080009": {},
	"00020003-0004-0005-0006-000700080009": {},
	"12345678-1234-5678-90ab-cddeefaabbcc": {},
}

// NormalizarUUIDDeHardware valida o UUID do SMBIOS: minúsculas, ou "" se
// malformado, todo zero, todo F ou genérico de firmware.
func NormalizarUUIDDeHardware(bruto string) string {
	u := strings.ToLower(strings.TrimSpace(bruto))
	if len(u) != 36 {
		return ""
	}
	for i, c := range u {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return ""
			}
			continue
		}
		if !strings.ContainsRune("0123456789abcdef", c) {
			return ""
		}
	}
	semHifen := strings.ReplaceAll(u, "-", "")
	if strings.Trim(semHifen, "0") == "" || strings.Trim(semHifen, "f") == "" {
		return ""
	}
	if _, generico := uuidsGenericosDeFirmware[u]; generico {
		return ""
	}
	return u
}

// chavesDeIdentidadeFisica são as chaves já validadas usadas na busca.
type chavesDeIdentidadeFisica struct {
	hardwareUUID string
	boardMAC     string
	// macs reúne board_mac e mac_address válidos, sem repetição — comparados
	// com o mac_address e as interfaces gravados do registro antigo.
	macs []string
}

func montarChavesDeIdentidade(hardwareUUID, boardMAC, macAddress string) chavesDeIdentidadeFisica {
	c := chavesDeIdentidadeFisica{
		hardwareUUID: NormalizarUUIDDeHardware(hardwareUUID),
		boardMAC:     NormalizarMACDeIdentidade(boardMAC),
	}
	for _, mac := range []string{c.boardMAC, NormalizarMACDeIdentidade(macAddress)} {
		if mac == "" {
			continue
		}
		repetido := false
		for _, m := range c.macs {
			if m == mac {
				repetido = true
				break
			}
		}
		if !repetido {
			c.macs = append(c.macs, mac)
		}
	}
	return c
}

func (c chavesDeIdentidadeFisica) vazia() bool {
	return c.hardwareUUID == "" && len(c.macs) == 0
}

const sqlCandidatosAReinstalacao = `
SELECT m.id::text, m.machine_token, m.hostname,
       CASE
         WHEN $3 <> '' AND m.hardware_uuid = $3 THEN 'hardware_uuid'
         WHEN $4 <> '' AND m.board_mac = $4 THEN 'mac_placa_mae'
         ELSE 'mac'
       END
FROM public.machines m
LEFT JOIN public.machine_hardware h ON h.machine_id = m.id
WHERE m.company_id = $1::uuid
  AND m.machine_token IS DISTINCT FROM $2
  AND COALESCE(m.last_seen, m.created_at) < now() - make_interval(secs => $6::float8)
  AND NOT ($3 <> '' AND m.hardware_uuid IS NOT NULL AND m.hardware_uuid <> $3)
  AND NOT ($4 <> '' AND m.board_mac IS NOT NULL AND m.board_mac <> $4)
  AND (
        ($3 <> '' AND m.hardware_uuid = $3)
     OR m.board_mac = ANY($5::text[])
     OR lower(m.mac_address) = ANY($5::text[])
     OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(h.interfaces) = 'array' THEN h.interfaces ELSE '[]'::jsonb END) AS i
          WHERE lower(i->>'mac') = ANY($5::text[])
        )
  )
ORDER BY COALESCE(m.last_seen, m.created_at) DESC
LIMIT 2
FOR UPDATE OF m`

// mesclarIdentidadeReinstalada roda dentro da transação de UpsertMachine,
// antes do INSERT ... ON CONFLICT (machine_token): se o token recebido é
// desconhecido e bate com a instalação anterior do mesmo computador, grava o
// token novo no registro antigo — e o upsert em seguida cai no DO UPDATE dele
// em vez de criar outra linha. Devolve o token anterior (para o chamador
// migrar o usuário-fantasma do portal) e o critério que casou.
func mesclarIdentidadeReinstalada(ctx context.Context, tx pgx.Tx, in UpsertMachineInput, chaves chavesDeIdentidadeFisica, hostnameNovo string) (tokenAnterior, criterio string, err error) {
	if strings.TrimSpace(in.MachineToken) == "" || in.CompanyID == "" || chaves.vazia() {
		return "", "", nil
	}

	var jaConhecido bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM public.machines WHERE machine_token = $1)`, in.MachineToken).Scan(&jaConhecido); err != nil {
		return "", "", fmt.Errorf("checar token conhecido: %w", err)
	}
	if jaConhecido {
		return "", "", nil
	}

	macs := chaves.macs
	if macs == nil {
		macs = []string{}
	}
	rows, err := tx.Query(ctx, sqlCandidatosAReinstalacao,
		in.CompanyID, in.MachineToken, chaves.hardwareUUID, chaves.boardMAC, macs, JanelaParaMesclarReinstalacao.Seconds())
	if err != nil {
		return "", "", fmt.Errorf("buscar instalação anterior: %w", err)
	}
	type candidato struct {
		id, token, hostname, criterio string
	}
	var candidatos []candidato
	for rows.Next() {
		var c candidato
		var token *string
		if err := rows.Scan(&c.id, &token, &c.hostname, &c.criterio); err != nil {
			rows.Close()
			return "", "", err
		}
		if token != nil {
			c.token = *token
		}
		candidatos = append(candidatos, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return "", "", err
	}

	switch len(candidatos) {
	case 0:
		return "", "", nil
	case 1:
	default:
		log.Printf("[AVISO] identidade nova de %q (empresa %s) bate com mais de uma máquina parada — mesclagem não aplicada por ambiguidade", hostnameNovo, in.CompanyID)
		return "", "", nil
	}

	anterior := candidatos[0]
	if _, err := tx.Exec(ctx, `UPDATE public.machines SET machine_token = $2 WHERE id = $1::uuid`, anterior.id, in.MachineToken); err != nil {
		return "", "", fmt.Errorf("aplicar token novo à máquina %s: %w", anterior.id, err)
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO public.machine_identity_merges (machine_id, criterio, hostname_anterior, hostname_novo)
VALUES ($1::uuid, $2, $3, $4)`, anterior.id, anterior.criterio, anterior.hostname, hostnameNovo); err != nil {
		return "", "", fmt.Errorf("registrar mesclagem da máquina %s: %w", anterior.id, err)
	}
	return anterior.token, anterior.criterio, nil
}
