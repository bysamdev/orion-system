package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config holds all agent configuration.
type Config struct {
	APIURL          string `yaml:"api_url"`
	AgentKey        string `yaml:"agent_key"`
	IntervalSeconds int    `yaml:"interval_seconds"`
	LogFile         string `yaml:"log_file"`
}

const defaultYAML = `# Orion Agent Configuration
# api_url: URL base do seu sistema (ex: https://orion.bysam.dev)
api_url: http://localhost:8080
agent_key: COLOQUE_SUA_CHAVE_AQUI
interval_seconds: 60
log_file: agent.log
`

// Load reads agent.yaml from the same directory as the executable.
// If the file does not exist, it creates one with default values.
func Load() (*Config, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("não foi possível determinar o diretório do executável: %w", err)
	}
	dir := filepath.Dir(exe)
	path := filepath.Join(dir, "agent.yaml")

	// Create default config file if missing
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if werr := os.WriteFile(path, []byte(defaultYAML), 0644); werr != nil {
			return nil, fmt.Errorf("erro ao criar agent.yaml: %w", werr)
		}
		fmt.Printf("agent.yaml criado em %s — configure antes de iniciar o agente.\n", path)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler agent.yaml: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("agent.yaml inválido: %w", err)
	}

	if err := aplicarDefaultsEValidar(&cfg, path); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// aplicarDefaultsEValidar preenche os valores padrão e valida a configuração.
//
// Está separada de Load porque Load resolve o caminho do arquivo via os.Executable(),
// o que impede os testes de exercitá-la sem criar um agent.yaml ao lado do binário.
// Com esta função os testes cobrem as regras reais de default e validação.
func aplicarDefaultsEValidar(cfg *Config, path string) error {
	// Apply defaults
	if cfg.IntervalSeconds <= 0 {
		cfg.IntervalSeconds = 60
	}
	if cfg.LogFile == "" {
		cfg.LogFile = "agent.log"
	}
	if cfg.APIURL == "" {
		// Correção B.15: o default anterior era a URL COMPLETA do endpoint de
		// heartbeat ("http://localhost:8080/api/monitoring/machines/heartbeat"),
		// não a URL base do servidor. sender.Send tem um TrimSuffix específico
		// para tolerar isso, mas GetPortalURL/GetTicketURL (service/windows.go)
		// e shortcut.CreatePortalShortcut concatenam "/api/auth/machine-login"
		// direto em cima de cfg.APIURL — com o default antigo, essas URLs
		// saíam quebradas (".../heartbeat/api/auth/machine-login"). O default
		// agora é a URL base, como api_url é documentado em agent.yaml.
		cfg.APIURL = "http://localhost:8080"
	}

	if cfg.AgentKey == "" || cfg.AgentKey == "COLOQUE_SUA_CHAVE_AQUI" {
		return fmt.Errorf("configure o campo 'agent_key' no arquivo %s", path)
	}

	if err := validarEsquemaAPIURL(cfg.APIURL); err != nil {
		return fmt.Errorf("%w (arquivo %s)", err, path)
	}

	return nil
}

// validarEsquemaAPIURL exige HTTPS para qualquer destino que saia da máquina.
//
// Sem isso, um agent.yaml com "http://" é aceito silenciosamente e a agent_key —
// credencial de longa duração, sem rotação — trafega em texto claro em todo heartbeat,
// junto do machine_token e dos dados de inventário.
//
// Exceção deliberada: destinos de loopback (localhost/127.0.0.1/::1) continuam podendo
// usar http, porque o tráfego não atravessa a rede e isso mantém o desenvolvimento local
// viável. É o mesmo critério que os navegadores aplicam para "secure context".
func validarEsquemaAPIURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("'api_url' inválida: %v", err)
	}

	switch strings.ToLower(u.Scheme) {
	case "https":
		return nil
	case "http":
		if ehLoopback(u.Hostname()) {
			return nil
		}
		return fmt.Errorf(
			"'api_url' deve usar https:// — valor atual %q enviaria a agent_key em texto claro pela rede", raw)
	default:
		return fmt.Errorf("'api_url' deve usar https:// — valor atual %q não é uma URL http(s) válida", raw)
	}
}

func ehLoopback(host string) bool {
	switch strings.ToLower(host) {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return false
}
