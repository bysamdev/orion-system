package lib

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ResendClient sends transactional emails via Resend.
type ResendClient struct {
	apiKey string
	from   string
	http   *http.Client
}

func NewResend(apiKey, from string) *ResendClient {
	return &ResendClient{
		apiKey: apiKey,
		from:   from,
		http:   &http.Client{Timeout: 20 * time.Second},
	}
}

type SendEmailInput struct {
	To      string
	Subject string
	HTML    string
}

type SendEmailOutput struct {
	ID string `json:"id"`
}

func (r *ResendClient) Send(ctx context.Context, in SendEmailInput) (*SendEmailOutput, error) {
	payload := map[string]any{
		"from":    r.from,
		"to":      []string{in.To},
		"subject": in.Subject,
		"html":    in.HTML,
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+r.apiKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		body, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("resend: %s", string(body))
	}
	var out SendEmailOutput
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}
