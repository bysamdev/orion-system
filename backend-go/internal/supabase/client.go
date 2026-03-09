package supabase

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

type Client struct {
	baseURL    string
	anonKey    string
	serviceKey string
	http       *http.Client
}

func New(baseURL, anonKey, serviceKey string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		anonKey:    anonKey,
		serviceKey: serviceKey,
		http: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

type AuthUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func (c *Client) GetUserByAccessToken(ctx context.Context, accessToken string) (*AuthUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/auth/v1/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("apikey", c.anonKey)

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("supabase getUser falhou: %s", string(b))
	}

	var u AuthUser
	if err := json.NewDecoder(res.Body).Decode(&u); err != nil {
		return nil, err
	}
	if u.ID == "" {
		return nil, fmt.Errorf("supabase getUser retornou user vazio")
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

func (c *Client) AdminCreateUser(ctx context.Context, in CreateUserInput) (*CreateUserOutput, error) {
	body, err := json.Marshal(in)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/auth/v1/admin/users", bytes.NewReader(body))
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
		return nil, fmt.Errorf("supabase admin createUser falhou: %s", string(b))
	}

	var out CreateUserOutput
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}
	if out.User.ID == "" {
		return nil, fmt.Errorf("supabase createUser retornou id vazio")
	}
	return &out, nil
}

type AdminUpdateUserInput struct {
	Email    *string `json:"email,omitempty"`
	Password *string `json:"password,omitempty"`
}

func (c *Client) AdminUpdateUserByID(ctx context.Context, userID string, in AdminUpdateUserInput) error {
	body, err := json.Marshal(in)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.baseURL+"/auth/v1/admin/users/"+userID, bytes.NewReader(body))
	if err != nil {
		return err
	}
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
		return fmt.Errorf("supabase admin updateUser falhou: %s", string(b))
	}
	return nil
}

func (c *Client) AdminDeleteUserByID(ctx context.Context, userID string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.baseURL+"/auth/v1/admin/users/"+userID, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)

	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("supabase admin deleteUser falhou: %s", string(b))
	}
	return nil
}

