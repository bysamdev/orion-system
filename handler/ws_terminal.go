package handler

// ws_terminal.go — ponte WebSocket do terminal remoto (browser ⇄ agente).
//
// SEGURANÇA: antes desta correção, os dois handlers deste arquivo davam um
// shell interativo (`cmd.exe`) na máquina do cliente para QUALQUER pessoa na
// internet que soubesse um machine_id — não havia requireAuth, nem chave de
// agente, nem escopo de empresa, e o CheckOrigin devolvia true para toda
// origem. Agora:
//
//   /api/ws/terminal        exige token do Supabase Auth + a máquina precisa
//                           ser da empresa do usuário, com papel privilegiado
//   /api/ws/terminal/agent  exige X-Agent-Key e a chave precisa ser da mesma
//                           empresa da máquina
//
// O token do browser viaja no header Sec-WebSocket-Protocol, não na query
// string: a API WebSocket do navegador não permite header Authorization, e um
// ?token= apareceria no middleware.Logger e nos access logs do proxy.

import (
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"orion-api/lib"
)

const (
	// subprotocoloBearer é o valor sentinela que o frontend manda como primeiro
	// item de Sec-WebSocket-Protocol; o segundo item é o access token.
	subprotocoloBearer = "orion-bearer"

	prazoLeitura  = 90 * time.Second
	prazoEscrita  = 10 * time.Second
	intervaloPing = 30 * time.Second
)

var upgrader = websocket.Upgrader{
	// Só aceita handshake vindo de uma origem da allowlist (a mesma do CORS).
	// Sem isto, qualquer site aberto numa outra aba abria um shell na máquina
	// do cliente aproveitando a sessão da vítima (Cross-Site WebSocket
	// Hijacking).
	//
	// Requisição sem Origin (o agente Windows, curl) não é cross-origin — o
	// navegador sempre manda Origin, então a ausência indica cliente nativo.
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		return corsAllowlist[origin]
	},
}

// SafeConn serializa as escritas num *websocket.Conn.
//
// Necessário porque cada conexão tem dois escritores possíveis: o forwarder do
// outro lado da ponte e o ping do keepalive. A gorilla/websocket não permite
// WriteMessage concorrente.
type SafeConn struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

func (s *SafeConn) WriteMessage(messageType int, data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.conn.SetWriteDeadline(time.Now().Add(prazoEscrita))
	return s.conn.WriteMessage(messageType, data)
}

func (s *SafeConn) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.Close()
}

func (s *SafeConn) ReadMessage() (int, []byte, error) {
	return s.conn.ReadMessage()
}

type TerminalHub struct {
	mu       sync.Mutex
	browsers map[string]*SafeConn
	agents   map[string]*SafeConn
}

var termHub = &TerminalHub{
	browsers: make(map[string]*SafeConn),
	agents:   make(map[string]*SafeConn),
}

// registrar guarda a conexão, derrubando a anterior da mesma máquina.
func (h *TerminalHub) registrar(lado map[string]*SafeConn, machineID string, c *SafeConn) {
	h.mu.Lock()
	if antiga, ok := lado[machineID]; ok {
		antiga.Close()
	}
	lado[machineID] = c
	h.mu.Unlock()
}

// desregistrar remove a conexão, mas só se ainda for a corrente — uma conexão
// mais nova pode já ter tomado o lugar.
func (h *TerminalHub) desregistrar(lado map[string]*SafeConn, machineID string, c *SafeConn) {
	h.mu.Lock()
	if lado[machineID] == c {
		delete(lado, machineID)
	}
	h.mu.Unlock()
}

func (h *TerminalHub) parceiro(lado map[string]*SafeConn, machineID string) *SafeConn {
	h.mu.Lock()
	defer h.mu.Unlock()
	return lado[machineID]
}

// bombear encaminha tudo que chega em `origem` para o outro lado da ponte, até
// a conexão morrer.
//
// O deadline de leitura somado ao ping periódico é o que impede vazamento de
// goroutine: sem eles, um cliente que some sem fechar o TCP (queda de rede,
// notebook fechado) deixaria ReadMessage bloqueado para sempre, segurando a
// goroutine e o *websocket.Conn até o processo morrer.
func bombear(origem *SafeConn, destino func() *SafeConn) {
	_ = origem.conn.SetReadDeadline(time.Now().Add(prazoLeitura))
	origem.conn.SetPongHandler(func(string) error {
		return origem.conn.SetReadDeadline(time.Now().Add(prazoLeitura))
	})

	sessaoInicio := time.Now()
	maxSessao := 60 * time.Minute
	maxInatividade := 15 * time.Minute
	ultimoInput := time.Now()

	pararPing := make(chan struct{})
	defer close(pararPing)
	go func() {
		t := time.NewTicker(intervaloPing)
		defer t.Stop()
		for {
			select {
			case <-t.C:
				if time.Since(sessaoInicio) > maxSessao || time.Since(ultimoInput) > maxInatividade {
					_ = origem.Close()
					return
				}
				if err := origem.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-pararPing:
				return
			}
		}
	}()

	for {
		messageType, data, err := origem.ReadMessage()
		if err != nil {
			return
		}
		ultimoInput = time.Now()
		if time.Since(sessaoInicio) > maxSessao {
			return
		}
		_ = origem.conn.SetReadDeadline(time.Now().Add(prazoLeitura))

		if d := destino(); d != nil {
			if err := d.WriteMessage(messageType, data); err != nil {
				return
			}
		}
	}
}

// autorizarTerminalBrowser valida o token do Supabase vindo no subprotocolo e
// confirma que o usuário pode abrir shell NESTA máquina.
//
// Falha fechado: qualquer erro devolve false e a conexão nem chega a ser
// promovida a WebSocket.
func autorizarTerminalBrowser(w http.ResponseWriter, r *http.Request, machineID string) bool {
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
		http.Error(w, "não foi possível resolver sua empresa", http.StatusForbidden)
		return false
	}

	machine, err := db.MachineByID(r.Context(), machineID)
	if err != nil {
		http.Error(w, "máquina não encontrada", http.StatusNotFound)
		return false
	}
	if !escopo.PodeVerEmpresa(machine.CompanyID) {
		http.Error(w, "acesso restrito: máquina não pertence à sua empresa", http.StatusForbidden)
		return false
	}

	// Shell remoto é a operação mais privilegiada do RMM — mesmo conjunto de
	// papéis exigido por monitoringCreateCommand, que é quem enfileira o
	// 'orion-start-terminal' que dispara esta sessão.
	if !escopo.Global() && escopo.Role != "admin" && escopo.Role != "technician" {
		http.Error(w, "acesso restrito: apenas administradores e técnicos podem abrir terminal remoto", http.StatusForbidden)
		return false
	}

	// Se o usuário possui 2FA configurado, exige autenticação de segundo fator (aal2)
	if len(user.Factors) > 0 && user.AAL != "aal2" {
		http.Error(w, "não autorizado: MFA (AAL2) obrigatório para terminal remoto", http.StatusForbidden)
		return false
	}

	// Registro de auditoria obrigatório: uma sessão de shell remoto sem
	// trilha de quem/quando/onde não deve existir. Falha fechado — se o
	// registro não puder ser gravado, a sessão não abre (não é best-effort).
	if err := db.RegistrarSessaoTerminalRemoto(r.Context(), machineID, machine.CompanyID, user.ID); err != nil {
		log.Printf("[AUDITORIA] falha ao registrar sessão de terminal remoto (machine=%s, user=%s): %v", machineID, user.ID, err)
		http.Error(w, "não foi possível registrar a sessão — tente novamente", http.StatusInternalServerError)
		return false
	}

	return true
}

// autorizarTerminalAgente valida a X-Agent-Key e confirma que ela pertence à
// mesma empresa da máquina anunciada.
func autorizarTerminalAgente(w http.ResponseWriter, r *http.Request, machineID string) bool {
	if db == nil {
		http.Error(w, "serviço indisponível", http.StatusServiceUnavailable)
		return false
	}

	chaveEmpresaID, err := lib.ValidateAgentKey(r, cfg.AgentKey, db)
	if err != nil {
		http.Error(w, "não autorizado: "+err.Error(), http.StatusUnauthorized)
		return false
	}

	// Chave específica de empresa não pode anunciar máquina de outra empresa.
	// "global" é a chave de administração e segue irrestrita.
	if chaveEmpresaID != "" && chaveEmpresaID != "global" {
		machine, err := db.MachineByID(r.Context(), machineID)
		if err != nil {
			http.Error(w, "máquina não encontrada", http.StatusNotFound)
			return false
		}
		if machine.CompanyID == nil || *machine.CompanyID != chaveEmpresaID {
			http.Error(w, "máquina não pertence à empresa desta chave de agente", http.StatusForbidden)
			return false
		}
	}

	return true
}

// WsTerminalBrowserHandler liga o navegador do técnico à ponte do terminal.
func WsTerminalBrowserHandler(w http.ResponseWriter, r *http.Request) {
	machineID := r.URL.Query().Get("machine_id")
	if machineID == "" {
		http.Error(w, "missing machine_id", http.StatusBadRequest)
		return
	}

	if !autorizarTerminalBrowser(w, r, machineID) {
		return
	}

	// Ecoa o subprotocolo: o navegador aborta o handshake se o servidor não
	// confirmar um dos protocolos oferecidos.
	conn, err := upgrader.Upgrade(w, r, http.Header{
		"Sec-WebSocket-Protocol": {subprotocoloBearer},
	})
	if err != nil {
		log.Println("browser ws upgrade error:", err)
		return
	}
	safeConn := &SafeConn{conn: conn}
	defer safeConn.Close()

	termHub.registrar(termHub.browsers, machineID, safeConn)
	defer termHub.desregistrar(termHub.browsers, machineID, safeConn)

	bombear(safeConn, func() *SafeConn { return termHub.parceiro(termHub.agents, machineID) })
}

// WsTerminalAgentHandler liga o agente Windows à ponte do terminal.
func WsTerminalAgentHandler(w http.ResponseWriter, r *http.Request) {
	machineID := r.URL.Query().Get("machine_id")
	if machineID == "" {
		http.Error(w, "missing machine_id", http.StatusBadRequest)
		return
	}

	if !autorizarTerminalAgente(w, r, machineID) {
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("agent ws upgrade error:", err)
		return
	}
	safeConn := &SafeConn{conn: conn}
	defer safeConn.Close()

	termHub.registrar(termHub.agents, machineID, safeConn)
	defer termHub.desregistrar(termHub.agents, machineID, safeConn)

	bombear(safeConn, func() *SafeConn { return termHub.parceiro(termHub.browsers, machineID) })
}
