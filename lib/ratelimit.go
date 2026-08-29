package lib

import (
	"context"
	"sync"
	"time"
)

// RateLimiter é um limitador de janela deslizante, em memória, por chave
// (tipicamente um endereço IP).
//
// LIMITAÇÃO IMPORTANTE, documentada de propósito: este backend roda como
// função serverless no Vercel — cada invocação pode cair numa instância
// "fria" diferente, e instâncias concorrentes não compartilham memória entre
// si. Um limitador em memória como este protege UMA instância isoladamente,
// não o agregado de todas as instâncias ativas ao mesmo tempo: na prática, o
// limite real observado pode ser N× o valor configurado, sendo N o número de
// instâncias atendendo requisições ao mesmo tempo. Ainda assim é defesa em
// profundidade real — hoje não existe limite nenhum nesses endpoints. A
// correção completa exigiria um contador centralizado (nova tabela no
// Postgres, ou um KV externo tipo Upstash/Vercel Edge Config), decisão de
// schema/infra fora do escopo desta correção.
type RateLimiter struct {
	mu      sync.Mutex
	janela  time.Duration
	limite  int
	acessos map[string][]time.Time
}

// NewRateLimiter cria um limitador que permite no máximo limite acessos por
// chave dentro de qualquer janela deslizante de duração janela.
func NewRateLimiter(janela time.Duration, limite int) *RateLimiter {
	return &RateLimiter{
		janela:  janela,
		limite:  limite,
		acessos: make(map[string][]time.Time),
	}
}

// Permitir registra uma tentativa para chave e devolve false se o limite da
// janela já foi atingido (a tentativa NÃO é descartada da contagem quando
// negada — tentativas repetidas continuam contando contra o solicitante).
func (rl *RateLimiter) Permitir(chave string) bool {
	agora := time.Now()
	corte := agora.Add(-rl.janela)

	rl.mu.Lock()
	defer rl.mu.Unlock()

	validos := make([]time.Time, 0, len(rl.acessos[chave]))
	for _, t := range rl.acessos[chave] {
		if t.After(corte) {
			validos = append(validos, t)
		}
	}

	permitido := len(validos) < rl.limite
	rl.acessos[chave] = append(validos, agora)

	// Faxina oportunista: se o mapa cresceu demais (muitas chaves distintas,
	// ex.: um scan de IPs), remove as que não têm nenhum acesso válido na
	// janela atual. Evita crescimento sem limite numa instância de longa
	// duração, sem precisar de uma goroutine de limpeza dedicada.
	if len(rl.acessos) > 10000 {
		for k, v := range rl.acessos {
			if len(v) == 0 || !v[len(v)-1].After(corte) {
				delete(rl.acessos, k)
			}
		}
	}

	return permitido
}

// AllowDB é a versão centralizada do limitador acima: em vez de um mapa em
// memória por instância, incrementa um contador de janela fixa em
// public.rate_limit_counters (Postgres), compartilhado por todas as
// instâncias serverless — resolve a limitação documentada em RateLimiter.
// Janela fixa (não deslizante) por simplicidade: suficiente para o caso de
// uso aqui (conter abuso/chave vazada), não para billing/quota exatos.
func (d *DB) AllowDB(ctx context.Context, bucketKey string, limit int, window time.Duration) (bool, error) {
	windowStart := time.Now().UTC().Truncate(window)
	var count int
	err := d.pool.QueryRow(ctx, `
INSERT INTO public.rate_limit_counters (bucket_key, window_start, count)
VALUES ($1, $2, 1)
ON CONFLICT (bucket_key, window_start) DO UPDATE
  SET count = public.rate_limit_counters.count + 1
RETURNING count`, bucketKey, windowStart).Scan(&count)
	if err != nil {
		return false, err
	}
	return count <= limit, nil
}
