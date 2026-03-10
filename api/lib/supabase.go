package lib

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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

type AuthUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
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
