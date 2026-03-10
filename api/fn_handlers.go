package handler

// fn_handlers.go — handlers for /api/functions/* endpoints.
// These are equivalent to the existing backend-go /functions/* routes.

import (
	"crypto/rand"
	"errors"
	"fmt"
	"html/template"
	"math/big"
	"net/http"
	"strings"
	"time"

	"orion-api/lib"
)

// ─── AdminUpdateUser ─────────────────────────────────────────────────────────

type adminUpdateUserReq struct {
	UserID     string  `json:"user_id"`
	Email      *string `json:"email"`
	Password   *string `json:"password"`
	FullName   *string `json:"full_name"`
	Department *string `json:"department"`
	Role       *string `json:"role"`
	CompanyID  *string `json:"company_id"`
}

func adminUpdateUser(w http.ResponseWriter, r *http.Request) {
	u, err := requireAuth(r)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}
	if _, err := requireAdminOrDeveloper(r, u.ID); err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Apenas administradores e desenvolvedores podem atualizar usuários"})
		return
	}

	var req adminUpdateUserReq
	if err := lib.DecodeBody(r, &req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	if strings.TrimSpace(req.UserID) == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "user_id é obrigatório"})
		return
	}
	if req.Role != nil && req.UserID == u.ID {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Você não pode alterar sua própria função"})
		return
	}

	// Auth update (email/password)
	var authUp lib.AdminUpdateUserInput
	if req.Email != nil && strings.TrimSpace(*req.Email) != "" {
		v := strings.TrimSpace(*req.Email)
		authUp.Email = &v
	}
	if req.Password != nil && strings.TrimSpace(*req.Password) != "" {
		pw := strings.TrimSpace(*req.Password)
		if len(pw) < 6 {
			lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "A senha deve ter no mínimo 6 caracteres"})
			return
		}
		authUp.Password = &pw
	}
	if authUp.Email != nil || authUp.Password != nil {
		if err := sb.AdminUpdateUserByID(r.Context(), req.UserID, authUp); err != nil {
			lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao atualizar autenticação: %v", err)})
			return
		}
	}

	// Profile update
	up := lib.ProfileUpdate{}
	if req.FullName != nil && strings.TrimSpace(*req.FullName) != "" {
		v := strings.TrimSpace(*req.FullName)
		up.FullName = &v
	}
	if req.Department != nil {
		up.DepartmentProvided = true
		v := strings.TrimSpace(*req.Department)
		if v == "" {
			up.Department = nil
		} else {
			up.Department = &v
		}
	}
	if req.Email != nil && strings.TrimSpace(*req.Email) != "" {
		v := strings.TrimSpace(*req.Email)
		up.Email = &v
	}
	if req.CompanyID != nil && strings.TrimSpace(*req.CompanyID) != "" {
		cid := strings.TrimSpace(*req.CompanyID)
		exists, err := db.CompanyExists(r.Context(), cid)
		if err != nil {
			lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao validar empresa"})
			return
		}
		if !exists {
			lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Empresa não encontrada"})
			return
		}
		up.CompanyID = &cid
	}
	if up.FullName != nil || req.Department != nil || up.Email != nil || up.CompanyID != nil {
		if err := db.UpdateProfile(r.Context(), req.UserID, up); err != nil {
			lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao atualizar perfil: %v", err)})
			return
		}
	}
	if req.Role != nil && strings.TrimSpace(*req.Role) != "" {
		if err := db.UpdateUserRole(r.Context(), req.UserID, strings.TrimSpace(*req.Role)); err != nil {
			lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao atualizar função: %v", err)})
			return
		}
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Usuário atualizado com sucesso"})
}

// ─── DeleteUserAdmin ─────────────────────────────────────────────────────────

func deleteUserAdmin(w http.ResponseWriter, r *http.Request) {
	u, err := requireAuth(r)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}
	if _, err := requireAdminOrDeveloper(r, u.ID); err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Apenas administradores podem excluir usuários"})
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}
	if err := lib.DecodeBody(r, &req); err != nil || strings.TrimSpace(req.UserID) == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "user_id é obrigatório"})
		return
	}
	if req.UserID == u.ID {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Você não pode excluir sua própria conta"})
		return
	}

	targetEmail, _, err := db.ProfileByID(r.Context(), req.UserID)
	if err != nil {
		if errors.Is(err, lib.ErrNoRows) {
			lib.WriteJSON(w, http.StatusNotFound, map[string]any{"error": "Usuário não encontrado"})
			return
		}
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno"})
		return
	}

	if err := sb.AdminDeleteUserByID(r.Context(), req.UserID); err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao excluir usuário: %v", err)})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"message":      "Usuário excluído com sucesso",
		"deleted_user": map[string]any{"id": req.UserID, "email": targetEmail},
	})
}

// ─── CreateUserCredentials ───────────────────────────────────────────────────

func createUserCredentials(w http.ResponseWriter, r *http.Request) {
	u, err := requireAuth(r)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}
	if _, err := requireAdminOrDeveloper(r, u.ID); err != nil {
		lib.WriteJSON(w, http.StatusForbidden, map[string]any{"error": "Apenas administradores podem criar usuários"})
		return
	}
	if mailer == nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Serviço de e-mail não configurado"})
		return
	}

	var req struct {
		Email      string  `json:"email"`
		FullName   string  `json:"full_name"`
		Department *string `json:"department"`
		Role       string  `json:"role"`
		CompanyID  string  `json:"company_id"`
	}
	if err := lib.DecodeBody(r, &req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	req.FullName = strings.TrimSpace(req.FullName)
	req.Role = strings.TrimSpace(req.Role)
	req.CompanyID = strings.TrimSpace(req.CompanyID)
	if req.Email == "" || req.FullName == "" || req.Role == "" || req.CompanyID == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Dados obrigatórios ausentes: email, full_name, role, company_id"})
		return
	}

	n, err := rand.Int(rand.Reader, big.NewInt(9000))
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao gerar senha"})
		return
	}
	pw := fmt.Sprintf("Orion%04d", int(n.Int64()+1000))

	out, err := sb.AdminCreateUser(r.Context(), lib.CreateUserInput{
		Email: req.Email, Password: pw, EmailConfirm: true,
		UserMetadata: map[string]interface{}{"full_name": req.FullName},
	})
	if err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao criar usuário: %v", err)})
		return
	}
	userID := out.User.ID

	for i := 0; i < 6; i++ {
		if err := db.EnsureProfileRowExists(r.Context(), userID); err == nil {
			break
		}
		time.Sleep(250 * time.Millisecond)
	}

	profileUp := lib.ProfileUpdate{FullName: &req.FullName, CompanyID: &req.CompanyID, DepartmentProvided: true}
	if req.Department != nil {
		v := strings.TrimSpace(*req.Department)
		if v != "" {
			profileUp.Department = &v
		}
	}
	_ = db.UpdateProfile(r.Context(), userID, profileUp)
	if req.Role != "customer" {
		_ = db.UpdateUserRole(r.Context(), userID, req.Role)
	}

	emailHTML, _ := lib.RenderTemplate(`<!doctype html>
<html lang="pt-BR"><body style="font-family: Arial, sans-serif">
<h2>Bem-vindo ao Orion System</h2>
<p>Olá, {{.FullName}}!</p>
<p>Seu acesso foi criado. Use as credenciais abaixo:</p>
<ul>
  <li><strong>Link:</strong> <a href="{{.LoginURL}}">{{.LoginURL}}</a></li>
  <li><strong>Login:</strong> {{.Email}}</li>
  <li><strong>Senha provisória:</strong> {{.TempPassword}}</li>
</ul>
<p>Recomendamos alterar sua senha no primeiro acesso.</p>
</body></html>`, map[string]any{
		"FullName": req.FullName, "Email": req.Email,
		"LoginURL": cfg.LoginURL, "TempPassword": pw,
	})

	emailOut, err := mailer.Send(r.Context(), lib.SendEmailInput{
		To: req.Email, Subject: "Bem-vindo ao Orion System - Suas Credenciais", HTML: emailHTML,
	})
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao enviar e-mail: %v", err)})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"message":  fmt.Sprintf("Usuário criado e credenciais enviadas para %s", req.Email),
		"user_id":  userID,
		"email_id": emailOut.ID,
	})
}

// ─── CheckRateLimit ──────────────────────────────────────────────────────────

func checkRateLimit(w http.ResponseWriter, r *http.Request) {
	u, err := requireAuth(r)
	if err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Autenticação necessária"})
		return
	}

	now := time.Now()
	recent, err := db.RecentTicketsByUser(r.Context(), u.ID, now.Add(-2*time.Hour))
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao verificar histórico"})
		return
	}

	twoMin := 2 * time.Minute
	oneHour := time.Hour

	if len(recent) > 0 {
		last := recent[0].CreatedAt
		if now.Sub(last) < twoMin {
			remaining := int((twoMin - now.Sub(last) + time.Second - 1) / time.Second)
			lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
				"allowed":   false,
				"remaining": 0,
				"resetAt":   last.Add(twoMin).UTC().Format(time.RFC3339),
				"message":   fmt.Sprintf("Aguarde %d segundos antes de abrir outro chamado", remaining),
			})
			return
		}
	}

	windowStart := now.Add(-oneHour)
	count := 0
	for _, t := range recent {
		if t.CreatedAt.After(windowStart) {
			count++
		}
	}
	maxPerHour := 10
	if count >= maxPerHour {
		lib.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
			"allowed":   false,
			"remaining": 0,
			"resetAt":   now.Add(oneHour).UTC().Format(time.RFC3339),
			"message":   fmt.Sprintf("Limite de %d chamados por hora atingido", maxPerHour),
		})
		return
	}

	lib.WriteJSON(w, http.StatusOK, map[string]any{
		"allowed":   true,
		"remaining": maxPerHour - count - 1,
		"resetAt":   now.Add(oneHour).UTC().Format(time.RFC3339),
	})
}

// ─── SendPasswordChangedAlert ─────────────────────────────────────────────────

func sendPasswordChangedAlert(w http.ResponseWriter, r *http.Request) {
	if _, err := requireAuth(r); err != nil {
		lib.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}
	if mailer == nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Serviço de e-mail não configurado"})
		return
	}

	var req struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	}
	if err := lib.DecodeBody(r, &req); err != nil || strings.TrimSpace(req.Email) == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Email é obrigatório"})
		return
	}

	html, _ := lib.RenderTemplate(`<!doctype html>
<html lang="pt-BR"><body style="font-family: Arial, sans-serif">
<h2>Alerta de segurança</h2>
<p>Olá, {{.FullName}}!</p>
<p>Sua senha no Orion System foi alterada com sucesso.</p>
<p>Data e hora: {{.When}}</p>
<p>Se você não fez essa alteração, entre em contato com o suporte imediatamente.</p>
</body></html>`, map[string]any{
		"FullName": strings.TrimSpace(req.FullName),
		"When":     time.Now().Format("02/01/2006 15:04:05"),
	})

	out, err := mailer.Send(r.Context(), lib.SendEmailInput{
		To:      req.Email,
		Subject: "🔐 Alerta: Sua senha foi alterada - Orion System",
		HTML:    html,
	})
	if err != nil {
		lib.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao enviar alerta"})
		return
	}
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "email_id": out.ID})
}

// ─── ResetPasswordWithToken ───────────────────────────────────────────────────

func resetPasswordWithToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := lib.DecodeBody(r, &req); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	pw := strings.TrimSpace(req.NewPassword)
	if req.Token == "" || pw == "" {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Token e nova senha são obrigatórios"})
		return
	}
	if len(pw) < 6 {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "A senha deve ter no mínimo 6 caracteres"})
		return
	}

	tokenData, err := db.InviteTokenByToken(r.Context(), req.Token)
	if err != nil {
		if errors.Is(err, lib.ErrNoRows) {
			lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Token inválido ou expirado"})
			return
		}
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Erro ao validar token"})
		return
	}

	if time.Now().After(tokenData.ExpiresAt) {
		_ = db.DeleteInviteToken(r.Context(), req.Token)
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Token expirado"})
		return
	}

	userID, err := db.AuthUserIDByEmail(r.Context(), tokenData.Email)
	if err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "Usuário não encontrado"})
		return
	}

	if err := sb.AdminUpdateUserByID(r.Context(), userID, lib.AdminUpdateUserInput{Password: &pw}); err != nil {
		lib.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao atualizar senha: %v", err)})
		return
	}

	_ = db.DeleteInviteToken(r.Context(), req.Token)
	lib.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Senha definida com sucesso"})
}

// suppress unused import warning
var _ = template.HTMLEscapeString
