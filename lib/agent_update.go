package lib

import "fmt"

// LatestAgentVersion precisa bater byte-a-byte com orion-agent/version/
// version.go:Version — os dois módulos Go são separados (não dá pra
// importar a constante direto), então o valor é duplicado de propósito nos
// dois lados, igual o marcador de config do instalador. Bump os dois juntos
// sempre que orion-agent for reconstruído e reembutido nos assets.
//
// monitoringHeartbeat compara isto com o agent_version que cada máquina
// reporta; quando não bate, enfileira um comando de auto-atualização pra
// ela sozinha (ver ComandoAutoUpdate).
const LatestAgentVersion = "1.1.26"

// ComandoAutoUpdate monta o texto do comando "orion-install" que o agente
// já sabe interpretar (ver orion-agent/service/windows.go
// parseOrionInstallArgs) — baixa o .exe da URL, confere o SHA-256 antes de
// rodar, e roda com -silent (sem prompt, sem esperar ninguém apertar
// ENTER). O marcador --auto-update="true" no final não é lido pelo agente
// (parseOrionInstallArgs só procura --url/--hash/--args) — é só uma tag
// pra HasPendingUpdateCommand reconhecer isto como uma auto-atualização
// gerada pelo backend, não um orion-install manual.
func ComandoAutoUpdate(downloadURL, sha256Hex string) string {
	return fmt.Sprintf(`orion-install --url=%q --hash=%q --args="-silent" %s`, downloadURL, sha256Hex, marcadorAutoUpdate)
}
