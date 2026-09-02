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

// papeisInstalador espelha allowedRoles de /instaladores em App.tsx. Antes
// só continha admin/developer/gestor — technician via a página (front
// permitia) mas toda chamada de API vinha 403 (bug de UX, nunca foi brecha:
// a direção restritiva demais não é risco de segurança, só quebrava a tela).
var papeisInstalador = map[string]bool{"admin": true, "developer": true, "gestor": true, "technician": true}

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
	if !papeisInstalador[role] {
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

	return contextoInstalador{companyID: companyID, companyName: companyName, apiKey: apiKey, apiURL: apiURLPublica()}, true
}

// apiURLPublica extrai só a origem (scheme://host) de cfg.LoginURL (algo
// como "https://orion.bysam.dev/auth") — é o que o agente quer em
// api_url, sem caminho. Compartilhado entre a geração manual de instalador
// e a auto-atualização enfileirada a partir do heartbeat (mon_handlers.go).
func apiURLPublica() string {
	apiURL := cfg.LoginURL
	if parsed, err := url.Parse(apiURL); err == nil && parsed.Scheme != "" && parsed.Host != "" {
		return parsed.Scheme + "://" + parsed.Host
	}
	return apiURL
}

// prepararInstaladorDaEmpresa monta (ou reaproveita do cache) o .exe
// personalizado de uma empresa, sobe pro Storage se preciso, e devolve a
// signed URL de download + o SHA-256 dos bytes reais do arquivo. Usado
// tanto pelo endpoint de download manual (monitoringGenerateInstaller)
// quanto pela auto-atualização enfileirada a partir do heartbeat (ver
// monitoringHeartbeat) — os dois precisam exatamente da mesma coisa.
//
// Sempre remonta os bytes (mesmo em cache hit) só pra calcular o hash —
// barato (append de bytes em memória, sem rede) e sempre correto: o nome
// do arquivo em cache já embute o hash de instaladorGenericoHash+config,
// então um cache hit garante que remontar agora dá bytes idênticos aos já
// armazenados. O upload de ~16MB (a parte cara) continua pulado no cache
// hit — só a montagem em memória se repete.
func prepararInstaladorDaEmpresa(ctx context.Context, companyID, apiKey, apiURL, companyName string) (downloadURL, nomeArquivo, sha256Hex string, err error) {
	pasta, nomeCache := lib.CaminhoInstaladorCache(companyID, apiKey, apiURL, companyName)
	caminho := pasta + nomeCache

	instalador, err := lib.MontarInstaladorPersonalizado(apiKey, apiURL, companyName)
	if err != nil {
		return "", "", "", fmt.Errorf("montar instalador personalizado: %w", err)
	}
	sha256Hex = lib.SHA256Hex(instalador)

	existe, err := sb.InstaladorExiste(ctx, pasta, nomeCache)
	if err != nil {
		return "", "", "", fmt.Errorf("verificar cache do instalador: %w", err)
	}
	if !existe {
		if err := sb.SubirInstalador(ctx, caminho, instalador); err != nil {
			return "", "", "", fmt.Errorf("subir instalador ao storage: %w", err)
		}
	}

	nomeArquivo = fmt.Sprintf("OrionInstaller-%s.exe", lib.SanitizarNomeArquivo(companyName))
	downloadURL, err = sb.AssinarInstalador(ctx, caminho, nomeArquivo, 3600)
	if err != nil {
		return "", "", "", fmt.Errorf("assinar URL do instalador: %w", err)
	}
	return downloadURL, nomeArquivo, sha256Hex, nil
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

	downloadURL, nomeArquivo, _, err := prepararInstaladorDaEmpresa(ctx, c.companyID, c.apiKey, c.apiURL, c.companyName)
	if err != nil {
		log.Printf("[ERRO] preparar instalador (empresa %s): %v", c.companyID, err)
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
