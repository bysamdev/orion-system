package lib

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

// grafanaProxyStub simula só o suficiente do endpoint
// /api/datasources/proxy/uid/{uid}/api/v1/query_range que
// queryPrometheusRange consome: um vector com um ponto por série.
func grafanaProxyStub(hitCount *int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(hitCount, 1)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"success","data":{"resultType":"matrix","result":[{"metric":{},"values":[[1700000000,"1.5"]]}]}}`))
	}))
}

// limparCacheMetricsHistory evita que o estado global do cache vaze entre
// testes (o cache é por processo, não por teste).
func limparCacheMetricsHistory() {
	metricsHistoryCacheMu.Lock()
	metricsHistoryCache = map[string]metricsHistoryCacheEntry{}
	metricsHistoryCacheMu.Unlock()
}

func TestQueryMachineMetricsHistory_SegundaChamadaIgualUsaCache(t *testing.T) {
	limparCacheMetricsHistory()
	var hits int32
	srv := grafanaProxyStub(&hits)
	defer srv.Close()

	ctx := context.Background()
	machineID := "11111111-1111-1111-1111-111111111111"

	if _, err := QueryMachineMetricsHistory(ctx, srv.URL, "token", "ds-uid", "", machineID, "1h"); err != nil {
		t.Fatalf("primeira chamada: %v", err)
	}
	firstHits := atomic.LoadInt32(&hits)
	if firstHits != 5 {
		t.Fatalf("esperava 5 chamadas ao Grafana (cpu/ram_used/ram_total/disk_used/disk_total), fez %d", firstHits)
	}

	if _, err := QueryMachineMetricsHistory(ctx, srv.URL, "token", "ds-uid", "", machineID, "1h"); err != nil {
		t.Fatalf("segunda chamada: %v", err)
	}
	if got := atomic.LoadInt32(&hits); got != firstHits {
		t.Errorf("segunda chamada (mesma máquina/período) deveria vir do cache; hits foi de %d para %d", firstHits, got)
	}
}

func TestQueryMachineMetricsHistory_PeriodoDiferenteNaoUsaCache(t *testing.T) {
	limparCacheMetricsHistory()
	var hits int32
	srv := grafanaProxyStub(&hits)
	defer srv.Close()

	ctx := context.Background()
	machineID := "22222222-2222-2222-2222-222222222222"

	if _, err := QueryMachineMetricsHistory(ctx, srv.URL, "token", "ds-uid", "", machineID, "1h"); err != nil {
		t.Fatalf("chamada com period=1h: %v", err)
	}
	if _, err := QueryMachineMetricsHistory(ctx, srv.URL, "token", "ds-uid", "", machineID, "24h"); err != nil {
		t.Fatalf("chamada com period=24h: %v", err)
	}

	if got := atomic.LoadInt32(&hits); got != 10 {
		t.Errorf("períodos diferentes são chaves de cache diferentes; esperava 10 chamadas ao Grafana (5+5), fez %d", got)
	}
}

func TestQueryMachineMetricsHistory_MachineIDInvalidoNaoChamaGrafana(t *testing.T) {
	limparCacheMetricsHistory()
	var hits int32
	srv := grafanaProxyStub(&hits)
	defer srv.Close()

	_, err := QueryMachineMetricsHistory(context.Background(), srv.URL, "token", "ds-uid", "", `bad"id`, "1h")
	if err == nil {
		t.Fatal("esperava erro para machine_id com aspas")
	}
	if got := atomic.LoadInt32(&hits); got != 0 {
		t.Errorf("machine_id inválido não deveria nem chamar o Grafana; hits=%d", got)
	}
}
