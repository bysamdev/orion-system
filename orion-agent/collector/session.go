package collector

import (
	"errors"
	"fmt"
	"os"
	"os/user"
	"strings"
)

// identidadeViaEnv resolve domínio/usuário a partir das variáveis de ambiente
// do processo — usado como fallback quando não há sessão de console ativa
// para consultar via WTS (usuarioDaSessaoAtiva), e como caminho único em
// plataformas não-Windows. getenv é injetável para testar sem depender do
// ambiente real do processo.
func identidadeViaEnv(getenv func(string) string) (dominio, usuario string) {
	userDnsDomain := strings.TrimSpace(getenv("USERDNSDOMAIN"))
	userDomain := strings.TrimSpace(getenv("USERDOMAIN"))
	computerName := strings.TrimSpace(getenv("COMPUTERNAME"))

	if userDnsDomain != "" {
		dominio = userDnsDomain
	} else if userDomain != "" {
		dominio = userDomain
	} else {
		dominio = "WORKGROUP"
	}

	userName := strings.TrimSpace(getenv("USERNAME"))
	if userName == "" {
		userName = strings.TrimSpace(getenv("USER"))
	}

	usuario = formatarUsuarioInterativo(userDomain, userName, computerName)
	return dominio, usuario
}

// ehDominioLocal identifica valores de domínio que o Windows usa pra dizer
// "sem domínio AD de verdade" — nunca devem virar o nome de um grupo de
// máquinas nem prefixar um usuário formatado. "." é o mais traiçoeiro: é o
// que WTSQuerySessionInformation(WTSDomainName) devolve literalmente pra
// sessões de conta local (ver usuarioDaSessaoAtiva em session_windows.go) —
// não vazio, não "WORKGROUP", então escapava do filtro antigo e virava
// grupo de máquina com o nome "." (bug real, corrigido depois de aparecer
// em produção).
func ehDominioLocal(dominio, hostname string) bool {
	dominio = strings.TrimSpace(dominio)
	if dominio == "" {
		return true
	}
	if hostname != "" && strings.EqualFold(dominio, hostname) {
		return true
	}
	switch strings.ToUpper(dominio) {
	case "WORKGROUP", ".", "NT AUTHORITY", "NT SERVICE", "FONT DRIVER HOST", "WINDOW MANAGER":
		return true
	}
	return false
}

// formatarUsuarioInterativo formata o nome de usuário interativo com suporte a AD.
// Se o domínio do usuário for um domínio AD (diferente do hostname, não vazio e não WORKGROUP/sistema),
// retorna "DOMINIO\usuario". Se for usuário local ou já contiver barra, retorna o usuário limpo.
func formatarUsuarioInterativo(userDomain, userName, hostname string) string {
	userName = strings.TrimSpace(userName)
	if userName == "" {
		return ""
	}
	if strings.Contains(userName, `\`) {
		return userName
	}

	userDomain = strings.TrimSpace(userDomain)
	if ehDominioLocal(userDomain, hostname) {
		return userName
	}

	return userDomain + `\` + userName
}

// ResolverUsuarioAtual devolve só o usuário formatado (ex: "DOMINIO\fulano")
// da sessão interativa ativa AGORA — versão exportada e enxuta de
// resolverIdentidadeDoUsuario, pensada pra ser chamada na hora do clique em
// "Abrir Chamado" (ver service/windows.go GetTicketURL/GetPortalURL), não
// só a cada ciclo de heartbeat (30-60s). O valor salvo em
// machines.current_user pode estar defasado até a duração de um ciclo
// inteiro se o usuário da máquina tiver trocado nesse meio-tempo; resolver
// de novo no momento do clique garante que o nome do requisitante no
// chamado reflete quem realmente clicou.
func ResolverUsuarioAtual() string {
	_, usuario, _, _ := resolverIdentidadeDoUsuario()
	return usuario
}

// resolverIdentidadeDoUsuario resolve domínio (AD ou WORKGROUP), usuário (com suporte a AD)
// e SID da sessão interativa ativa.
//
// fallbackMotivo vem preenchido (não-nil) sempre que a resolução caiu para o
// caminho 3 (variáveis de ambiente) em vez do WTS — inclui o erro original
// de usuarioDaSessaoAtiva() para diagnóstico. É nil quando a sessão de
// console ativa foi consultada com sucesso. Não é enviado ao backend (ver
// hardware.go/IdentityFallbackReason, json:"-"); serve só para log local.
func resolverIdentidadeDoUsuario() (dominio, usuario, sid string, fallbackMotivo error) {
	// 1. Obtém o domínio da máquina (AD Domain ou WORKGROUP)
	dominio = obterDominioMaquina()

	// 2. Obtém usuário da sessão interativa de console (WTS)
	userDomain, userName, s, err := usuarioDaSessaoAtiva()
	if err == nil && userName != "" {
		hostname, _ := os.Hostname()
		usuario = formatarUsuarioInterativo(userDomain, userName, hostname)
		sid = s

		// Se a máquina não reportou domínio AD mas a sessão do usuário tem domínio AD específico:
		if (dominio == "" || dominio == "WORKGROUP") && !ehDominioLocal(userDomain, hostname) {
			dominio = userDomain
		}
		if dominio == "" {
			dominio = "WORKGROUP"
		}
		return dominio, usuario, sid, nil
	}
	if err == nil {
		err = errors.New("sessão de console ativa retornou usuário vazio")
	}

	// 3. Fallback: último usuário que fez logon interativo nesta máquina,
	// via registro (LastLoggedOnUser) — não exige a mesma permissão
	// cross-session que o passo 2 precisa, então funciona mesmo com o
	// privilégio restrito da conta de serviço NT SERVICE\OrionAgent (ver
	// A.4). Pode estar levemente desatualizado (não é uma leitura "ao
	// vivo"), mas é sempre uma pessoa de verdade, nunca a conta de
	// serviço — o problema que esta função existe pra evitar.
	if regDomain, regUser := ultimoUsuarioLogado(); regUser != "" {
		hostname, _ := os.Hostname()
		usuario := formatarUsuarioInterativo(regDomain, regUser, hostname)
		if (dominio == "" || dominio == "WORKGROUP") && !ehDominioLocal(regDomain, hostname) {
			dominio = regDomain
		}
		if dominio == "" {
			dominio = "WORKGROUP"
		}
		return dominio, usuario, "", fmt.Errorf("WTS indisponível (%w), usando último usuário logado via registro", err)
	}

	// 4. Último recurso: variáveis de ambiente do processo
	dEnv, uEnv := identidadeViaEnv(os.Getenv)
	if dominio == "" || dominio == "WORKGROUP" {
		if !ehDominioLocal(dEnv, "") {
			dominio = dEnv
		} else if dominio == "" {
			dominio = "WORKGROUP"
		}
	}

	// Último recurso: quando nem a sessão WTS nem as variáveis de ambiente
	// resolveram um usuário (comum em serviços/contêineres Linux sem
	// USER/USERNAME no ambiente), consulta o usuário do processo via
	// os/user — sempre disponível a partir do uid, independente de env vars.
	if uEnv == "" {
		if u, err := user.Current(); err == nil && u.Username != "" {
			uEnv = u.Username
		}
	}

	return dominio, uEnv, "", fmt.Errorf("WTS indisponível (%w), usando variáveis de ambiente do processo", err)
}
