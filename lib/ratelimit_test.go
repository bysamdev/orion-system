package lib

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

// TestRateLimiter_PermiteAteOLimiteDepoisBloqueia garante o comportamento
// central: as primeiras `limite` chamadas passam, a próxima é bloqueada.
func TestRateLimiter_PermiteAteOLimiteDepoisBloqueia(t *testing.T) {
	rl := NewRateLimiter(time.Minute, 3)

	for i := 0; i < 3; i++ {
		if !rl.Permitir("1.2.3.4") {
			t.Fatalf("chamada %d deveria ser permitida (dentro do limite de 3)", i+1)
		}
	}
	if rl.Permitir("1.2.3.4") {
		t.Fatal("4ª chamada deveria ser bloqueada (limite de 3 excedido)")
	}
}

// TestRateLimiter_ChavesDiferentesNaoInterferem garante que o limite é por
// chave — um IP não consome a cota de outro.
func TestRateLimiter_ChavesDiferentesNaoInterferem(t *testing.T) {
	rl := NewRateLimiter(time.Minute, 2)

	for i := 0; i < 2; i++ {
		if !rl.Permitir("ip-a") {
			t.Fatalf("ip-a chamada %d deveria ser permitida", i+1)
		}
	}
	if rl.Permitir("ip-a") {
		t.Fatal("ip-a deveria estar bloqueado após esgotar sua cota")
	}

	// ip-b nunca chamou antes — deve ter cota própria, intacta.
	if !rl.Permitir("ip-b") {
		t.Fatal("ip-b deveria ser permitido: chaves diferentes têm cotas independentes")
	}
}

// TestRateLimiter_JanelaExpiraLiberaNovosAcessos garante que é uma janela
// DESLIZANTE, não um bloqueio permanente: passado o tempo da janela, novos
// acessos voltam a ser permitidos.
func TestRateLimiter_JanelaExpiraLiberaNovosAcessos(t *testing.T) {
	const janela = 50 * time.Millisecond
	rl := NewRateLimiter(janela, 1)

	if !rl.Permitir("chave") {
		t.Fatal("primeira chamada deveria ser permitida")
	}
	if rl.Permitir("chave") {
		t.Fatal("segunda chamada imediata deveria ser bloqueada (limite=1)")
	}

	time.Sleep(janela + 20*time.Millisecond)

	if !rl.Permitir("chave") {
		t.Fatal("após a janela expirar, uma nova chamada deveria ser permitida")
	}
}

// TestRateLimiter_ConcorrenciaRespeitaOLimiteExatamente dispara mais
// goroutines que o limite, todas para a MESMA chave, e verifica que
// exatamente `limite` delas foram permitidas — nem mais (estouraria o
// propósito do limitador), nem menos (indicaria contagem perdida). Como
// checagem e incremento acontecem sob o mesmo mutex, o resultado é
// determinístico mesmo sob concorrência.
func TestRateLimiter_ConcorrenciaRespeitaOLimiteExatamente(t *testing.T) {
	const limite = 20
	const goroutines = 200

	rl := NewRateLimiter(time.Minute, limite)

	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		permitidos int
	)

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			if rl.Permitir("mesma-chave") {
				mu.Lock()
				permitidos++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if permitidos != limite {
		t.Errorf("permitidos = %d, esperado exatamente %d", permitidos, limite)
	}
}

// TestRateLimiter_FaxinaRemoveApenasChavesRealmenteExpiradas garante que a
// faxina oportunista (quando o mapa cresce muito) só remove chaves SEM
// acesso válido na janela atual — nunca uma chave com uso recente.
//
// Janela curta de propósito: precisamos que as chaves "descartáveis" fiquem
// genuinamente expiradas (não apenas numerosas) para a faxina ter algo real
// para remover — com uma janela longa, nenhuma chave recém-populada jamais
// ficaria velha o bastante dentro da duração do teste, e o teste não
// exercitaria o caminho de remoção de verdade.
func TestRateLimiter_FaxinaRemoveApenasChavesRealmenteExpiradas(t *testing.T) {
	const janela = 30 * time.Millisecond
	rl := NewRateLimiter(janela, 100)

	// Popula muitas chaves distintas para passar do limiar de faxina (10000).
	for i := 0; i < 10001; i++ {
		rl.Permitir(fmt.Sprintf("ip-descartavel-%d", i))
	}

	// Deixa todas elas ficarem realmente expiradas.
	time.Sleep(janela + 20*time.Millisecond)

	// A primeira chamada de "chave-viva" empurra o mapa acima do limiar de
	// novo e dispara a faxina — as 10001 chaves descartáveis, agora
	// expiradas, devem ser removidas; "chave-viva" (recém-inserida) não pode
	// ser uma delas.
	if !rl.Permitir("chave-viva") {
		t.Fatal("primeira chamada de chave-viva deveria ser permitida")
	}

	// A chave recém-usada precisa continuar contando corretamente dentro da
	// SUA PRÓPRIA janela (ainda não expirou, foi inserida agora mesmo) — mais
	// (limite-1) chamadas ainda devem passar antes de bloquear.
	permitidos := 1 // já contamos a de cima
	for i := 0; i < 200; i++ {
		if rl.Permitir("chave-viva") {
			permitidos++
		}
	}
	if permitidos != 100 {
		t.Errorf("chave-viva permitiu %d acessos no total, esperado exatamente 100 (limite) — "+
			"a faxina pode ter descartado acessos válidos da própria chave-viva", permitidos)
	}
}
