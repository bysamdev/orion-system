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
func Send(cfg *config.Config, payload *collector.Payload) (string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal payload: %w", err)
	}

	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		machineID, err := doPost(cfg.APIURL, cfg.AgentKey, body)
		if err == nil {
			return machineID, nil
		}
		lastErr = err
		if attempt < maxRetries {
			time.Sleep(retryInterval)
		}
	}
	return "", fmt.Errorf("após %d tentativas: %w", maxRetries, lastErr)
}

func doPost(url, agentKey string, body []byte) (string, error) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("criar request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Agent-Key", agentKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errBody struct {
			Error string `json:"error"`
		}
		json.NewDecoder(resp.Body).Decode(&errBody)
		if errBody.Error != "" {
			return "", fmt.Errorf("status HTTP %d: %s", resp.StatusCode, errBody.Error)
		}
		return "", fmt.Errorf("status HTTP %d de %s", resp.StatusCode, url)
	}

	var res struct {
		MachineID string `json:"machine_id"`
	}
	json.NewDecoder(resp.Body).Decode(&res)
	return res.MachineID, nil
}

// Command represents a remote command to be executed.
type Command struct {
	ID      string `json:"ID"`
	Command string `json:"Command"`
}

// PollCommands checks for pending commands from the backend.
func PollCommands(cfg *config.Config, machineID string) ([]Command, error) {
	if machineID == "" {
		return nil, nil
	}
	url := fmt.Sprintf("%s/api/monitoring/commands/poll?machine_id=%s", cfg.APIURL, machineID)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("X-Agent-Key", cfg.AgentKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status error: %d", resp.StatusCode)
	}

	var cmds []Command
	if err := json.NewDecoder(resp.Body).Decode(&cmds); err != nil {
		return nil, err
	}
	return cmds, nil
}

// RespondToCommand sends the command output back to the backend.
func RespondToCommand(cfg *config.Config, commandID, status, output string) error {
	payload := map[string]string{
		"id":     commandID,
		"status": status,
		"output": output,
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/api/monitoring/commands/respond", cfg.APIURL)
	_, err := doPost(url, cfg.AgentKey, body)
	return err
}
