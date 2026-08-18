package collector

import (
	"testing"
)

func TestColetarStatusAtualizacoesNaoEntraEmPanico(t *testing.T) {
	upd := coletarStatusAtualizacoes()
	// Apenas verifica que executa sem pânico e retorna booleano
	_ = upd.RebootRequired
}
