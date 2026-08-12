package main

import (
	"strings"
	"testing"
)

// TestRedigirQueryRemoveCredencialDaURL cobre a correcao A.8.
//
// As URLs do portal carregam o machine_token na query string. Antes desta correcao,
// cada clique na bandeja gravava essa credencial em texto plano no agent.log.
// Este teste garante que nenhum valor de query volte a aparecer em log.
func TestRedigirQueryRemoveCredencialDaURL(t *testing.T) {
	const tokenSecreto = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"

	casos := []struct {
		nome     string
		entrada  string
		esperado string
	}{
		{
			nome:     "url do portal com token",
			entrada:  "https://orion.bysam.dev/api/auth/machine-login?token=" + tokenSecreto,
			esperado: "https://orion.bysam.dev/api/auth/machine-login?[redigido]",
		},
		{
			nome:     "url de novo chamado com token e redirect",
			entrada:  "https://orion.bysam.dev/api/auth/machine-login?token=" + tokenSecreto + "&redirect_to=/novo-ticket",
			esperado: "https://orion.bysam.dev/api/auth/machine-login?[redigido]",
		},
		{
			nome:     "url sem query permanece intacta",
			entrada:  "https://orion.bysam.dev/portal",
			esperado: "https://orion.bysam.dev/portal",
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			obtido := redigirQuery(c.entrada)
			if obtido != c.esperado {
				t.Errorf("redigirQuery() = %q, esperado %q", obtido, c.esperado)
			}
		})
	}
}

// TestRedigirQueryNuncaVazaOToken e a asserçao de seguranca central: independentemente
// do formato da URL, o valor do token nao pode sobreviver a redação.
func TestRedigirQueryNuncaVazaOToken(t *testing.T) {
	const tokenSecreto = "TOKEN-QUE-NAO-PODE-VAZAR-EM-LOG"

	entradas := []string{
		"https://orion.bysam.dev/api/auth/machine-login?token=" + tokenSecreto,
		"https://orion.bysam.dev/x?a=1&token=" + tokenSecreto + "&b=2",
		"http://localhost:8080/api/auth/machine-login?token=" + tokenSecreto,
	}

	for _, entrada := range entradas {
		obtido := redigirQuery(entrada)
		if strings.Contains(obtido, tokenSecreto) {
			t.Errorf("token vazou no log: redigirQuery(%q) = %q", entrada, obtido)
		}
	}
}

// TestRedigirQueryComURLInvalidaNaoEntraEmPanic garante que uma URL corrompida
// degrade para um marcador, em vez de derrubar o caminho de log.
func TestRedigirQueryComURLInvalidaNaoEntraEmPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("redigirQuery entrou em panic: %v", r)
		}
	}()

	// Byte de controle torna a URL inparseável.
	if obtido := redigirQuery("http://exemplo\x7f.com/?token=abc"); strings.Contains(obtido, "abc") {
		t.Errorf("token vazou mesmo com URL inválida: %q", obtido)
	}
}
