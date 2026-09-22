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
	// AppMetadata só o servidor escreve (o usuário não altera pelo cliente),
	// por isso é onde mora DeveTrocarSenha.
	AppMetadata map[string]interface{} `json:"app_metadata,omitempty"`
}

// DeveTrocarSenha é a chave de app_metadata que obriga a pessoa a criar a
// própria senha no próximo acesso: ligada quando a conta nasce com senha
// provisória e quando o gestor define uma senha temporária; desligada por
// /api/functions/trocar-senha-provisoria.
const DeveTrocarSenha = "deve_trocar_senha"

type CreateUserOutput struct {
	User struct {
		ID string `json:"id"`
	} `json:"user"`
}

func (c *SupabaseClient) AdminCreateUser(ctx context.Context, in CreateUserInput) (*CreateUserOutput, error) {
	return sbPost[CreateUserOutput](ctx, c, "/auth/v1/admin/users", in)
}

type AdminUpdateUserInput struct {
	Email       *string                `json:"email,omitempty"`
	Password    *string                `json:"password,omitempty"`
	AppMetadata map[string]interface{} `json:"app_metadata,omitempty"`
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

// SubirInstalador envia os bytes do instalador pro bucket privado
// "agent-installers" (upsert). Só é chamado quando o arquivo não existe ou
// foi gravado há mais de 30 minutos (DB.InstaladorRecente): regravar renova
// updated_at, que a limpeza usa para decidir o que já expirou.
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

// RemoverInstaladores apaga objetos do bucket de verdade — pelo endpoint do
// Storage, não por DELETE em storage.objects, que apagaria só o registro e
// deixaria os bytes órfãos ocupando a cota.
func (c *SupabaseClient) RemoverInstaladores(ctx context.Context, caminhos []string) error {
	if len(caminhos) == 0 {
		return nil
	}
	body, _ := json.Marshal(map[string]any{"prefixes": caminhos})
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete,
		c.baseURL+"/storage/v1/object/agent-installers", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("remover instaladores: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("remover instaladores: %s", string(b))
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
