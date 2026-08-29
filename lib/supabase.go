package lib

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// SupabaseClient wraps the Supabase Auth Admin API.
type SupabaseClient struct {
	baseURL    string
	anonKey    string
	serviceKey string
	http       *http.Client
}

func NewSupabaseClient(baseURL, anonKey, serviceKey string) *SupabaseClient {
	return &SupabaseClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		anonKey:    anonKey,
		serviceKey: serviceKey,
		http:       &http.Client{Timeout: 20 * time.Second},
	}
}

type AuthFactor struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	FactorType string `json:"factor_type"`
}

type AuthUser struct {
	ID      string       `json:"id"`
	Email   string       `json:"email"`
	AAL     string       `json:"aal,omitempty"`
	Factors []AuthFactor `json:"factors,omitempty"`
}

func (c *SupabaseClient) GetUserByAccessToken(ctx context.Context, token string) (*AuthUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/auth/v1/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("apikey", c.anonKey)

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("supabase getUser: %s", string(b))
	}
	var u AuthUser
	if err := json.NewDecoder(res.Body).Decode(&u); err != nil {
		return nil, err
	}
	if u.ID == "" {
		return nil, fmt.Errorf("supabase getUser: user vazio")
	}
	return &u, nil
}

type CreateUserInput struct {
	Email        string                 `json:"email"`
	Password     string                 `json:"password"`
	EmailConfirm bool                   `json:"email_confirm"`
	UserMetadata map[string]interface{} `json:"user_metadata,omitempty"`
}

type CreateUserOutput struct {
	User struct {
		ID string `json:"id"`
	} `json:"user"`
}

func (c *SupabaseClient) AdminCreateUser(ctx context.Context, in CreateUserInput) (*CreateUserOutput, error) {
	return sbPost[CreateUserOutput](ctx, c, "/auth/v1/admin/users", in)
}

type AdminUpdateUserInput struct {
	Email    *string `json:"email,omitempty"`
	Password *string `json:"password,omitempty"`
}

func (c *SupabaseClient) AdminUpdateUserByID(ctx context.Context, userID string, in AdminUpdateUserInput) error {
	body, _ := json.Marshal(in)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut, c.baseURL+"/auth/v1/admin/users/"+userID, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("supabase updateUser: %s", string(b))
	}
	return nil
}

func (c *SupabaseClient) AdminDeleteUserByID(ctx context.Context, userID string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete, c.baseURL+"/auth/v1/admin/users/"+userID, nil)
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("supabase deleteUser: %s", string(b))
	}
	return nil
}

type GenerateLinkInput struct {
	Type          string `json:"type"`
	Email         string `json:"email"`
	RedirectTo    string `json:"redirect_to,omitempty"`
}

type GenerateLinkOutput struct {
	ActionLink string `json:"action_link"`
}

func (c *SupabaseClient) AdminGenerateLink(ctx context.Context, in GenerateLinkInput) (string, error) {
	out, err := sbPost[GenerateLinkOutput](ctx, c, "/auth/v1/admin/generate_link", in)
	if err != nil {
		return "", err
	}
	return out.ActionLink, nil
}

// InstaladorExiste verifica, via list (leve, alguns KB), se já existe um
// objeto com esse nome exato na "pasta" (prefixo) informada — usado pra
// pular o upload de ~16MB quando o instalador de uma empresa não mudou
// desde a última geração (ver caminhoDeterministico em installer.go: o
// nome do arquivo já embute um hash da configuração).
func (c *SupabaseClient) InstaladorExiste(ctx context.Context, pasta, nomeArquivo string) (bool, error) {
	body, _ := json.Marshal(map[string]any{"prefix": pasta, "limit": 100})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/storage/v1/object/list/agent-installers", bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return false, fmt.Errorf("listar instaladores: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return false, fmt.Errorf("listar instaladores: %s", string(b))
	}

	var itens []struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(res.Body).Decode(&itens); err != nil {
		return false, fmt.Errorf("decodificar lista de instaladores: %w", err)
	}
	for _, item := range itens {
		if item.Name == nomeArquivo {
			return true, nil
		}
	}
	return false, nil
}

// SubirInstalador envia os bytes do instalador pro bucket privado
// "agent-installers". Só deve ser chamado quando InstaladorExiste confirmar
// que o objeto ainda não existe — reenviar ~16MB numa geração repetida sem
// mudanças seria puro desperdício de banda e tempo de function.
func (c *SupabaseClient) SubirInstalador(ctx context.Context, caminho string, dados []byte) error {
	uploadReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/storage/v1/object/agent-installers/"+caminho, bytes.NewReader(dados))
	if err != nil {
		return err
	}
	uploadReq.Header.Set("Authorization", "Bearer "+c.serviceKey)
	uploadReq.Header.Set("apikey", c.serviceKey)
	uploadReq.Header.Set("Content-Type", "application/octet-stream")
	uploadReq.Header.Set("x-upsert", "true")

	res, err := c.http.Do(uploadReq)
	if err != nil {
		return fmt.Errorf("upload do instalador: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("upload do instalador: %s", string(b))
	}
	return nil
}

// AssinarInstalador gera a signed URL de download pra um objeto que já
// existe no bucket "agent-installers" — sempre chamada (mesmo em cache
// hit), já que a URL assinada expira em minutos e cada geração deve dar
// uma URL fresca.
func (c *SupabaseClient) AssinarInstalador(ctx context.Context, caminho, nomeDownload string, validadeSegundos int) (string, error) {
	signBody, _ := json.Marshal(map[string]int{"expiresIn": validadeSegundos})
	signReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/storage/v1/object/sign/agent-installers/"+caminho, bytes.NewReader(signBody))
	if err != nil {
		return "", err
	}
	signReq.Header.Set("Authorization", "Bearer "+c.serviceKey)
	signReq.Header.Set("apikey", c.serviceKey)
	signReq.Header.Set("Content-Type", "application/json")

	signRes, err := c.http.Do(signReq)
	if err != nil {
		return "", fmt.Errorf("assinar URL do instalador: %w", err)
	}
	defer signRes.Body.Close()
	if signRes.StatusCode < 200 || signRes.StatusCode >= 300 {
		b, _ := io.ReadAll(signRes.Body)
		return "", fmt.Errorf("assinar URL do instalador: %s", string(b))
	}

	var out struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.NewDecoder(signRes.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("decodificar signed URL: %w", err)
	}
	if out.SignedURL == "" {
		return "", fmt.Errorf("assinar URL do instalador: resposta sem signedURL")
	}

	separador := "?"
	if strings.Contains(out.SignedURL, "?") {
		separador = "&"
	}
	return c.baseURL + "/storage/v1" + out.SignedURL + separador + "download=" + url.QueryEscape(nomeDownload), nil
}

// sbPost is a helper for POST calls to the Supabase Admin API.
func sbPost[T any](ctx context.Context, c *SupabaseClient, path string, in any) (*T, error) {
	body, err := json.Marshal(in)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("supabase %s: %s", path, string(b))
	}
	var out T
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}
