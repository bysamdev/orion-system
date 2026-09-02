// Package version centraliza a versão do binário do Orion Agent.
//
// Fica em pacote próprio (em vez de main ou service) porque main.go e
// service/windows.go precisam do valor e main já importa service — um
// const em qualquer um dos dois criaria import cycle ou obrigaria o outro a
// depender de main.
package version

// Version é reportada em cada heartbeat (campo agent_version). O backend
// compara isto com lib.LatestAgentVersion (orion-api, módulo separado —
// bump os dois juntos) pra decidir se enfileira uma auto-atualização pra
// essa máquina (ver monitoringHeartbeat/enfileirarAutoUpdateSeNecessario).
//
// var, não const: permite override em build via
//
//	go build -ldflags "-X orion-agent/version.Version=1.2.3" -o orion-agent.exe .
//
// (ver installer-msi/build.ps1). Sem -ldflags, o binário reporta o valor
// abaixo — mantenha-o em sincronia com o release real ao dar bump.
var Version = "1.1.27"
