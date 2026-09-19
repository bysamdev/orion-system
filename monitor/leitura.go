package monitor

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"time"
)

// Leitura — fase 2 da separação: as telas de monitoramento do Orion passam a
// buscar aqui o estado, o inventário, os alertas e o histórico das máquinas.
//
// Quem chama é a API do Orion (Vercel), nunca o navegador: ela já resolveu o
// usuário e a empresa, e só pede máquinas que o usuário pode ver. Por isso a
// autenticação é o mesmo segredo compartilhado do ingest.

// Estado é o "agora" de uma máquina, como a listagem do painel precisa.
type Estado struct {
	MachineID    string          `json:"machine_id"`
	CPUUsage     float64         `json:"cpu_usage"`
	RAMUsed      int64           `json:"ram_used"`
	RAMTotal     int64           `json:"ram_total"`
	DiskUsed     int64           `json:"disk_used"`
	DiskTotal    int64           `json:"disk_total"`
	Uptime       int64           `json:"uptime"`
	AgentVersion string          `json:"agent_version"`
	VistoEm      time.Time       `json:"visto_em"`
	SecurityInfo json.RawMessage `json:"security_info,omitempty"`
}

// Hardware é o inventário de uma máquina.
type Hardware struct {
	MachineID      string          `json:"machine_id"`
	CPUModel       string          `json:"cpu_model"`
	GPU            string          `json:"gpu"`
	Disks          json.RawMessage `json:"disks"`
	Interfaces     json.RawMessage `json:"interfaces"`
	SecurityInfo   json.RawMessage `json:"security_info"`
	RemoteSoftware json.RawMessage `json:"remote_software"`
	BatteryInfo    json.RawMessage `json:"battery_info"`
	UpdateStatus   json.RawMessage `json:"update_status"`
	AtualizadoEm   time.Time       `json:"atualizado_em"`
}

// AlertaAberto é um alerta ainda não resolvido.
type AlertaAberto struct {
	ID         int64     `json:"id"`
	MachineID  string    `json:"machine_id"`
	Tipo       string    `json:"tipo"`
	Severidade string    `json:"severidade"`
	Mensagem   string    `json:"mensagem"`
	AbertoEm   time.Time `json:"aberto_em"`
}

// PontoHistorico é um ponto do gráfico de performance. Percentuais nulos
// quando a série não tem valor naquele instante.
type PontoHistorico struct {
	Em   time.Time `json:"em"`
	CPU  *float64  `json:"cpu"`
	RAM  *float64  `json:"ram"`
	Disk *float64  `json:"disk"`
}

// Leitor é o que a API de leitura precisa do banco.
type Leitor interface {
	Estados(ctx context.Context, ids []string) ([]Estado, error)
	Hardware(ctx context.Context, id string) (*Hardware, error)
	Alertas(ctx context.Context, id string) ([]AlertaAberto, error)
}

// Historiador busca a série histórica. Em produção é o Prometheus.
type Historiador interface {
	Historico(ctx context.Context, id string, janela, passo time.Duration) ([]PontoHistorico, error)
}

// ErrNaoEncontrado: a máquina não tem dado no monitor (ainda não mandou
// heartbeat desde que o monitor entrou no ar).
var ErrNaoEncontrado = errors.New("máquina sem dados no monitor")

var uuidValido = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)

// maximoIDsPorConsulta limita a listagem: a maior tela pede todas as máquinas
// do escopo de uma vez, e 2000 cobre com folga as ~500 previstas.
const maximoIDsPorConsulta = 2000

func (s *Servidor) rotasDeLeitura(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/estado", s.exigirSegredo(s.estados))
	mux.HandleFunc("GET /v1/maquinas/{id}/hardware", s.exigirSegredo(s.hardware))
	mux.HandleFunc("GET /v1/maquinas/{id}/alertas", s.exigirSegredo(s.alertas))
	mux.HandleFunc("GET /v1/maquinas/{id}/historico", s.exigirSegredo(s.historico))
}

func (s *Servidor) exigirSegredo(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.autorizado(r) {
			responder(w, http.StatusUnauthorized, map[string]any{"error": "não autorizado"})
			return
		}
		h(w, r)
	}
}

func idDaRota(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := r.PathValue("id")
	if !uuidValido.MatchString(id) {
		responder(w, http.StatusBadRequest, map[string]any{"error": "id inválido"})
		return "", false
	}
	return id, true
}

func responderJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Servidor) estados(w http.ResponseWriter, r *http.Request) {
	var corpo struct {
		MachineIDs []string `json:"machine_ids"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256<<10)).Decode(&corpo); err != nil {
		responder(w, http.StatusBadRequest, map[string]any{"error": "corpo inválido"})
		return
	}
	if len(corpo.MachineIDs) > maximoIDsPorConsulta {
		responder(w, http.StatusBadRequest, map[string]any{"error": "máquinas demais numa consulta"})
		return
	}
	for _, id := range corpo.MachineIDs {
		if !uuidValido.MatchString(id) {
			responder(w, http.StatusBadRequest, map[string]any{"error": "id inválido"})
			return
		}
	}
	if len(corpo.MachineIDs) == 0 {
		responderJSON(w, []Estado{})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	estados, err := s.Leitor.Estados(ctx, corpo.MachineIDs)
	if err != nil {
		responder(w, http.StatusServiceUnavailable, map[string]any{"error": "falha ao ler estado"})
		return
	}
	if estados == nil {
		estados = []Estado{}
	}
	responderJSON(w, estados)
}

func (s *Servidor) hardware(w http.ResponseWriter, r *http.Request) {
	id, ok := idDaRota(w, r)
	if !ok {
		return
	}
	hw, err := s.Leitor.Hardware(r.Context(), id)
	if errors.Is(err, ErrNaoEncontrado) {
		responder(w, http.StatusNotFound, map[string]any{"error": err.Error()})
		return
	}
	if err != nil {
		responder(w, http.StatusServiceUnavailable, map[string]any{"error": "falha ao ler inventário"})
		return
	}
	responderJSON(w, hw)
}

func (s *Servidor) alertas(w http.ResponseWriter, r *http.Request) {
	id, ok := idDaRota(w, r)
	if !ok {
		return
	}
	alertas, err := s.Leitor.Alertas(r.Context(), id)
	if err != nil {
		responder(w, http.StatusServiceUnavailable, map[string]any{"error": "falha ao ler alertas"})
		return
	}
	if alertas == nil {
		alertas = []AlertaAberto{}
	}
	responderJSON(w, alertas)
}

// Limites do histórico: a maior janela do painel é 7 dias, e o passo não
// pode ser tão fino que gere milhares de pontos.
const (
	janelaMaxima  = 8 * 24 * time.Hour
	pontosMaximos = 2000
)

func (s *Servidor) historico(w http.ResponseWriter, r *http.Request) {
	id, ok := idDaRota(w, r)
	if !ok {
		return
	}
	janela, err1 := strconv.Atoi(r.URL.Query().Get("janela"))
	passo, err2 := strconv.Atoi(r.URL.Query().Get("passo"))
	if err1 != nil || err2 != nil || janela <= 0 || passo <= 0 {
		responder(w, http.StatusBadRequest, map[string]any{"error": "janela e passo são obrigatórios, em segundos"})
		return
	}
	j, p := time.Duration(janela)*time.Second, time.Duration(passo)*time.Second
	if j > janelaMaxima || j/p > pontosMaximos {
		responder(w, http.StatusBadRequest, map[string]any{"error": "janela grande demais para o passo"})
		return
	}
	if s.Historiador == nil {
		responder(w, http.StatusServiceUnavailable, map[string]any{"error": "histórico não configurado"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	pontos, err := s.Historiador.Historico(ctx, id, j, p)
	if err != nil {
		responder(w, http.StatusServiceUnavailable, map[string]any{"error": "falha ao ler histórico"})
		return
	}
	if pontos == nil {
		pontos = []PontoHistorico{}
	}
	responderJSON(w, pontos)
}
