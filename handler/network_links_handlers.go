package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
	"orion-api/monitor"
)

// Links de internet dos clientes. O cadastro e a medição moram no Orion
// Monitor (servidor de monitoramento); nada disso fica no Supabase. Aqui a API
// só confere quem é o usuário e a empresa dele e repassa o pedido.

const timeoutLinks = 5 * time.Second

var clienteLinks = &http.Client{Timeout: timeoutLinks}

// repassarLinks chama o Monitor e devolve status e corpo como vieram, para a
// tela ver a mensagem de validação dele.
func repassarLinks(ctx context.Context, metodo, caminho string, corpo any) (int, []byte, error) {
	var leitor io.Reader
	if corpo != nil {
		b, err := json.Marshal(corpo)
		if err != nil {
			return 0, nil, err
		}
		leitor = bytes.NewReader(b)
	}
	ctx, cancel := context.WithTimeout(ctx, timeoutLinks)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, metodo, strings.TrimSuffix(cfg.MonitorIngestURL, "/")+caminho, leitor)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.MonitorIngestSecret)
	if corpo != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := clienteLinks.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return resp.StatusCode, b, err
}

func responderRepasse(w http.ResponseWriter, status int, corpo []byte) {
	if status == http.StatusNoContent {
		w.WriteHeader(status)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(corpo)
}

// escopoDosLinks resolve o usuário e a empresa. empresa vazia = enxerga
// todas (master/developer). exigirGestao limita a quem pode cadastrar.
func escopoDosLinks(w http.ResponseWriter, r *http.Request, exigirGestao bool) (empresa string, global bool, ok bool) {
	user, err := requireAuth(r)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return "", false, false
	}
	escopo, err := escopoDoUsuario(r.Context(), user.ID)
	if err != nil || (exigirGestao && !papeisComandoRemoto[escopo.Role]) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: apenas administradores e técnicos podem gerenciar links"})
		return "", false, false
	}
	if escopo.Global() {
		return "", true, true
	}
	if escopo.CompanyID == nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return "", false, false
	}
	return *escopo.CompanyID, false, true
}

func monitorIndisponivel(w http.ResponseWriter, err error) {
	if err != nil {
		log.Printf("[AVISO] links: monitor indisponível: %v", err)
	}
	lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "Servidor de monitoramento indisponível"})
}

// GET /api/monitoring/network-links
func monitoringListNetworkLinks(w http.ResponseWriter, r *http.Request) {
	empresa, global, ok := escopoDosLinks(w, r, false)
	if !ok {
		return
	}
	if !monitorConfigurado() {
		monitorIndisponivel(w, nil)
		return
	}
	if global {
		empresa = r.URL.Query().Get("company_id")
		if empresa == "all" {
			empresa = ""
		}
	}
	caminho := "/v1/links"
	if empresa != "" {
		caminho += "?company_id=" + url.QueryEscape(empresa)
	}
	status, corpo, err := repassarLinks(r.Context(), http.MethodGet, caminho, nil)
	if err != nil {
		monitorIndisponivel(w, err)
		return
	}
	responderRepasse(w, status, corpo)
}

// linkDaEmpresa confere, para quem não é global, que o link é da empresa.
func linkDaEmpresa(ctx context.Context, id, empresa string) (bool, error) {
	status, corpo, err := repassarLinks(ctx, http.MethodGet, "/v1/links?company_id="+url.QueryEscape(empresa), nil)
	if err != nil || status != http.StatusOK {
		return false, err
	}
	var lista struct {
		Links []monitor.Link `json:"links"`
	}
	if err := json.Unmarshal(corpo, &lista); err != nil {
		return false, err
	}
	for _, l := range lista.Links {
		if l.ID == id {
			return true, nil
		}
	}
	return false, nil
}

// POST /api/monitoring/network-links e PUT /api/monitoring/network-links/{id}
func monitoringSaveNetworkLink(w http.ResponseWriter, r *http.Request) {
	empresa, global, ok := escopoDosLinks(w, r, true)
	if !ok {
		return
	}
	if !monitorConfigurado() {
		monitorIndisponivel(w, nil)
		return
	}
	var lk monitor.Link
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&lk); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Requisição inválida"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Só quem enxerga tudo escolhe a empresa; os demais cadastram na própria.
	if !global {
		lk.CompanyID = empresa
	}
	if lk.CompanyID == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Escolha o cliente do link"})
		return
	}
	// O nome do cliente vai junto para os rótulos do Prometheus e do Grafana.
	nome, err := db.CompanyName(ctx, lk.CompanyID)
	if err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Cliente não encontrado"})
		return
	}
	lk.Cliente = nome

	metodo, caminho := http.MethodPost, "/v1/links"
	if id := chi.URLParam(r, "id"); id != "" {
		if !global {
			if pertence, err := linkDaEmpresa(ctx, id, empresa); err != nil || !pertence {
				lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Link não encontrado"})
				return
			}
		}
		metodo, caminho = http.MethodPut, "/v1/links/"+url.PathEscape(id)
	}
	status, corpo, err := repassarLinks(ctx, metodo, caminho, lk)
	if err != nil {
		monitorIndisponivel(w, err)
		return
	}
	responderRepasse(w, status, corpo)
}

// DELETE /api/monitoring/network-links/{id}
func monitoringDeleteNetworkLink(w http.ResponseWriter, r *http.Request) {
	empresa, global, ok := escopoDosLinks(w, r, true)
	if !ok {
		return
	}
	if !monitorConfigurado() {
		monitorIndisponivel(w, nil)
		return
	}
	id := chi.URLParam(r, "id")
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if !global {
		if pertence, err := linkDaEmpresa(ctx, id, empresa); err != nil || !pertence {
			lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Link não encontrado"})
			return
		}
	}
	status, corpo, err := repassarLinks(ctx, http.MethodDelete, "/v1/links/"+url.PathEscape(id), nil)
	if err != nil {
		monitorIndisponivel(w, err)
		return
	}
	responderRepasse(w, status, corpo)
}
