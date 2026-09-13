package service

import (
	"path/filepath"
	"testing"
	"time"
)

func TestDescreverStatus(t *testing.T) {
	agora := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	recente := estadoDoAgente{UltimoCheckinOK: agora.Add(-4 * time.Minute), IntervaloSegundos: 300}
	antigo := estadoDoAgente{UltimoCheckinOK: agora.Add(-16 * time.Minute), IntervaloSegundos: 300}

	casos := []struct {
		nome                        string
		estado                      estadoDoAgente
		instalado, rodando, legivel bool
		esperado                    string
	}{
		{"check-in recente com serviço no ar", recente, true, true, true, StatusConectado},
		{"serviço parado prevalece sobre check-in recente", recente, true, false, true, StatusServicoParado},
		{"nenhum check-in ainda", estadoDoAgente{}, true, true, true, StatusAguardandoCheckin},
		{"só falhas até agora", estadoDoAgente{UltimaFalha: agora}, true, true, true, StatusSemConexao},
		{"último check-in além de três intervalos", antigo, true, true, true, StatusSemConexao},
		{"bandeja sem acesso à identidade", recente, true, true, false, StatusSemAcessoIdentidad},
		{"sem serviço instalado, laço na própria bandeja", recente, false, false, true, StatusConectado},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := descreverStatus(c.estado, c.instalado, c.rodando, c.legivel, agora); got != c.esperado {
				t.Errorf("descreverStatus = %q, esperado %q", got, c.esperado)
			}
		})
	}
}

func TestToleranciaSemCheckin(t *testing.T) {
	if got := toleranciaSemCheckin(300); got != 15*time.Minute {
		t.Errorf("estação (300s) = %s, esperado 15m", got)
	}
	if got := toleranciaSemCheckin(30); got != 3*time.Minute {
		t.Errorf("intervalo curto = %s, esperado o piso de 3m", got)
	}
	if got := toleranciaSemCheckin(0); got != 15*time.Minute {
		t.Errorf("sem intervalo = %s, esperado o padrão de estação", got)
	}
}

func TestGravarELerEstado_RoundTrip(t *testing.T) {
	caminho := filepath.Join(t.TempDir(), "status.json")
	original := estadoDoAgente{
		UltimoCheckinOK:   time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC),
		IntervaloSegundos: 300,
	}
	if err := gravarEstadoEm(caminho, original); err != nil {
		t.Fatalf("gravarEstadoEm: %v", err)
	}
	// Segunda gravação sobre arquivo existente: o rename precisa substituir.
	original.IntervaloSegundos = 60
	if err := gravarEstadoEm(caminho, original); err != nil {
		t.Fatalf("regravar sobre arquivo existente: %v", err)
	}
	lido, err := lerEstadoDe(caminho)
	if err != nil {
		t.Fatalf("lerEstadoDe: %v", err)
	}
	if !lido.UltimoCheckinOK.Equal(original.UltimoCheckinOK) || lido.IntervaloSegundos != 60 {
		t.Errorf("lido = %+v, esperado %+v", lido, original)
	}
}
