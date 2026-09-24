package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sync"
	"time"
)

// Capacidade publica o último snapshot do Orion sem consultar o Supabase a
// cada scrape do Prometheus. Em uma falha, os valores antigos deixam de sair.
type Capacidade struct {
	mu       sync.RWMutex
	cliente  *http.Client
	url      string
	segredo  string
	snapshot capacidadeSnapshot
	valido   bool
}

type capacidadeSnapshot struct {
	BancoPct        float64 `json:"banco_pct"`
	ConexoesPct     float64 `json:"conexoes_pct"`
	StoragePct      float64 `json:"storage_pct"`
	TabelasRealtime float64 `json:"tabelas_realtime"`
	EgressPct       float64 `json:"egress_pct"`
}

func NovaCapacidade(url, segredo string, cliente *http.Client) *Capacidade {
	return &Capacidade{url: url, segredo: segredo, cliente: cliente}
}

func (c *Capacidade) Atualizar(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		c.invalidar()
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.segredo)
	resp, err := c.cliente.Do(req)
	if err != nil {
		c.invalidar()
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		c.invalidar()
		return fmt.Errorf("endpoint de capacidade respondeu %d", resp.StatusCode)
	}
	var campos map[string]json.RawMessage
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&campos); err != nil {
		c.invalidar()
		return fmt.Errorf("resposta de capacidade inválida: %w", err)
	}
	var snapshot capacidadeSnapshot
	for _, campo := range []struct {
		nome  string
		valor *float64
	}{
		{"banco_pct", &snapshot.BancoPct},
		{"conexoes_pct", &snapshot.ConexoesPct},
		{"storage_pct", &snapshot.StoragePct},
		{"tabelas_realtime", &snapshot.TabelasRealtime},
		{"egress_pct", &snapshot.EgressPct},
	} {
		if len(campos[campo.nome]) == 0 || json.Unmarshal(campos[campo.nome], campo.valor) != nil || math.IsNaN(*campo.valor) || math.IsInf(*campo.valor, 0) || *campo.valor < 0 {
			c.invalidar()
			return fmt.Errorf("campo de capacidade inválido: %s", campo.nome)
		}
	}
	c.mu.Lock()
	c.snapshot, c.valido = snapshot, true
	c.mu.Unlock()
	return nil
}

func (c *Capacidade) invalidar() {
	c.mu.Lock()
	c.valido = false
	c.mu.Unlock()
}

func (c *Capacidade) Escrever(w io.Writer) {
	c.mu.RLock()
	snapshot, valido := c.snapshot, c.valido
	c.mu.RUnlock()
	up := 0
	if valido {
		up = 1
	}
	fmt.Fprintf(w, "# HELP orion_supabase_capacity_up Última coleta de capacidade concluída\n# TYPE orion_supabase_capacity_up gauge\norion_supabase_capacity_up %d\n", up)
	if !valido {
		return
	}
	for _, metrica := range []struct {
		nome, ajuda string
		valor       float64
	}{
		{"orion_supabase_banco_percent", "Uso do banco em porcentagem", snapshot.BancoPct},
		{"orion_supabase_conexoes_percent", "Conexões Postgres em porcentagem", snapshot.ConexoesPct},
		{"orion_supabase_storage_percent", "Uso do Storage em porcentagem", snapshot.StoragePct},
		{"orion_supabase_realtime_tabelas", "Tabelas na publicação Realtime", snapshot.TabelasRealtime},
		{"orion_supabase_egress_percent", "Egress estimado em porcentagem", snapshot.EgressPct},
	} {
		fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s gauge\n%s %g\n", metrica.nome, metrica.ajuda, metrica.nome, metrica.nome, metrica.valor)
	}
}

// Coletar roda uma vez na inicialização e depois a cada 15 minutos.
func (c *Capacidade) Coletar(ctx context.Context, registrarErro func(error)) {
	coletar := func() {
		ctxColeta, cancelar := context.WithTimeout(ctx, 10*time.Second)
		defer cancelar()
		if err := c.Atualizar(ctxColeta); err != nil {
			registrarErro(err)
		}
	}
	coletar()
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			coletar()
		}
	}
}
