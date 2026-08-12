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
const Version = "1.0.0"
