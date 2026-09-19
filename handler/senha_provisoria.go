package handler

import (
	"log"
	"net/http"
	"strings"

	"orion-api/lib"
)

// senhaMinima é o tamanho mínimo da senha que a pessoa cria para si. Mais
// que os 6 aceitos na senha temporária do gestor: esta é a senha que fica.
const senhaMinima = 8

// problemaNaSenhaNova valida a senha que a pessoa escolheu no lugar da
// provisória. Devolve a mensagem para a tela, ou "" quando está boa.
func problemaNaSenhaNova(senha string) string {
	if len(senha) < senhaMinima {
		return "A senha precisa ter pelo menos 8 caracteres."
	}
	if strings.TrimSpace(senha) != senha {
		return "A senha não pode começar nem terminar com espaço."
	}
	return ""
}

// trocarSenhaProvisoria troca a senha provisória (a do e-mail de boas-vindas
// ou a temporária definida pelo gestor) pela senha que a própria pessoa
// escolheu, e desliga a obrigação de troca (app_metadata.deve_trocar_senha).
// Só age sobre a conta de quem chama: o alvo é sempre o usuário da sessão.
//
// Rota: POST /api/functions/trocar-senha-provisoria  {"newPassword": "..."}
func trocarSenhaProvisoria(w http.ResponseWriter, r *http.Request) {
	u, err := requireAuth(r)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Autenticação necessária"})
		return
	}

	var req struct {
		NewPassword string `json:"newPassword"`
	}
	if err := lib.DecodeBody(r, &req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	if problema := problemaNaSenhaNova(req.NewPassword); problema != "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": problema})
		return
	}
	if sb == nil {
		lib.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{"error": "Serviço de autenticação indisponível"})
		return
	}

	senha := req.NewPassword
	if err := sb.AdminUpdateUserByID(r.Context(), u.ID, lib.AdminUpdateUserInput{
		Password:    &senha,
		AppMetadata: map[string]interface{}{lib.DeveTrocarSenha: false},
	}); err != nil {
		log.Printf("[ERRO] trocar senha provisória de %s: %v", u.ID, err)
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Não foi possível salvar a nova senha"})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true})
}
