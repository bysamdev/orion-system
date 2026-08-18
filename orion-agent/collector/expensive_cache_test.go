package collector

import (
	"testing"
	"time"
)

// Os testes abaixo inspecionam diretamente os timestamps *Em (mesmo pacote,
// teste "white-box") em vez de tentar inferir cache pelo valor retornado:
// Security/RemoteSoftware/Battery/UpdateStatus não mudam entre duas chamadas
// consecutivas de verdade de qualquer forma (com ou sem cache), então só o
// timestamp prova se a função cara por trás foi chamada de novo ou não.

// TestSegurancaComCache_ReaproveitaDentroDoTTL garante que uma segunda
// chamada dentro do TTL não recoleta — segurancaEm não deve avançar.
func TestSegurancaComCache_ReaproveitaDentroDoTTL(t *testing.T) {
	segurancaEm = time.Time{}
	original := ttlColetaCara
	ttlColetaCara = time.Minute
	defer func() { ttlColetaCara = original }()

	segurancaComCache()
	primeiraColeta := segurancaEm

	segurancaComCache()
	if !segurancaEm.Equal(primeiraColeta) {
		t.Error("segurancaComCache() recoletou dentro do TTL — cache não foi reaproveitado")
	}
}

// TestSegurancaComCache_RecolheAposExpirarTTL garante que, passado o TTL, a
// próxima chamada recoleta de verdade — segurancaEm deve avançar.
func TestSegurancaComCache_RecolheAposExpirarTTL(t *testing.T) {
	original := ttlColetaCara
	ttlColetaCara = time.Millisecond
	defer func() { ttlColetaCara = original }()

	segurancaComCache()
	primeiraColeta := segurancaEm

	time.Sleep(5 * time.Millisecond)
	segurancaComCache()
	if !segurancaEm.After(primeiraColeta) {
		t.Error("segurancaComCache() não recoletou após o TTL expirar")
	}
}

func TestSoftwareRemotoComCache_ReaproveitaDentroDoTTL(t *testing.T) {
	softwareEm = time.Time{}
	original := ttlColetaCara
	ttlColetaCara = time.Minute
	defer func() { ttlColetaCara = original }()

	softwareRemotoComCache()
	primeiraColeta := softwareEm

	softwareRemotoComCache()
	if !softwareEm.Equal(primeiraColeta) {
		t.Error("softwareRemotoComCache() recoletou dentro do TTL — cache não foi reaproveitado")
	}
}

func TestSoftwareRemotoComCache_RecolheAposExpirarTTL(t *testing.T) {
	original := ttlColetaCara
	ttlColetaCara = time.Millisecond
	defer func() { ttlColetaCara = original }()

	softwareRemotoComCache()
	primeiraColeta := softwareEm

	time.Sleep(5 * time.Millisecond)
	softwareRemotoComCache()
	if !softwareEm.After(primeiraColeta) {
		t.Error("softwareRemotoComCache() não recoletou após o TTL expirar")
	}
}

func TestBateriaComCache_ReaproveitaDentroDoTTL(t *testing.T) {
	bateriaEm = time.Time{}
	original := ttlBateria
	ttlBateria = time.Minute
	defer func() { ttlBateria = original }()

	bateriaComCache()
	primeiraColeta := bateriaEm

	bateriaComCache()
	if !bateriaEm.Equal(primeiraColeta) {
		t.Error("bateriaComCache() recoletou dentro do TTL — cache não foi reaproveitado")
	}
}

func TestBateriaComCache_RecolheAposExpirarTTL(t *testing.T) {
	original := ttlBateria
	ttlBateria = time.Millisecond
	defer func() { ttlBateria = original }()

	bateriaComCache()
	primeiraColeta := bateriaEm

	time.Sleep(5 * time.Millisecond)
	bateriaComCache()
	if !bateriaEm.After(primeiraColeta) {
		t.Error("bateriaComCache() não recoletou após o TTL expirar")
	}
}

func TestAtualizacoesComCache_ReaproveitaDentroDoTTL(t *testing.T) {
	atualizacoesEm = time.Time{}
	original := ttlColetaCara
	ttlColetaCara = time.Minute
	defer func() { ttlColetaCara = original }()

	atualizacoesComCache()
	primeiraColeta := atualizacoesEm

	atualizacoesComCache()
	if !atualizacoesEm.Equal(primeiraColeta) {
		t.Error("atualizacoesComCache() recoletou dentro do TTL — cache não foi reaproveitado")
	}
}

func TestAtualizacoesComCache_RecolheAposExpirarTTL(t *testing.T) {
	original := ttlColetaCara
	ttlColetaCara = time.Millisecond
	defer func() { ttlColetaCara = original }()

	atualizacoesComCache()
	primeiraColeta := atualizacoesEm

	time.Sleep(5 * time.Millisecond)
	atualizacoesComCache()
	if !atualizacoesEm.After(primeiraColeta) {
		t.Error("atualizacoesComCache() não recoletou após o TTL expirar")
	}
}
