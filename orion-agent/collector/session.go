package collector

import "os"

// identidadeViaEnv resolve domínio/usuário a partir das variáveis de ambiente
// do processo — usado como fallback quando não há sessão de console ativa
// para consultar via WTS (usuarioDaSessaoAtiva), e como caminho único em
// plataformas não-Windows. getenv é injetável para testar sem depender do
// ambiente real do processo.
func identidadeViaEnv(getenv func(string) string) (dominio, usuario string) {
	dominio = getenv("USERDOMAIN")
	if dominio == "" {
		dominio = getenv("USERDNSDOMAIN")
	}
	if dominio == "" {
		dominio = "WORKGROUP"
	}
	usuario = getenv("USERNAME")
	if usuario == "" {
		usuario = getenv("USER")
	}
	return dominio, usuario
}

// resolverIdentidadeDoUsuario resolve domínio, usuário e SID (correção
// A.13) do usuário atualmente logado. SID vem vazio sempre que não foi
// possível determiná-lo (plataforma não suportada, sem sessão de console
// ativa, ou falha ao resolver a conta) — é dado opcional/best-effort, nunca
// bloqueia a coleta do restante do payload.
func resolverIdentidadeDoUsuario() (dominio, usuario, sid string) {
	if d, u, s, err := usuarioDaSessaoAtiva(); err == nil {
		return d, u, s
	}
	d, u := identidadeViaEnv(os.Getenv)
	return d, u, ""
}
