package collector

import (
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
	if userDomain == "" {
		return userName
	}

	// Ignora domínios locais e especiais do Windows
	if strings.EqualFold(userDomain, hostname) ||
		strings.EqualFold(userDomain, "WORKGROUP") ||
		strings.EqualFold(userDomain, ".") ||
		strings.EqualFold(userDomain, "NT AUTHORITY") ||
		strings.EqualFold(userDomain, "NT SERVICE") ||
		strings.EqualFold(userDomain, "FONT DRIVER HOST") ||
		strings.EqualFold(userDomain, "WINDOW MANAGER") {
		return userName
	}

	return userDomain + `\` + userName
}

// resolverIdentidadeDoUsuario resolve domínio (AD ou WORKGROUP), usuário (com suporte a AD)
// e SID da sessão interativa ativa.
func resolverIdentidadeDoUsuario() (dominio, usuario, sid string) {
	// 1. Obtém o domínio da máquina (AD Domain ou WORKGROUP)
	dominio = obterDominioMaquina()

	// 2. Obtém usuário da sessão interativa de console (WTS)
	userDomain, userName, s, err := usuarioDaSessaoAtiva()
	if err == nil && userName != "" {
		hostname, _ := os.Hostname()
		usuario = formatarUsuarioInterativo(userDomain, userName, hostname)
		sid = s

		// Se a máquina não reportou domínio AD mas a sessão do usuário tem domínio AD específico:
		if (dominio == "" || dominio == "WORKGROUP") && userDomain != "" && !strings.EqualFold(userDomain, hostname) && !strings.EqualFold(userDomain, "WORKGROUP") {
			dominio = userDomain
		}
		if dominio == "" {
			dominio = "WORKGROUP"
		}
		return dominio, usuario, sid
	}

	// 3. Fallback para variáveis de ambiente
	dEnv, uEnv := identidadeViaEnv(os.Getenv)
	if dominio == "" || dominio == "WORKGROUP" {
		if dEnv != "" && dEnv != "WORKGROUP" {
			dominio = dEnv
		} else if dominio == "" {
			dominio = "WORKGROUP"
		}
	}

	// 4. Último recurso: quando nem a sessão WTS nem as variáveis de ambiente
	// resolveram um usuário (comum em serviços/contêineres Linux sem
	// USER/USERNAME no ambiente), consulta o usuário do processo via
	// os/user — sempre disponível a partir do uid, independente de env vars.
	if uEnv == "" {
		if u, err := user.Current(); err == nil && u.Username != "" {
			uEnv = u.Username
		}
	}

	return dominio, uEnv, ""
}
