// ws_system_graph.go — hub de broadcast do grafo ao vivo da arquitetura
// (Live System Graph). Mesma arquitetura de conexão de handler/ws_terminal.go
// (upgrade, CheckOrigin restrito à allowlist, subprotocolo pra token), mas
// broadcast 1-para-N em vez da ponte 1-para-1 do terminal: aqui não há
// "outro lado" pra emparelhar, todo cliente conectado recebe todo evento.
//
// Hoje o hub só emite eventos SIMULADOS (ver simularEventos), no mesmo
// formato JSON que uma instrumentação real usaria depois — trocar mock por
// real é plugar emissores reais e apagar simularEventos, sem tocar no
// frontend (o contrato SystemEvent não muda).

package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	mrand "math/rand/v2"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// systemGraphEvent espelha src/lib/systemGraph/types.ts — manter os dois em sincronia.
type systemGraphEvent struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	EdgeID    string `json:"edge_id"`
	Status    string `json:"status"` // "processing" | "success" | "error"
}

// edgesSimulaveis espelha um subconjunto real de ARCH_EDGES em
// src/lib/systemGraph/architecture.ts — os ids de edge "mais interessantes"
// (fluxos de requisição reais), usados só pelo gerador simulado abaixo.
var edgesSimulaveis = []string{
	"e-dashboard-api-tickets",
	"e-monitoring-api-monitoring",
	"e-infra-api-monitoring",
	"e-admin-api-functions",
	"e-kb-ai-search",
	"e-api-functions-fn",
	"e-api-monitoring-mon",
	"e-api-tickets-ticket",
	"e-fn-lib-db",
	"e-mon-lib-db",
	"e-libdb-postgres",
	"e-ws-terminal-agent",
	"e-svc-create-user-resend",
	"e-svc-email-ticket-db",
	"e-uptime-uptimerobot",
	"e-ai-kb-db",
}

type SystemGraphHub struct {
	mu      sync.Mutex
	clients map[*SafeConn]bool
}

var graphHub = &SystemGraphHub{clients: make(map[*SafeConn]bool)}

func (h *SystemGraphHub) register(c *SafeConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = true
}

func (h *SystemGraphHub) unregister(c *SafeConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
}

func (h *SystemGraphHub) isRegistered(c *SafeConn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.clients[c]
}

// broadcast copia a lista de clientes sob o lock e escreve fora dele: cada
// WriteMessage é uma syscall de rede com deadline de 10s (SafeConn), e
// segurar o mutex durante a escrita deixaria um único cliente lento travando
// todo register/unregister/broadcast concorrente por até esse tempo.
func (h *SystemGraphHub) broadcast(payload []byte) {
	h.mu.Lock()
	conexoes := make([]*SafeConn, 0, len(h.clients))
	for c := range h.clients {
		conexoes = append(conexoes, c)
	}
	h.mu.Unlock()

	for _, c := range conexoes {
		if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
			// Falha de escrita: a leitura desse cliente (em WsSystemGraphHandler)
			// vai detectar a conexão morta e desregistrar — não fazemos isso
			// aqui pra não desregistrar durante a iteração da lista.
			continue
		}
	}
}

// autorizarSystemGraph valida o token do Supabase vindo no subprotocolo e
// confirma que o papel do usuário pode ver o mapa de arquitetura.
//
// Falha fechado: qualquer erro devolve false e a conexão nem chega a ser
// promovida a WebSocket. Não há checagem de empresa/máquina aqui — ao
// contrário do terminal remoto, o grafo representa a arquitetura do próprio
// Orion System, não dado de uma empresa cliente específica.
func autorizarSystemGraph(w http.ResponseWriter, r *http.Request) bool {
	token := ""
	for _, p := range websocket.Subprotocols(r) {
		if p != subprotocoloBearer && strings.TrimSpace(p) != "" {
			token = strings.TrimSpace(p)
		}
	}
	if token == "" {
		http.Error(w, "não autorizado: token ausente", http.StatusUnauthorized)
		return false
	}

	if db == nil || sb == nil {
		http.Error(w, "serviço indisponível", http.StatusServiceUnavailable)
		return false
	}

	user, err := sb.GetUserByAccessToken(r.Context(), token)
	if err != nil {
		http.Error(w, "não autorizado: token inválido ou expirado", http.StatusUnauthorized)
		return false
	}

	escopo, err := db.UserScopeByID(r.Context(), user.ID)
	if err != nil {
		http.Error(w, "não foi possível verificar permissões do usuário", http.StatusForbidden)
		return false
	}

	if !escopo.Global() && escopo.Role != "admin" && escopo.Role != "technician" {
		http.Error(w, "acesso restrito: apenas administradores, desenvolvedores e técnicos podem ver o mapa de arquitetura", http.StatusForbidden)
		return false
	}

	return true
}

func randomEventID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// simularEventos roda em background enquanto houver clientes conectados,
// emitindo um SystemEvent plausível a cada 1-3s em uma edge real do catálogo.
func simularEventos(hub *SystemGraphHub, pararEm <-chan struct{}) {
	ticker := time.NewTicker(1500 * time.Millisecond)
	defer ticker.Stop()

	statusSequence := []string{"processing", "success"}
	for {
		select {
		case <-pararEm:
			return
		case <-ticker.C:
			edgeID := edgesSimulaveis[mrand.IntN(len(edgesSimulaveis))]
			status := statusSequence[mrand.IntN(len(statusSequence))]
			if mrand.IntN(20) == 0 {
				status = "error" // erro ocasional, pra exercitar o estado visual de erro
			}
			evt := systemGraphEvent{
				ID:        randomEventID(),
				Timestamp: time.Now().UTC().Format(time.RFC3339),
				EdgeID:    edgeID,
				Status:    status,
			}
			payload, err := json.Marshal(evt)
			if err != nil {
				continue
			}
			hub.broadcast(payload)
		}
	}
}

var (
	simMu      sync.Mutex
	simRunning bool
	simStop    chan struct{}
)

// garantirSimulador inicia o simulador compartilhado se ainda não estiver
// rodando. Idempotente: com N clientes conectados, deve existir exatamente
// UM ticker emitindo pro hub, não um por conexão (senão o fan-out vira
// O(N²) — cada cliente veria N× a taxa de eventos pretendida).
func garantirSimulador(hub *SystemGraphHub) {
	simMu.Lock()
	defer simMu.Unlock()
	if simRunning {
		return
	}
	simRunning = true
	simStop = make(chan struct{})
	go simularEventos(hub, simStop)
}

// pararSimuladorSeVazio para o simulador compartilhado quando o último
// cliente já desconectou (chamar depois de hub.unregister).
func pararSimuladorSeVazio(hub *SystemGraphHub) {
	simMu.Lock()
	defer simMu.Unlock()
	if !simRunning {
		return
	}
	hub.mu.Lock()
	vazio := len(hub.clients) == 0
	hub.mu.Unlock()
	if vazio {
		close(simStop)
		simRunning = false
	}
}

// WsSystemGraphHandler liga o navegador ao hub de broadcast do grafo.
func WsSystemGraphHandler(w http.ResponseWriter, r *http.Request) {
	if !autorizarSystemGraph(w, r) {
		return
	}

	conn, err := upgrader.Upgrade(w, r, http.Header{
		"Sec-WebSocket-Protocol": {subprotocoloBearer},
	})
	if err != nil {
		log.Println("system-graph ws upgrade error:", err)
		return
	}
	safeConn := &SafeConn{conn: conn}
	defer safeConn.Close()

	graphHub.register(safeConn)
	garantirSimulador(graphHub)
	// unregister precisa terminar antes de pararSimuladorSeVazio checar
	// len(hub.clients) — por isso os dois vivem no mesmo defer, em vez de
	// dois defer separados: defers em Go rodam em ordem LIFO (o último a
	// ser "deferido" roda primeiro), então dois `defer` distintos aqui
	// executariam nessa ordem trocada e o simulador nunca pararia depois
	// do último cliente sair.
	defer func() {
		graphHub.unregister(safeConn)
		pararSimuladorSeVazio(graphHub)
	}()

	// O cliente não manda nada relevante — só lemos pra detectar
	// desconexão (o navegador fecha o TCP) e responder a pings, mesmo
	// padrão de deadline/keepalive do ws_terminal.go.
	_ = safeConn.conn.SetReadDeadline(time.Now().Add(prazoLeitura))
	safeConn.conn.SetPongHandler(func(string) error {
		return safeConn.conn.SetReadDeadline(time.Now().Add(prazoLeitura))
	})
	for {
		if _, _, err := safeConn.ReadMessage(); err != nil {
			return
		}
		_ = safeConn.conn.SetReadDeadline(time.Now().Add(prazoLeitura))
	}
}
