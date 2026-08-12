//go:build windows

package main

import (
	"fmt"
	"testing"
)

// nomeMutexDeTeste gera um nome de mutex exclusivo desta execução de teste,
// usando o prefixo "Local\" (não "Global\") — suficiente para exercitar a
// mesma lógica de CreateMutex/ERROR_ALREADY_EXISTS sem exigir o privilégio
// necessário para criar objetos no namespace global, e sem qualquer risco de
// colidir com uma instância real do agente rodando na máquina.
func nomeMutexDeTeste(t *testing.T) string {
	t.Helper()
	return fmt.Sprintf(`Local\OrionAgentTeste-%s-%d`, t.Name(), len(t.Name()))
}

// TestGarantirInstanciaUnica_PrimeiraChamadaGanha garante que a primeira
// chamada com um nome ainda não usado devolve (true, nil).
func TestGarantirInstanciaUnica_PrimeiraChamadaGanha(t *testing.T) {
	unica, err := garantirInstanciaUnicaComNome(nomeMutexDeTeste(t))
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !unica {
		t.Error("primeira chamada com nome inédito deveria devolver true (somos a única instância)")
	}
}

// TestGarantirInstanciaUnica_SegundaChamadaComMesmoNomeDetectaOutraInstancia
// é o teste central: simula duas "instâncias" do agente disputando o mesmo
// mutex — a primeira ganha, a segunda precisa detectar que já existe.
func TestGarantirInstanciaUnica_SegundaChamadaComMesmoNomeDetectaOutraInstancia(t *testing.T) {
	nome := nomeMutexDeTeste(t)

	primeira, err := garantirInstanciaUnicaComNome(nome)
	if err != nil {
		t.Fatalf("primeira chamada: erro inesperado: %v", err)
	}
	if !primeira {
		t.Fatal("primeira chamada deveria devolver true")
	}

	segunda, err := garantirInstanciaUnicaComNome(nome)
	if err != nil {
		t.Fatalf("segunda chamada: erro inesperado: %v", err)
	}
	if segunda {
		t.Error("segunda chamada com o MESMO nome deveria devolver false (outra instância já rodando) — não detectou a duplicata")
	}
}

// TestGarantirInstanciaUnica_NomesDiferentesNaoInterferem garante que duas
// "instâncias" com nomes de mutex DIFERENTES não se veem — sanity check de
// que a exclusão é por nome, não global de fato.
func TestGarantirInstanciaUnica_NomesDiferentesNaoInterferem(t *testing.T) {
	a, err := garantirInstanciaUnicaComNome(nomeMutexDeTeste(t) + "-A")
	if err != nil {
		t.Fatalf("instância A: erro inesperado: %v", err)
	}
	b, err := garantirInstanciaUnicaComNome(nomeMutexDeTeste(t) + "-B")
	if err != nil {
		t.Fatalf("instância B: erro inesperado: %v", err)
	}

	if !a || !b {
		t.Errorf("instâncias com nomes diferentes deveriam ser ambas únicas: A=%v B=%v", a, b)
	}
}
