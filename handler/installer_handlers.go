package handler

// installer_handlers.go — geração de instalador do Orion Agent
// personalizado por empresa, sob demanda, a partir do front-end.

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

// monitoringGenerateInstaller monta e devolve um .exe pronto pra instalar o
// Orion Agent já configurado com a agent_key da empresa — sem precisar
// editar agent.yaml à mão em cada máquina. Ver
// orion-agent/cmd/installer/selfconfig.go pro lado que lê essa
// configuração.
func monitoringGenerateInstaller(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	role, _ := requireAdminOrDeveloper(r, user.ID)
	if role != "admin" && role != "developer" && role != "gestor" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return
	}

	companyID := chi.URLParam(r, "id")

	// requireAdminOrDeveloper só valida o papel do chamador, nunca a
	// empresa — sem isto, um admin/gestor de QUALQUER empresa gerava um
	// instalador (com a agent_key) de qualquer outra empresa só sabendo o
	// id dela.
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return
	}
	if !escopo.PodeVerEmpresa(&companyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: empresa não é a sua"})
		return
	}

	companyName, err := db.CompanyName(ctx, companyID)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Empresa não encontrada"})
		return
	}

	apiKey, err := db.ActiveOrNewAPIKey(ctx, companyID, user.ID)
	if err != nil {
		log.Printf("[ERRO] preparar chave para instalador (empresa %s): %v", companyID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar a chave de autenticação"})
		return
	}

	// cfg.LoginURL é algo como "https://orion.bysam.dev/auth" — o agente só
	// quer a origem, sem caminho.
	apiURL := cfg.LoginURL
	if parsed, err := url.Parse(apiURL); err == nil && parsed.Scheme != "" && parsed.Host != "" {
		apiURL = parsed.Scheme + "://" + parsed.Host
	}

	instalador, err := lib.MontarInstaladorPersonalizado(apiKey, apiURL, companyName)
	if err != nil {
		log.Printf("[ERRO] montar instalador personalizado (empresa %s): %v", companyID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao gerar instalador"})
		return
	}

	nomeArquivo := fmt.Sprintf("OrionInstaller-%s.exe", lib.SanitizarNomeArquivo(companyName))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, nomeArquivo))
	w.Header().Set("Content-Length", strconv.Itoa(len(instalador)))
	w.WriteHeader(http.StatusOK)
	w.Write(instalador)
}
