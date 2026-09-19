package handler

import (
	"fmt"
	"net/http"
)

// nomeRequisitante decide o nome exibido no perfil da máquina que assina os
// chamados automáticos do monitoramento (garantirDonoDoChamadoAutomatico, em
// mon_handlers.go). Reflete quem está logado no Windows agora, quando o
// agente sabe; senão, só o nome da máquina.
func nomeRequisitante(hostname string, currentUser *string) string {
	if currentUser != nil && *currentUser != "" {
		return fmt.Sprintf("%s (%s)", *currentUser, hostname)
	}
	return fmt.Sprintf("Suporte (%s)", hostname)
}

// machineLogin era o login sem senha do agente: o botão "Abrir Portal" da
// bandeja chamava esta rota com o token da máquina, e ela criava uma conta
// para a máquina e entrava com link mágico. Retirado a pedido do dono do
// produto (19/09/2026): o agente passa a ser só monitoramento, e as contas
// são criadas pelo gestor e acessadas com senha própria.
//
// A rota continua existindo porque os agentes já instalados ainda chamam
// este endereço; agora ela só manda para a tela de login, sem ler o token nem
// abrir sessão. O token da máquina, que vinha na query, é descartado.
//
// Rota: GET /api/auth/machine-login
func machineLogin(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/auth", http.StatusSeeOther)
}
