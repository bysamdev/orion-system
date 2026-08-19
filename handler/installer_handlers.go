package handler

// installer_handlers.go — geração de instalador do Orion Agent
// personalizado por empresa, sob demanda, a partir do front-end.

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"

	"orion-api/lib"
)

// contextoInstalador junta tudo que os dois endpoints de geração de
// instalador (.exe e .msi) precisam resolver antes de montar qualquer
// coisa: quem está pedindo pode ver essa empresa, qual é o nome dela e
// qual chave/URL usar.
type contextoInstalador struct {
	companyID   string
	companyName string
	apiKey      string
	apiURL      string
}

// resolverContextoInstalador centraliza auth + papel + escopo de empresa +
// nome + chave de API — compartilhado pelos handlers de .exe e .msi.
// Escreve a resposta de erro e devolve ok=false quando qualquer checagem
// falha; o caller só precisa checar ok e retornar.
func resolverContextoInstalador(w http.ResponseWriter, r *http.Request, ctx context.Context) (contextoInstalador, bool) {
	user, err := requireAuth(r.WithContext(ctx))
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return contextoInstalador{}, false
	}

	role, _ := requireAdminOrDeveloper(r, user.ID)
	if role != "admin" && role != "developer" && role != "gestor" {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito"})
		return contextoInstalador{}, false
	}

	companyID := chi.URLParam(r, "id")

	// requireAdminOrDeveloper só valida o papel do chamador, nunca a
	// empresa — sem isto, um admin/gestor de QUALQUER empresa gerava um
	// instalador (com a agent_key) de qualquer outra empresa só sabendo o
	// id dela.
	escopo, err := escopoDoUsuario(ctx, user.ID)
	if err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Não foi possível resolver sua empresa"})
		return contextoInstalador{}, false
	}
	if !escopo.PodeVerEmpresa(&companyID) {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Acesso restrito: empresa não é a sua"})
		return contextoInstalador{}, false
	}

	companyName, err := db.CompanyName(ctx, companyID)
	if err != nil {
		lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Empresa não encontrada"})
		return contextoInstalador{}, false
	}

	apiKey, err := db.ActiveOrNewAPIKey(ctx, companyID, user.ID)
	if err != nil {
		log.Printf("[ERRO] preparar chave para instalador (empresa %s): %v", companyID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar a chave de autenticação"})
		return contextoInstalador{}, false
	}

	// Rede de segurança: a sincronização com o Grafana já roda ao
	// criar/editar empresa em CompanyManagement.tsx, mas empresas criadas
	// antes dessa feature (ou antes do GRAFANA_PROVISION_TOKEN existir)
	// podem não ter pasta/dashboard ainda — gerar um instalador é
	// tipicamente o primeiro passo de verdade com um cliente novo, então
	// garante aqui também. Best-effort de propósito (só loga): a geração
	// do instalador não pode falhar por causa do Grafana.
	if cfg.GrafanaProvisionToken != "" {
		provisioner := lib.NewGrafanaProvisioner(cfg.GrafanaURL, cfg.GrafanaProvisionToken)
		if err := provisioner.EnsureCompanyDashboard(ctx, companyID, companyName); err != nil {
			log.Printf("[AVISO] sincronizar empresa %s com o Grafana (via geração de instalador): %v", companyID, err)
		}
	}

	// cfg.LoginURL é algo como "https://orion.bysam.dev/auth" — o agente só
	// quer a origem, sem caminho.
	apiURL := cfg.LoginURL
	if parsed, err := url.Parse(apiURL); err == nil && parsed.Scheme != "" && parsed.Host != "" {
		apiURL = parsed.Scheme + "://" + parsed.Host
	}

	return contextoInstalador{companyID: companyID, companyName: companyName, apiKey: apiKey, apiURL: apiURL}, true
}

// monitoringGenerateInstaller monta e devolve um .exe pronto pra instalar o
// Orion Agent já configurado com a agent_key da empresa — sem precisar
// editar agent.yaml à mão em cada máquina. Ver
// orion-agent/cmd/installer/selfconfig.go pro lado que lê essa
// configuração.
func monitoringGenerateInstaller(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()

	c, ok := resolverContextoInstalador(w, r, ctx)
	if !ok {
		return
	}
	companyID, companyName, apiKey, apiURL := c.companyID, c.companyName, c.apiKey, c.apiURL

	// O binário (~16MB) estoura o limite de payload de resposta das
	// Serverless Functions da Vercel (4.5MB) — em vez de devolver os bytes
	// direto, sobe pro Storage e devolve uma signed URL de download. O
	// caminho é content-addressed (hash da config), então uma geração
	// repetida sem mudanças pula o upload de ~16MB inteiro.
	pasta, nomeCache := lib.CaminhoInstaladorCache(companyID, apiKey, apiURL, companyName)
	caminho := pasta + nomeCache

	existe, err := sb.InstaladorExiste(ctx, pasta, nomeCache)
	if err != nil {
		log.Printf("[ERRO] verificar cache do instalador (empresa %s): %v", companyID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar download do instalador"})
		return
	}
	if !existe {
		instalador, err := lib.MontarInstaladorPersonalizado(apiKey, apiURL, companyName)
		if err != nil {
			log.Printf("[ERRO] montar instalador personalizado (empresa %s): %v", companyID, err)
			lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao gerar instalador"})
			return
		}
		if err := sb.SubirInstalador(ctx, caminho, instalador); err != nil {
			log.Printf("[ERRO] subir instalador ao storage (empresa %s): %v", companyID, err)
			lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar download do instalador"})
			return
		}
	}

	nomeArquivo := fmt.Sprintf("OrionInstaller-%s.exe", lib.SanitizarNomeArquivo(companyName))
	downloadURL, err := sb.AssinarInstalador(ctx, caminho, nomeArquivo, 300)
	if err != nil {
		log.Printf("[ERRO] assinar URL do instalador (empresa %s): %v", companyID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar download do instalador"})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"url": downloadURL, "filename": nomeArquivo})
}

// monitoringGenerateInstallerMsi devolve o .msi genérico do Orion Agent
// (um único build, igual pra toda empresa — ver
// orion-agent/packaging/msi/OrionAgent.wxs) mais o comando msiexec exato
// pra instalar com a agent_key desta empresa já preenchida. Diferente do
// .exe, a personalização aqui não vai dentro do arquivo: vai em
// propriedades do msiexec (AGENTKEY etc.), do jeito que GPO Software
// Installation/SCCM/Intune costumam parametrizar por grupo/OU.
func monitoringGenerateInstallerMsi(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()

	c, ok := resolverContextoInstalador(w, r, ctx)
	if !ok {
		return
	}

	// O .msi é o mesmo pra qualquer empresa — cache fixo, sobe uma única
	// vez (não por request, e não por empresa) e é reaproveitado depois.
	pasta, nomeCache := lib.CaminhoMsiCache()
	caminho := pasta + nomeCache

	existe, err := sb.InstaladorExiste(ctx, pasta, nomeCache)
	if err != nil {
		log.Printf("[ERRO] verificar cache do msi: %v", err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar download do instalador"})
		return
	}
	if !existe {
		if err := sb.SubirInstalador(ctx, caminho, lib.InstaladorMsiBytes()); err != nil {
			log.Printf("[ERRO] subir msi ao storage: %v", err)
			lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar download do instalador"})
			return
		}
	}

	nomeArquivo := "OrionAgent.msi"
	downloadURL, err := sb.AssinarInstalador(ctx, caminho, nomeArquivo, 300)
	if err != nil {
		log.Printf("[ERRO] assinar URL do msi (empresa %s): %v", c.companyID, err)
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao preparar download do instalador"})
		return
	}

	comando := lib.ComandoMsiexecPersonalizado(nomeArquivo, c.apiKey, c.apiURL, c.companyName)
	lib.WriteJSON(w, http.StatusOK, map[string]any{"url": downloadURL, "filename": nomeArquivo, "command": comando})
}
