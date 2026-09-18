// Command orion-monitor sobe o Orion Monitor (ver pacote monitor).
//
// Variáveis de ambiente:
//
//	MONITOR_DATABASE_URL    Postgres próprio do monitor (obrigatória)
//	MONITOR_INGEST_SECRET   segredo compartilhado com a API do Orion (obrigatória)
//	PORT                    porta pública: ingest e saúde (padrão 9300)
//	METRICS_PORT            porta interna: /metrics para o Prometheus (padrão 9301)
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion-api/monitor"
)

func main() {
	dbURL := os.Getenv("MONITOR_DATABASE_URL")
	segredo := os.Getenv("MONITOR_INGEST_SECRET")
	if dbURL == "" || segredo == "" {
		log.Fatal("MONITOR_DATABASE_URL e MONITOR_INGEST_SECRET são obrigatórias")
	}
	porta := envOu("PORT", "9300")
	portaMetricas := envOu("METRICS_PORT", "9301")

	ctx, parar := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer parar()

	// O banco sobe junto no docker-compose e pode demorar alguns segundos a
	// aceitar conexão: tenta por até um minuto antes de desistir.
	var store *monitor.PgStore
	var err error
	for tentativa := 1; tentativa <= 12; tentativa++ {
		store, err = monitor.NovoPgStore(ctx, dbURL)
		if err == nil {
			break
		}
		log.Printf("[AVISO] banco do monitor indisponível (tentativa %d/12): %v", tentativa, err)
		time.Sleep(5 * time.Second)
	}
	if err != nil {
		log.Fatalf("banco do monitor: %v", err)
	}
	defer store.Close()

	srv := &monitor.Servidor{
		Store:         store,
		Metricas:      monitor.NovasMetricas(),
		SegredoIngest: segredo,
	}
	if err := srv.Carregar(ctx); err != nil {
		log.Printf("[AVISO] %v — métricas começam vazias até o próximo heartbeat", err)
	}

	publico := novoServidorHTTP(porta, srv.RotasPublicas())
	interno := novoServidorHTTP(portaMetricas, srv.RotasInternas())
	for _, h := range []*http.Server{publico, interno} {
		go func(h *http.Server) {
			log.Printf("Orion Monitor ouvindo em %s", h.Addr)
			if err := h.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Fatalf("servidor %s: %v", h.Addr, err)
			}
		}(h)
	}

	<-ctx.Done()
	desligar, cancelar := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelar()
	_ = publico.Shutdown(desligar)
	_ = interno.Shutdown(desligar)
	log.Println("Orion Monitor encerrado")
}

func envOu(chave, padrao string) string {
	if v := os.Getenv(chave); v != "" {
		return v
	}
	return padrao
}

func novoServidorHTTP(porta string, h http.Handler) *http.Server {
	return &http.Server{
		Addr:              ":" + porta,
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
}
