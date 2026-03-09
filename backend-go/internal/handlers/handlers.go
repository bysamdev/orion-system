package handlers

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"orion-system-backend/internal/config"
	"orion-system-backend/internal/db"
	"orion-system-backend/internal/email"
	"orion-system-backend/internal/supabase"
)

type Deps struct {
	Cfg    config.Config
	DB     *db.DB
	SB     *supabase.Client
	Mailer *email.Resend
}

type Handler struct {
	cfg    config.Config
	db     *db.DB
	sb     *supabase.Client
	mailer *email.Resend
}

func New(d Deps) *Handler {
	return &Handler{
		cfg:    d.Cfg,
		db:     d.DB,
		sb:     d.SB,
		mailer: d.Mailer,
	}
}

type authedUser struct {
	ID    string
	Email string
}

func (h *Handler) requireAuth(r *http.Request) (*authedUser, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, errors.New("não autorizado: token ausente")
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return nil, errors.New("não autorizado: header Authorization inválido")
	}
	u, err := h.sb.GetUserByAccessToken(r.Context(), parts[1])
	if err != nil {
		return nil, errors.New("não autorizado: token inválido ou expirado")
	}
	return &authedUser{ID: u.ID, Email: u.Email}, nil
}

func (h *Handler) requireAdminOrDeveloper(ctx context.Context, userID string) (string, error) {
	role, err := h.db.RoleByUserID(ctx, userID)
	if err != nil {
		return "", err
	}
	if role != "admin" && role != "developer" {
		return role, errors.New("proibido: sem permissão")
	}
	return role, nil
}

func tempPassword() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(9000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("Orion%04d", int(n.Int64()+1000)), nil
}

func renderTemplate(tpl string, data any) (string, error) {
	t, err := template.New("email").Parse(tpl)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	if err := t.Execute(&b, data); err != nil {
		return "", err
	}
	return b.String(), nil
}

func decodeBody(r *http.Request, out any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(out)
}

// ---- Endpoints ----

type AdminUpdateUserRequest struct {
	UserID     string  `json:"user_id"`
	Email      *string `json:"email"`
	Password   *string `json:"password"`
	FullName   *string `json:"full_name"`
	Department *string `json:"department"`
	Role       *string `json:"role"`
	CompanyID  *string `json:"company_id"`
}

func (h *Handler) AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	u, err := h.requireAuth(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": err.Error()})
		return
	}

	if _, err := h.requireAdminOrDeveloper(r.Context(), u.ID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]any{"error": "Proibido: Apenas administradores e desenvolvedores podem atualizar usuários"})
		return
	}

	var req AdminUpdateUserRequest
	if err := decodeBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	if strings.TrimSpace(req.UserID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "user_id é obrigatório"})
		return
	}

	// Bloqueio de auto-escalação de role
	if req.Role != nil && req.UserID == u.ID {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Proibido: Você não pode alterar sua própria função (role)"})
		return
	}

	// Atualizar Auth (email/senha)
	var authUpdate supabase.AdminUpdateUserInput
	if req.Email != nil && strings.TrimSpace(*req.Email) != "" {
		emailTrim := strings.TrimSpace(*req.Email)
		authUpdate.Email = &emailTrim
	}
	if req.Password != nil && strings.TrimSpace(*req.Password) != "" {
		pw := strings.TrimSpace(*req.Password)
		if len(pw) < 6 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "A senha deve ter no mínimo 6 caracteres"})
			return
		}
		authUpdate.Password = &pw
	}
	if authUpdate.Email != nil || authUpdate.Password != nil {
		if err := h.sb.AdminUpdateUserByID(r.Context(), req.UserID, authUpdate); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao atualizar autenticação: %v", err)})
			return
		}
	}

	// Atualizar profile
	up := db.ProfileUpdate{}
	if req.FullName != nil && strings.TrimSpace(*req.FullName) != "" {
		v := strings.TrimSpace(*req.FullName)
		up.FullName = &v
	}
	if req.Department != nil {
		up.DepartmentProvided = true
		// compatível com edge: string vazia vira null
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
		companyID := strings.TrimSpace(*req.CompanyID)
		exists, err := h.db.CompanyExists(r.Context(), companyID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno ao validar empresa"})
			return
		}
		if !exists {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Empresa não encontrada"})
			return
		}
		up.CompanyID = &companyID
	}

	if up.FullName != nil || req.Department != nil || up.Email != nil || up.CompanyID != nil {
		if err := h.db.UpdateProfile(r.Context(), req.UserID, up); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao atualizar perfil: %v", err)})
			return
		}
	}

	// Atualizar role
	if req.Role != nil && strings.TrimSpace(*req.Role) != "" {
		role := strings.TrimSpace(*req.Role)
		if err := h.db.UpdateUserRole(r.Context(), req.UserID, role); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao atualizar função: %v", err)})
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Usuário atualizado com sucesso"})
}

type DeleteUserRequest struct {
	UserID string `json:"user_id"`
}

func (h *Handler) DeleteUserAdmin(w http.ResponseWriter, r *http.Request) {
	u, err := h.requireAuth(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}

	if _, err := h.requireAdminOrDeveloper(r.Context(), u.ID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]any{"error": "Apenas administradores podem excluir usuários"})
		return
	}

	var req DeleteUserRequest
	if err := decodeBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	if strings.TrimSpace(req.UserID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "ID do usuário é obrigatório"})
		return
	}
	if req.UserID == u.ID {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Você não pode excluir sua própria conta"})
		return
	}

	targetEmail, _, err := h.db.ProfileByID(r.Context(), req.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Usuário não encontrado"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro interno do servidor"})
		return
	}

	if err := h.sb.AdminDeleteUserByID(r.Context(), req.UserID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao excluir usuário: %v", err)})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Usuário excluído com sucesso",
		"deleted_user": map[string]any{
			"id":    req.UserID,
			"email": targetEmail,
		},
	})
}

type CreateUserCredentialsRequest struct {
	Email      string  `json:"email"`
	FullName   string  `json:"full_name"`
	Department *string `json:"department"`
	Role       string  `json:"role"`
	CompanyID  string  `json:"company_id"`
}

func (h *Handler) CreateUserCredentials(w http.ResponseWriter, r *http.Request) {
	u, err := h.requireAuth(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}
	if _, err := h.requireAdminOrDeveloper(r.Context(), u.ID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]any{"error": "Apenas administradores podem criar usuários"})
		return
	}
	if h.mailer == nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Serviço de e-mail não configurado"})
		return
	}

	var req CreateUserCredentialsRequest
	if err := decodeBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	req.FullName = strings.TrimSpace(req.FullName)
	req.Role = strings.TrimSpace(req.Role)
	req.CompanyID = strings.TrimSpace(req.CompanyID)
	if req.Email == "" || req.FullName == "" || req.Role == "" || req.CompanyID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Dados obrigatórios ausentes: email, full_name, role, company_id"})
		return
	}

	pw, err := tempPassword()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao gerar senha provisória"})
		return
	}

	out, err := h.sb.AdminCreateUser(r.Context(), supabase.CreateUserInput{
		Email:        req.Email,
		Password:     pw,
		EmailConfirm: true,
		UserMetadata: map[string]interface{}{"full_name": req.FullName},
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao criar usuário: %v", err)})
		return
	}
	userID := out.User.ID

	// aguardar trigger handle_new_user criar profiles/user_roles
	for i := 0; i < 6; i++ {
		if err := h.db.EnsureProfileRowExists(r.Context(), userID); err == nil {
			break
		}
		time.Sleep(250 * time.Millisecond)
	}

	// Atualizar profile
	profileUp := db.ProfileUpdate{
		FullName:  &req.FullName,
		CompanyID: &req.CompanyID,
	}
	// nesta rota o frontend envia `department` como string|nil; se vier nil tratamos como "setar null"
	profileUp.DepartmentProvided = true
	if req.Department != nil {
		v := strings.TrimSpace(*req.Department)
		if v == "" {
			profileUp.Department = nil
		} else {
			profileUp.Department = &v
		}
	} else {
		profileUp.Department = nil
	}
	if err := h.db.UpdateProfile(r.Context(), userID, profileUp); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao atualizar perfil: %v", err)})
		return
	}

	if req.Role != "customer" {
		_ = h.db.UpdateUserRole(r.Context(), userID, req.Role)
	}

	emailHTML, err := renderTemplate(`
<!doctype html>
<html lang="pt-BR">
  <body style="font-family: Arial, sans-serif">
    <h2>Bem-vindo ao Orion System</h2>
    <p>Olá, {{.FullName}}!</p>
    <p>Seu acesso foi criado. Use as credenciais abaixo:</p>
    <ul>
      <li><strong>Link:</strong> <a href="{{.LoginURL}}">{{.LoginURL}}</a></li>
      <li><strong>Login:</strong> {{.Email}}</li>
      <li><strong>Senha provisória:</strong> {{.TempPassword}}</li>
    </ul>
    <p>Recomendamos alterar sua senha no primeiro acesso.</p>
  </body>
</html>
`, map[string]any{
		"FullName":     req.FullName,
		"Email":        req.Email,
		"LoginURL":     h.cfg.LoginURL,
		"TempPassword": pw,
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao montar e-mail"})
		return
	}

	emailOut, err := h.mailer.Send(r.Context(), email.SendEmailInput{
		To:      req.Email,
		Subject: "Bem-vindo ao Orion System - Suas Credenciais",
		HTML:    emailHTML,
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Erro ao enviar e-mail: %v", err)})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"message":  fmt.Sprintf("Usuário criado e credenciais enviadas para %s", req.Email),
		"user_id":  userID,
		"email_id": emailOut.ID,
	})
}

type RateLimitResponse struct {
	Allowed   bool   `json:"allowed"`
	Remaining int    `json:"remaining"`
	ResetAt   string `json:"resetAt"`
	Message   string `json:"message,omitempty"`
}

func (h *Handler) CheckRateLimit(w http.ResponseWriter, r *http.Request) {
	u, err := h.requireAuth(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Autenticação necessária"})
		return
	}

	now := time.Now()
	twoHoursAgo := now.Add(-2 * time.Hour)
	recent, err := h.db.RecentTicketsByUser(r.Context(), u.ID, twoHoursAgo)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao verificar histórico de tickets"})
		return
	}

	twoMinutes := 2 * time.Minute
	oneHour := 1 * time.Hour

	if len(recent) > 0 {
		last := recent[0].CreatedAt
		if now.Sub(last) < twoMinutes {
			remainingSeconds := int((twoMinutes - now.Sub(last) + time.Second - 1) / time.Second)
			resetAt := last.Add(twoMinutes).UTC().Format(time.RFC3339)
			writeJSON(w, http.StatusTooManyRequests, RateLimitResponse{
				Allowed:   false,
				Remaining: 0,
				ResetAt:   resetAt,
				Message:   fmt.Sprintf("Aguarde %d segundos antes de abrir outro chamado", remainingSeconds),
			})
			return
		}
	}

	windowStart := now.Add(-oneHour)
	ticketsLastHour := 0
	var oldestInWindow *time.Time
	for i := len(recent) - 1; i >= 0; i-- {
		if recent[i].CreatedAt.After(windowStart) {
			ticketsLastHour++
			t := recent[i].CreatedAt
			oldestInWindow = &t
		}
	}

	maxPerHour := 10
	if ticketsLastHour >= maxPerHour {
		resetAt := now.Add(oneHour).UTC().Format(time.RFC3339)
		if oldestInWindow != nil {
			resetAt = oldestInWindow.Add(oneHour).UTC().Format(time.RFC3339)
		}
		writeJSON(w, http.StatusTooManyRequests, RateLimitResponse{
			Allowed:   false,
			Remaining: 0,
			ResetAt:   resetAt,
			Message:   fmt.Sprintf("Limite de %d chamados por hora atingido. Tente novamente mais tarde", maxPerHour),
		})
		return
	}

	remaining := maxPerHour - ticketsLastHour - 1
	resetAt := now.Add(oneHour).UTC().Format(time.RFC3339)
	writeJSON(w, http.StatusOK, RateLimitResponse{
		Allowed:   true,
		Remaining: remaining,
		ResetAt:   resetAt,
	})
}

type PasswordChangedAlertRequest struct {
	Email    string `json:"email"`
	FullName string `json:"full_name"`
}

func (h *Handler) SendPasswordChangedAlert(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireAuth(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Não autorizado"})
		return
	}
	if h.mailer == nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Serviço de e-mail não configurado"})
		return
	}

	var req PasswordChangedAlertRequest
	if err := decodeBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Email é obrigatório"})
		return
	}

	emailHTML, err := renderTemplate(`
<!doctype html>
<html lang="pt-BR">
  <body style="font-family: Arial, sans-serif">
    <h2>Alerta de segurança</h2>
    <p>Olá, {{.FullName}}!</p>
    <p>Sua senha no Orion System foi alterada com sucesso.</p>
    <p>Data e hora: {{.When}}</p>
    <p>Se você não fez essa alteração, entre em contato com o suporte imediatamente.</p>
  </body>
</html>
`, map[string]any{
		"FullName": strings.TrimSpace(req.FullName),
		"When":     time.Now().Format("02/01/2006 15:04:05"),
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao montar e-mail"})
		return
	}

	out, err := h.mailer.Send(r.Context(), email.SendEmailInput{
		To:      req.Email,
		Subject: "🔐 Alerta: Sua senha foi alterada - Orion System",
		HTML:    emailHTML,
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "Erro ao enviar alerta"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "email_id": out.ID})
}

type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

func (h *Handler) ResetPasswordWithToken(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := decodeBody(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Body inválido"})
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" || strings.TrimSpace(req.NewPassword) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token e nova senha são obrigatórios"})
		return
	}
	if len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "A senha deve ter no mínimo 6 caracteres"})
		return
	}

	tokenData, err := h.db.InviteTokenByToken(r.Context(), req.Token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token inválido ou expirado"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Erro ao validar token"})
		return
	}

	if time.Now().After(tokenData.ExpiresAt) {
		_ = h.db.DeleteInviteToken(r.Context(), req.Token)
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Token expirado"})
		return
	}

	userID, err := h.db.AuthUserIDByEmail(r.Context(), tokenData.Email)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Usuário não encontrado"})
		return
	}

	pw := strings.TrimSpace(req.NewPassword)
	if err := h.sb.AdminUpdateUserByID(r.Context(), userID, supabase.AdminUpdateUserInput{Password: &pw}); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Erro ao atualizar senha: %v", err)})
		return
	}

	_ = h.db.DeleteInviteToken(r.Context(), req.Token)

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Senha definida com sucesso"})
}

