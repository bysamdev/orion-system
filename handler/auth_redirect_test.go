package handler

import "testing"

// TestDestinoPosLoginRecusaAberturaDeChamado cobre a decisão do dono do
// produto: abrir chamado passa a exigir login individual, então o
// machine-login (que autentica só com o token da máquina) não pode mais
// entregar o usuário na tela de abertura. Todas as variações que o
// front-end resolve para a MESMA rota precisam cair no fallback "/".
func TestDestinoPosLoginRecusaAberturaDeChamado(t *testing.T) {
	variacoes := []string{
		"/novo-ticket",
		"/novo-ticket/",
		"/novo-ticket?x=1",
		"/novo-ticket?machine_id=abc",
		"/novo-ticket#topo",
		"/NOVO-TICKET",
		"/Novo-Ticket/",
		// apelidos que src/App.tsx redireciona para /novo-ticket — a razão
		// de usarmos allowlist em vez de denylist
		"/novo",
		"/novo-chamado",
		"/abrir-chamado",
		"/abrir-ticket",
		"/new-ticket",
		"/create-ticket",
	}
	for _, v := range variacoes {
		destino, aviso := destinoPosLogin(v)
		if destino != "/" {
			t.Errorf("destinoPosLogin(%q) = %q, esperado %q", v, destino, "/")
		}
		if aviso == "" {
			t.Errorf("destinoPosLogin(%q) não gerou aviso de recusa", v)
		}
	}
}

// TestDestinoPosLoginAceitaConsulta garante que fechar a abertura de chamado
// não fechou junto o portal de consulta, que continua acessível pelo token.
func TestDestinoPosLoginAceitaConsulta(t *testing.T) {
	aceitos := []string{
		"/",
		"/portal",
		"/historico",
		"/historico?status=aberto",
		"/HISTORICO/",
		"/chamados",
		"/meus-chamados",
		"/tickets",
		"/conhecimento",
		"/notificacoes",
		"/ticket/9f2c-4a10",
		"/ticket/9f2c-4a10?aba=comentarios",
	}
	for _, v := range aceitos {
		destino, aviso := destinoPosLogin(v)
		if destino != v {
			t.Errorf("destinoPosLogin(%q) = %q, esperado o mesmo caminho", v, destino)
		}
		if aviso != "" {
			t.Errorf("destinoPosLogin(%q) gerou aviso inesperado: %s", v, aviso)
		}
	}
}

// TestDestinoPosLoginSemRedirect: ausência de redirect_to é o caso normal
// (botão "Abrir Portal de Suporte" na bandeja) — cai em "/" sem poluir o log.
func TestDestinoPosLoginSemRedirect(t *testing.T) {
	destino, aviso := destinoPosLogin("")
	if destino != "/" {
		t.Errorf("destinoPosLogin(\"\") = %q, esperado %q", destino, "/")
	}
	if aviso != "" {
		t.Errorf("destinoPosLogin(\"\") não deveria gerar aviso, obtive %s", aviso)
	}
}

// TestDestinoPosLoginMantemProtecaoOpenRedirect: a nova checagem de destino
// soma-se a caminhoRelativoSeguro, não a substitui — os bypasses do pentest
// (vuln-0005) continuam recusados.
func TestDestinoPosLoginMantemProtecaoOpenRedirect(t *testing.T) {
	inseguros := []string{
		"//evil.com",
		"///evil.com",
		"/\\evil.com",
		"//evil.com/historico",
		"https://evil.com",
		"evil.com",
		"/x?u=http://",
		"/redir?u=https://evil.com",
		"/historico\r\nX: 1",
	}
	for _, v := range inseguros {
		destino, aviso := destinoPosLogin(v)
		if destino != "/" {
			t.Errorf("destinoPosLogin(%q) = %q, esperado %q", v, destino, "/")
		}
		if aviso == "" {
			t.Errorf("destinoPosLogin(%q) não gerou aviso de recusa", v)
		}
	}
}

// TestDestinoDesconhecidoRecusado: allowlist fecha por padrão — uma rota que
// existe no front mas não foi liberada aqui não passa.
func TestDestinoDesconhecidoRecusado(t *testing.T) {
	for _, v := range []string{"/admin", "/relatorios", "/ticket/", "/rota-que-nao-existe"} {
		if destino, _ := destinoPosLogin(v); destino != "/" {
			t.Errorf("destinoPosLogin(%q) = %q, esperado %q", v, destino, "/")
		}
	}
}
