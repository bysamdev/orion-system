package monitor

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"
)

// ErrLinkNaoEncontrado: id de link que não existe no cadastro.
var ErrLinkNaoEncontrado = errors.New("link não encontrado")

// Rotas do cadastro de links. Quem chama é a API do Orion, que já conferiu o
// usuário e a empresa; a autenticação é o mesmo segredo do ingest.
func (s *Servidor) rotasDeLinks(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/links", s.exigirSegredo(s.listarLinks))
	mux.HandleFunc("POST /v1/links", s.exigirSegredo(s.salvarLink))
	mux.HandleFunc("PUT /v1/links/{id}", s.exigirSegredo(s.salvarLink))
	mux.HandleFunc("DELETE /v1/links/{id}", s.exigirSegredo(s.apagarLink))
}

type linkComEstado struct {
	Link
	Estado *EstadoDoLink `json:"estado"`
}

// listarLinks devolve o cadastro com a última medição da sonda. company_id
// na query filtra por empresa (a API manda quando o usuário não é gestor).
func (s *Servidor) listarLinks(w http.ResponseWriter, r *http.Request) {
	empresa := r.URL.Query().Get("company_id")
	if empresa != "" && !uuidValido.MatchString(empresa) {
		responder(w, http.StatusBadRequest, map[string]any{"error": "company_id inválido"})
		return
	}
	estados := s.Links.Estados()
	agora := time.Now()
	out := []linkComEstado{}
	for _, lk := range s.Links.Listar() {
		if empresa != "" && lk.CompanyID != empresa {
			continue
		}
		item := linkComEstado{Link: lk}
		if e, ok := estados[lk.ID]; ok && agora.Sub(e.MedidoEm) <= validadeDaMedicao {
			item.Estado = &e
		}
		out = append(out, item)
	}
	responderJSON(w, map[string]any{"links": out})
}

func (s *Servidor) salvarLink(w http.ResponseWriter, r *http.Request) {
	var lk Link
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&lk); err != nil {
		responder(w, http.StatusBadRequest, map[string]any{"error": "corpo inválido"})
		return
	}
	lk.ID = ""
	if r.Method == http.MethodPut {
		id, ok := idDaRota(w, r)
		if !ok {
			return
		}
		lk.ID = id
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	salvo, err := s.Links.Salvar(ctx, lk)
	switch {
	case errors.Is(err, errLinkInvalido):
		responder(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
	case errors.Is(err, ErrLinkNaoEncontrado):
		responder(w, http.StatusNotFound, map[string]any{"error": err.Error()})
	case err != nil:
		log.Printf("[ERRO] monitor: salvar link: %v", err)
		responder(w, http.StatusServiceUnavailable, map[string]any{"error": "falha ao gravar"})
	default:
		responderJSON(w, salvo)
	}
}

func (s *Servidor) apagarLink(w http.ResponseWriter, r *http.Request) {
	id, ok := idDaRota(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	switch err := s.Links.Apagar(ctx, id); {
	case errors.Is(err, ErrLinkNaoEncontrado):
		responder(w, http.StatusNotFound, map[string]any{"error": err.Error()})
	case err != nil:
		log.Printf("[ERRO] monitor: apagar link: %v", err)
		responder(w, http.StatusServiceUnavailable, map[string]any{"error": "falha ao apagar"})
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// sdDeLinks alimenta o http_sd_configs do job blackbox_icmp (porta interna).
func (s *Servidor) sdDeLinks(w http.ResponseWriter, _ *http.Request) {
	responderJSON(w, s.Links.AlvosExternos())
}
