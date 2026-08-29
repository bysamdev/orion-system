package sender

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"orion-agent/config"
	"orion-agent/collector"
)

const (
	maxRetries  = 3
	httpTimeout = 15 * time.Second
)

// retryBaseDelay é a base do backoff exponencial entre tentativas de Send.
// É var, não const, só para que os testes possam reduzi-la e exercitar o
// laço de retry inteiro em milissegundos — antes desta correção,
// retryInterval fixo de 10s fazia um teste do laço de retry levar ~20s reais,
// e ficava atrás de testing.Short()/ORION_TESTES_LENTOS só para não pesar a
// suíte padrão.
var retryBaseDelay = 2 * time.Second

var httpClient = &http.Client{Timeout: httpTimeout}

// retryComBackoff executa op até maxRetries vezes, com o mesmo backoff
// exponencial e jitter de calcularEspera entre tentativas. Extraído do laço
// que antes só existia em Send — poll/respond de comando não tinham
// nenhum retry (uma falha transitória de rede simplesmente descartava o
// resultado do ciclo, ver Fase 8 do plano de escalabilidade).
func retryComBackoff(op func() error) error {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		if err := op(); err == nil {
			return nil
		} else {
			lastErr = err
		}
		if attempt < maxRetries {
			time.Sleep(calcularEspera(attempt, rng))
		}
	}
	return fmt.Errorf("após %d tentativas: %w", maxRetries, lastErr)
}

// Send POSTs the payload to the backend heartbeat endpoint.
// It retries up to maxRetries times, com backoff exponencial e jitter entre
// as tentativas. O segundo valor devolvido é next_interval_seconds — a
// política de coleta por tipo de ativo que o backend calcula a partir do
// device_type gravado (Fase 4 do plano de escalabilidade); zero quando o
// backend não devolveu o campo (versão antiga do backend, ou corpo vazio).
func Send(cfg *config.Config, payload *collector.Payload) (string, int, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return "", 0, fmt.Errorf("marshal payload: %w", err)
	}

	url := cfg.APIURL
	if !strings.HasSuffix(url, "/api/monitoring/machines/heartbeat") {
		url = strings.TrimSuffix(url, "/") + "/api/monitoring/machines/heartbeat"
	}

	var machineID string
	var nextInterval int
	err = retryComBackoff(func() error {
		mID, interval, err := doPostComIntervalo(url, cfg.AgentKey, body)
		if err != nil {
			return err
		}
		machineID = mID
		nextInterval = interval
		return nil
	})
	if err != nil {
		return "", 0, err
	}
	return machineID, nextInterval, nil
}

// calcularEspera devolve o atraso antes da próxima tentativa: backoff
// exponencial (retryBaseDelay × 2^(tentativa-1)) mais um jitter aleatório de
// até metade do backoff.
//
// Sem jitter, uma queda do backend faria toda a frota de agentes bater na
// próxima tentativa no mesmo instante (thundering herd na retomada) — o
// jitter espalha essas tentativas. O parâmetro rng (em vez de math/rand
// global) é o que torna esta função testável de forma determinística.
func calcularEspera(tentativa int, rng *rand.Rand) time.Duration {
	backoff := retryBaseDelay * time.Duration(int64(1)<<uint(tentativa-1))
	// metade+1 é sempre >= 1 (backoff é sempre positivo, dado retryBaseDelay > 0 e
	// tentativa >= 1), então Int63n nunca recebe um argumento inválido aqui.
	metade := int64(backoff) / 2
	jitter := time.Duration(rng.Int63n(metade + 1))
	return backoff + jitter
}

func doPost(url, agentKey string, body []byte) (string, error) {
	machineID, _, err := doPostComIntervalo(url, agentKey, body)
	return machineID, err
}

// doPostComIntervalo é doPost mais o campo next_interval_seconds da
// resposta — só o heartbeat (Send) o interpreta (Fase 4 do plano de
// escalabilidade: política de coleta por tipo de ativo, decidida pelo
// backend a partir do device_type gravado); RespondToCommand ignora, via
// doPost, o valor que não faz sentido nesse endpoint.
func doPostComIntervalo(url, agentKey string, body []byte) (string, int, error) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", 0, fmt.Errorf("criar request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Agent-Key", agentKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errBody struct {
			Error string `json:"error"`
		}
		json.NewDecoder(resp.Body).Decode(&errBody)
		if errBody.Error != "" {
			return "", 0, fmt.Errorf("status HTTP %d: %s", resp.StatusCode, errBody.Error)
		}
		return "", 0, fmt.Errorf("status HTTP %d de %s", resp.StatusCode, url)
	}

	var res struct {
		MachineID           string `json:"machine_id"`
		NextIntervalSeconds int    `json:"next_interval_seconds"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		// Corpo vazio é resposta legítima para endpoints que não devolvem machine_id
		// (ex: /commands/respond), então io.EOF não é erro.
		if errors.Is(err, io.EOF) {
			return "", 0, nil
		}
		// Já um corpo malformado é falha real: antes desta correção o erro era
		// descartado e o agente seguia com machineID vazio, logando "[OK] Check-in
		// realizado" enquanto o polling de comandos nunca mais rodava.
		return "", 0, fmt.Errorf("resposta do servidor não é JSON válido: %w", err)
	}
	return res.MachineID, res.NextIntervalSeconds, nil
}

// Command represents a remote command to be executed.
type Command struct {
	ID      string `json:"id"`
	Command string `json:"command"`
}

// PollCommands checks for pending commands from the backend. Como Send,
// tenta até maxRetries vezes com backoff — antes desta correção uma falha
// de rede num poll simplesmente descartava o ciclo (sem prejuízo grave,
// já que o próximo poll é só 30s depois, mas ainda assim inconsistente com
// o tratamento dado ao heartbeat).
func PollCommands(cfg *config.Config, machineID string) ([]Command, error) {
	if machineID == "" {
		return nil, nil
	}
	baseURL := strings.TrimSuffix(cfg.APIURL, "/api/monitoring/machines/heartbeat")
	baseURL = strings.TrimSuffix(baseURL, "/")

	var cmds []Command
	err := retryComBackoff(func() error {
		req, err := http.NewRequest(http.MethodGet, baseURL+"/api/monitoring/commands/poll", nil)
		if err != nil {
			// Antes desta correção o erro era descartado com `req, _ :=` e a linha seguinte
			// (req.Header.Set) causava panic de nil pointer, derrubando o serviço inteiro.
			return fmt.Errorf("criar request de poll: %w", err)
		}

		// machineID vem do JSON do backend. Interpolá-lo cru na query permitia injeção de
		// parâmetros (um '&' no valor virava parâmetro extra) e quebrava o parse da URL.
		q := req.URL.Query()
		q.Set("machine_id", machineID)
		req.URL.RawQuery = q.Encode()

		req.Header.Set("X-Agent-Key", cfg.AgentKey)

		resp, err := httpClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("status error: %d", resp.StatusCode)
		}

		return json.NewDecoder(resp.Body).Decode(&cmds)
	})
	if err != nil {
		return nil, err
	}
	return cmds, nil
}

// RespondToCommand sends the command output back to the backend. Mesmo
// retry de PollCommands/Send — sem isso, uma falha transitória de rede
// perdia silenciosamente o resultado de um comando já executado.
func RespondToCommand(cfg *config.Config, commandID, status, output string) error {
	payload := map[string]string{
		"id":     commandID,
		"status": status,
		"output": output,
	}
	body, _ := json.Marshal(payload)
	baseURL := strings.TrimSuffix(cfg.APIURL, "/api/monitoring/machines/heartbeat")
	baseURL = strings.TrimSuffix(baseURL, "/")
	url := fmt.Sprintf("%s/api/monitoring/commands/respond", baseURL)
	return retryComBackoff(func() error {
		_, err := doPost(url, cfg.AgentKey, body)
		return err
	})
}
