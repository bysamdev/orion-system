package main

import (
	"errors"
	"testing"
	"time"
)

// Testes de esperarPrimeiroTokenVia — a correção real do bug reproduzido em
// máquina: o atalho da Área de Trabalho saía com URL=.../novo-ticket (sem
// token, exige login manual) porque era criado ANTES do serviço sequer
// existir pra gerar uma identidade. Agora o instalador espera o primeiro
// heartbeat gravar o token antes de criar o atalho.

// TestEsperarPrimeiroTokenVia_RetornaImediatoQuandoJaDisponivel cobre o
// caso comum: o serviço já terminou seu primeiro tick() antes do
// instalador sequer perguntar.
func TestEsperarPrimeiroTokenVia_RetornaImediatoQuandoJaDisponivel(t *testing.T) {
	inicio := time.Now()
	carregar := func() (string, error) { return "tok-pronto", nil }

	got := esperarPrimeiroTokenVia(carregar, 5*time.Second)

	if got != "tok-pronto" {
		t.Errorf("esperarPrimeiroTokenVia() = %q, esperado %q", got, "tok-pronto")
	}
	if decorrido := time.Since(inicio); decorrido > time.Second {
		t.Errorf("demorou %v pra retornar um valor já disponível — deveria ser quase instantâneo", decorrido)
	}
}

// TestEsperarPrimeiroTokenVia_RetentaAteConseguir simula o serviço levando
// algumas tentativas pra gravar o token (caso real: tick() ainda rodando a
// primeira coleta de hardware antes de persistir a identidade).
func TestEsperarPrimeiroTokenVia_RetentaAteConseguir(t *testing.T) {
	tentativas := 0
	carregar := func() (string, error) {
		tentativas++
		if tentativas < 3 {
			return "", errors.New("token file not found")
		}
		return "tok-apos-retries", nil
	}

	got := esperarPrimeiroTokenVia(carregar, 5*time.Second)

	if got != "tok-apos-retries" {
		t.Errorf("esperarPrimeiroTokenVia() = %q, esperado %q", got, "tok-apos-retries")
	}
	if tentativas != 3 {
		t.Errorf("tentativas = %d, esperado 3", tentativas)
	}
}

// TestEsperarPrimeiroTokenVia_DevolveVazioAoEstourarPrazo garante que o
// instalador não trava pra sempre esperando — se o serviço nunca conseguir
// gravar o token dentro do prazo, o instalador segue em frente (o atalho
// sai sem token dessa vez, mas o tick() do serviço corrige depois).
func TestEsperarPrimeiroTokenVia_DevolveVazioAoEstourarPrazo(t *testing.T) {
	carregar := func() (string, error) { return "", errors.New("token file not found") }

	inicio := time.Now()
	got := esperarPrimeiroTokenVia(carregar, 200*time.Millisecond)
	decorrido := time.Since(inicio)

	if got != "" {
		t.Errorf("esperarPrimeiroTokenVia() = %q, esperado vazio ao estourar o prazo", got)
	}
	if decorrido < 200*time.Millisecond {
		t.Errorf("retornou antes do prazo (%v decorrido, prazo era 200ms)", decorrido)
	}
	if decorrido > 2*time.Second {
		t.Errorf("demorou %v muito além do prazo de 200ms", decorrido)
	}
}

// TestEsperarPrimeiroTokenVia_IgnoraTokenVazioSemErro cobre o caso de
// token.LoadToken() devolver "" sem erro (arquivo existe mas está vazio —
// ver comportamento documentado de saveTokenTo com token vazio) — não deve
// ser tratado como sucesso, senão o atalho sairia com
// "...token=" (query string quebrada).
func TestEsperarPrimeiroTokenVia_IgnoraTokenVazioSemErro(t *testing.T) {
	tentativas := 0
	carregar := func() (string, error) {
		tentativas++
		if tentativas < 2 {
			return "", nil // arquivo existe, mas vazio — não é sucesso
		}
		return "tok-de-verdade", nil
	}

	got := esperarPrimeiroTokenVia(carregar, 5*time.Second)

	if got != "tok-de-verdade" {
		t.Errorf("esperarPrimeiroTokenVia() = %q, esperado %q (token vazio sem erro não deveria contar como sucesso)", got, "tok-de-verdade")
	}
}
