package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os/exec"

	"github.com/gorilla/websocket"
)

type ResizeMessage struct {
	Cols int `json:"cols"`
	Rows int `json:"rows"`
}

// StartRemoteTerminalSession inicia uma sessão de terminal remoto conectando-se ao servidor via WebSocket
func (s *Svc) StartRemoteTerminalSession() {
	machineID := s.getMachineID()
	if machineID == "" {
		s.logger.Println("[TERMINAL] Impossível iniciar terminal sem machineID")
		return
	}

	u, err := url.Parse(s.cfg.APIURL)
	if err != nil {
		s.logger.Printf("[TERMINAL] APIURL inválida: %v", err)
		return
	}

	scheme := "ws"
	if u.Scheme == "https" {
		scheme = "wss"
	}
	wsURL := fmt.Sprintf("%s://%s/api/ws/terminal/agent?machine_id=%s", scheme, u.Host, machineID)

	s.logger.Printf("[TERMINAL] Conectando ao terminal remoto: %s", wsURL)

	// O servidor exige X-Agent-Key neste endpoint e confere se a chave pertence
	// à mesma empresa da máquina anunciada. Antes desta correção o dial ia sem
	// header nenhum e qualquer um podia se passar pelo agente desta máquina.
	cabecalhos := http.Header{}
	cabecalhos.Set("X-Agent-Key", s.cfg.AgentKey)

	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, cabecalhos)
	if err != nil {
		if resp != nil {
			s.logger.Printf("[TERMINAL] Erro ao conectar no WS: %v (HTTP %s)", err, resp.Status)
			resp.Body.Close()
		} else {
			s.logger.Printf("[TERMINAL] Erro ao conectar no WS: %v", err)
		}
		return
	}
	defer conn.Close()

	cmd := exec.Command("cmd.exe")
	
	stdin, err := cmd.StdinPipe()
	if err != nil {
		s.logger.Printf("[TERMINAL] Erro ao obter StdinPipe: %v", err)
		return
	}
	
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		s.logger.Printf("[TERMINAL] Erro ao obter StdoutPipe: %v", err)
		return
	}
	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		s.logger.Printf("[TERMINAL] Erro ao iniciar processo: %v", err)
		return
	}

	// Ler do Stdout e escrever no WebSocket
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := stdout.Read(buf)
			if err != nil {
				if err != io.EOF {
					s.logger.Printf("[TERMINAL] Erro lendo stdout: %v", err)
				}
				break
			}
			if err := conn.WriteMessage(websocket.TextMessage, buf[:n]); err != nil {
				s.logger.Printf("[TERMINAL] Erro enviando stdout pro WS: %v", err)
				break
			}
		}
	}()

	// Ler do WebSocket e escrever no Stdin
	for {
		mt, data, err := conn.ReadMessage()
		if err != nil {
			s.logger.Printf("[TERMINAL] WS fechado ou erro de leitura: %v", err)
			break
		}

		if mt == websocket.TextMessage || mt == websocket.BinaryMessage {
			// Tentar decodificar frame de resize
			var resize ResizeMessage
			if err := json.Unmarshal(data, &resize); err == nil && resize.Cols > 0 {
				s.logger.Printf("[TERMINAL] Redimensionamento para cols=%d rows=%d", resize.Cols, resize.Rows)
				// Em Windows standard pipes não é trivial redimensionar, mas capturamos o frame
				continue
			}

			// Escrever no stdin do processo
			if _, err := stdin.Write(data); err != nil {
				s.logger.Printf("[TERMINAL] Erro escrevendo no stdin: %v", err)
				break
			}
		}
	}

	s.logger.Println("[TERMINAL] Encerrando processo...")

	// Fechar o stdin dá ao cmd.exe a chance de sair sozinho; sem isso ele fica
	// bloqueado esperando entrada e só morre no Kill.
	_ = stdin.Close()
	_ = cmd.Process.Kill()

	// Wait é obrigatório mesmo depois do Kill: sem ele o processo fica zumbi e
	// os handles do pipe nunca são liberados — a cada sessão de terminal o
	// agente vazava um processo e dois descritores.
	_ = cmd.Wait()
}
