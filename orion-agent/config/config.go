package config

import (
	"fmt"
	"os"
	"path/filepath"

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
# api_url: endpoint de heartbeat do backend Go (NÃO é a URL do frontend)
api_url: http://localhost:8080/api/monitoring/machines/heartbeat
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

	// Apply defaults
	if cfg.IntervalSeconds <= 0 {
		cfg.IntervalSeconds = 60
	}
	if cfg.LogFile == "" {
		cfg.LogFile = "agent.log"
	}
	if cfg.APIURL == "" {
		cfg.APIURL = "http://localhost:8080/api/monitoring/machines/heartbeat"
	}

	if cfg.AgentKey == "" || cfg.AgentKey == "COLOQUE_SUA_CHAVE_AQUI" {
		return nil, fmt.Errorf("configure o campo 'agent_key' no arquivo %s", path)
	}

	return &cfg, nil
}
