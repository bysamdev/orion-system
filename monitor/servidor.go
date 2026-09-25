package monitor

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
)

// tamanhoMaximoAmostra: um heartbeat real tem poucos KB (o inventário de
// software remoto é o maior bloco). 512 KB sobra e ainda barra abuso.
const tamanhoMaximoAmostra = 512 << 10

// Servidor são as rotas HTTP do Monitor.
type Servidor struct {
	Store         Store
	Leitor        Leitor
	Historiador   Historiador
	Metricas      *Metricas
	Capacidade    *Capacidade
	SegredoIngest string
	// Links é opcional: sem ele o monitor não mede links de internet.
	Links *Links
}

// RotasPublicas é o que fica exposto pelo Cloudflare Tunnel: a entrada das
// amostras e a leitura para a API do Orion, ambas com segredo, e a saúde.
func (s *Servidor) RotasPublicas() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/ingest/heartbeat", s.ingerir)
	mux.HandleFunc("GET /healthz", s.saude)
	if s.Leitor != nil {
		s.rotasDeLeitura(mux)
	}
	if s.Links != nil {
		s.rotasDeLinks(mux)
	}
	return mux
}

// RotasInternas fica só na rede Docker, para o Prometheus. O /metrics lista
// hostname e empresa de todas as máquinas e não tem autenticação: por isso
// mora numa porta separada que nunca é publicada, em vez de depender de
// uma regra de caminho no tunnel.
func (s *Servidor) RotasInternas() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /metrics", s.metricas)
	if s.Links != nil {
		mux.HandleFunc("GET /sd/links", s.sdDeLinks)
	}
	mux.HandleFunc("GET /healthz", s.saude)
	return mux
}

// autorizado confere o "Authorization: Bearer <segredo>" em tempo constante.
// Sem segredo configurado, recusa tudo.
func (s *Servidor) autorizado(r *http.Request) bool {
	const esquema = "Bearer "
	auth := r.Header.Get("Authorization")
	if s.SegredoIngest == "" || !strings.HasPrefix(auth, esquema) {
		return false
	}
	recebido := strings.TrimPrefix(auth, esquema)
	return subtle.ConstantTimeCompare([]byte(recebido), []byte(s.SegredoIngest)) == 1
}

func responder(w http.ResponseWriter, status int, corpo map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(corpo)
}

func (s *Servidor) ingerir(w http.ResponseWriter, r *http.Request) {
	if !s.autorizado(r) {
		s.Metricas.Rejeitada()
		responder(w, http.StatusUnauthorized, map[string]any{"error": "não autorizado"})
		return
	}

	var a Amostra
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, tamanhoMaximoAmostra))
	if err := dec.Decode(&a); err != nil {
		s.Metricas.Rejeitada()
		responder(w, http.StatusBadRequest, map[string]any{"error": "corpo inválido"})
		return
	}
	if err := a.Validar(); err != nil {
		s.Metricas.Rejeitada()
		responder(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}

	abertos, normais := AvaliarAlertas(&a)
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := s.Store.Gravar(ctx, &a, abertos, normais); err != nil {
		s.Metricas.ErroBanco()
		log.Printf("[ERRO] monitor: gravar amostra de %s (%s): %v", a.Hostname, a.MachineID, err)
		responder(w, http.StatusServiceUnavailable, map[string]any{"error": "falha ao gravar"})
		return
	}

	s.Metricas.Registrar(a)
	s.Metricas.Recebida()
	resposta := map[string]any{"ok": true, "alertas_abertos": len(abertos)}
	if s.Links != nil {
		// A sonda recebe na resposta o que medir até o próximo heartbeat; a
		// API do Orion repassa isso ao agente.
		servidor := func(empresa string) string { return s.Metricas.ServidorDaEmpresa(empresa, time.Now()) }
		s.Links.RegistrarMedicao(a.MachineID, a.Links, a.RecebidaEm, servidor)
		if cfg := s.Links.ConfigDaSonda(a.MachineID, servidor); cfg != nil {
			resposta["sonda"] = cfg
		}
	}
	responder(w, http.StatusOK, resposta)
}

func (s *Servidor) metricas(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	s.Metricas.Escrever(w, time.Now())
	if s.Links != nil {
		s.Links.Escrever(w, time.Now())
	}
	if s.Capacidade != nil {
		s.Capacidade.Escrever(w)
	}
}

func (s *Servidor) saude(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.Store.Pronto(ctx); err != nil {
		responder(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "banco": "indisponível"})
		return
	}
	responder(w, http.StatusOK, map[string]any{"ok": true})
}

// Carregar reconstrói as métricas em memória a partir do banco, na subida.
func (s *Servidor) Carregar(ctx context.Context) error {
	amostras, err := s.Store.UltimasAmostras(ctx)
	if err != nil {
		return errors.Join(errors.New("carregar estado do banco"), err)
	}
	for _, a := range amostras {
		s.Metricas.Registrar(a)
	}
	if s.Links != nil {
		if err := s.Links.Carregar(ctx); err != nil {
			return errors.Join(errors.New("carregar links do banco"), err)
		}
	}
	return nil
}
