package sender

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"orion-agent/config"
	"orion-agent/collector"
)

const (
	maxRetries    = 3
	retryInterval = 10 * time.Second
	httpTimeout   = 15 * time.Second
)

var httpClient = &http.Client{Timeout: httpTimeout}

// Send POSTs the payload to the backend heartbeat endpoint.
// It retries up to maxRetries times, waiting retryInterval between attempts.
func Send(cfg *config.Config, payload *collector.Payload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		lastErr = doPost(cfg.APIURL, cfg.AgentKey, body)
		if lastErr == nil {
			return nil
		}
		if attempt < maxRetries {
			time.Sleep(retryInterval)
		}
	}
	return fmt.Errorf("após %d tentativas: %w", maxRetries, lastErr)
}

func doPost(url, agentKey string, body []byte) error {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("criar request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Agent-Key", agentKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("status HTTP %d de %s", resp.StatusCode, url)
	}
	return nil
}
