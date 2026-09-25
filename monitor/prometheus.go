package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"
)

// Prometheus lê o histórico das séries que o próprio monitor publica em
// /metrics. Fala com o Prometheus pela rede Docker; ele nunca fica exposto.
type Prometheus struct {
	URL     string
	Cliente *http.Client
}

var seriesDoHistorico = []struct {
	metrica string
	campo   func(p *PontoHistorico, v *float64)
}{
	{"orion_machine_cpu_percent", func(p *PontoHistorico, v *float64) { p.CPU = v }},
	{"orion_machine_memory_percent", func(p *PontoHistorico, v *float64) { p.RAM = v }},
	{"orion_machine_disk_percent", func(p *PontoHistorico, v *float64) { p.Disk = v }},
}

type respostaRange struct {
	Status string `json:"status"`
	Error  string `json:"error"`
	Data   struct {
		Result []struct {
			Values [][2]json.RawMessage `json:"values"`
		} `json:"result"`
	} `json:"data"`
}

// Historico devolve os pontos do mais recente para o mais antigo — o mesmo
// contrato que o painel já consumia do Supabase.
//
// Cada ponto é a média do passo (avg_over_time), não a amostra solta: com
// heartbeat de 5 min e passo de 1 min, sem a média o gráfico repetiria o
// mesmo valor cinco vezes e mostraria degraus.
func (p *Prometheus) Historico(ctx context.Context, id string, janela, passo time.Duration) ([]PontoHistorico, error) {
	if !uuidValido.MatchString(id) {
		return nil, fmt.Errorf("id inválido")
	}
	fim := time.Now()
	inicio := fim.Add(-janela)
	pontos := map[int64]*PontoHistorico{}

	for _, s := range seriesDoHistorico {
		consulta := fmt.Sprintf(`avg_over_time(%s{machine_id="%s"}[%ds])`, s.metrica, id, int(passo.Seconds()))
		valores, err := p.consultarRange(ctx, consulta, inicio, fim, passo)
		if err != nil {
			return nil, err
		}
		for ts, v := range valores {
			pt, ok := pontos[ts]
			if !ok {
				pt = &PontoHistorico{Em: time.Unix(ts, 0).UTC()}
				pontos[ts] = pt
			}
			valor := v
			s.campo(pt, &valor)
		}
	}

	out := make([]PontoHistorico, 0, len(pontos))
	for _, pt := range pontos {
		out = append(out, *pt)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Em.After(out[j].Em) })
	return out, nil
}

func (p *Prometheus) consultarRange(ctx context.Context, consulta string, inicio, fim time.Time, passo time.Duration) (map[int64]float64, error) {
	q := url.Values{}
	q.Set("query", consulta)
	q.Set("start", strconv.FormatInt(inicio.Unix(), 10))
	q.Set("end", strconv.FormatInt(fim.Unix(), 10))
	q.Set("step", strconv.Itoa(int(passo.Seconds())))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.URL+"/api/v1/query_range?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := p.Cliente.Do(req)
	if err != nil {
		return nil, fmt.Errorf("prometheus: %w", err)
	}
	defer resp.Body.Close()
	var r respostaRange
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, fmt.Errorf("prometheus: resposta inválida: %w", err)
	}
	if r.Status != "success" {
		return nil, fmt.Errorf("prometheus: %s", r.Error)
	}
	out := map[int64]float64{}
	if len(r.Data.Result) == 0 {
		return out, nil
	}
	for _, par := range r.Data.Result[0].Values {
		var ts float64
		var bruto string
		if json.Unmarshal(par[0], &ts) != nil || json.Unmarshal(par[1], &bruto) != nil {
			continue
		}
		v, err := strconv.ParseFloat(bruto, 64)
		if err != nil || math.IsNaN(v) || math.IsInf(v, 0) {
			continue
		}
		out[int64(ts)] = math.Round(v*10) / 10
	}
	return out, nil
}

type respostaInstantanea struct {
	Status string `json:"status"`
	Error  string `json:"error"`
	Data   struct {
		Result []struct {
			Metric map[string]string  `json:"metric"`
			Value  [2]json.RawMessage `json:"value"`
		} `json:"result"`
	} `json:"data"`
}

// PorRotulo roda uma consulta instantânea e devolve o valor de cada série
// indexado pelo rótulo pedido (ex.: link_id).
func (p *Prometheus) PorRotulo(ctx context.Context, consulta, rotulo string) (map[string]float64, error) {
	q := url.Values{}
	q.Set("query", consulta)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.URL+"/api/v1/query?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := p.Cliente.Do(req)
	if err != nil {
		return nil, fmt.Errorf("prometheus: %w", err)
	}
	defer resp.Body.Close()
	var r respostaInstantanea
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, fmt.Errorf("prometheus: resposta inválida: %w", err)
	}
	if r.Status != "success" {
		return nil, fmt.Errorf("prometheus: %s", r.Error)
	}
	out := map[string]float64{}
	for _, s := range r.Data.Result {
		var bruto string
		if json.Unmarshal(s.Value[1], &bruto) != nil {
			continue
		}
		v, err := strconv.ParseFloat(bruto, 64)
		if err != nil || math.IsNaN(v) || math.IsInf(v, 0) {
			continue
		}
		out[s.Metric[rotulo]] = v
	}
	return out, nil
}
