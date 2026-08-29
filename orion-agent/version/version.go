// Package version centraliza a versão do binário do Orion Agent.
//
// Fica em pacote próprio (em vez de main ou service) porque main.go e
// service/windows.go precisam do valor e main já importa service — um
// const em qualquer um dos dois criaria import cycle ou obrigaria o outro a
// depender de main.
package version

// Version é reportada em cada heartbeat (campo agent_version) para o
// backend identificar agentes desatualizados na tela de Inventário de
// Dispositivos. Antes desta introdução o campo nunca era preenchido pelo
// agente — heartbeatReq.AgentVersion sempre chegava vazio no backend.
//
// var, não const (Fase 2 do plano de escalabilidade — "agente deve reportar
// versão", de forma que o número realmente mude a cada release): sem
// Makefile/CI neste repositório para automatizar a injeção, o valor abaixo
// é o fallback para quem compilar sem passar -ldflags — mas o build oficial
// (installer-msi/build.ps1) deve injetar a versão real do release via:
//
//	go build -ldflags "-X orion-agent/version.Version=1.2.3" -o orion-agent.exe .
//
// Sem isso, todo binário compilado continua reportando o mesmo valor até
// alguém editar este arquivo manualmente — o problema que esta correção
// resolve é permitir a injeção, não obrigar seu uso.
var Version = "1.0.0"
