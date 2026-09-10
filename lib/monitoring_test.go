package lib

import (
	"testing"
	"time"
)

// TestMachineGhostEmail cobre o contrato que handler/auth_handlers.go
// (machineLogin) e monitoringMachineTickets (handler/mon_handlers.go)
// precisam bater byte a byte: os dois resolvem o mesmo e-mail-fantasma a
// partir do machine_token, e um só encontra os tickets do outro se o
// cálculo for idêntico nos dois lados.
func TestMachineGhostEmail(t *testing.T) {
	casos := []struct {
		nome     string
		token    string
		esperado string
	}{
		{
			nome:     "token longo usa os 12 primeiros chars",
			token:    "abcdef0123456789abcdef0123456789",
			esperado: "machine-abcdef012345@orion.internal",
		},
		{
			nome:     "token curto usa ele inteiro",
			token:    "curto123",
			esperado: "machine-curto123@orion.internal",
		},
		{
			nome:     "token com maiusculas vira minusculo",
			token:    "ABCDEF0123456789",
			esperado: "machine-abcdef012345@orion.internal",
		},
		{
			nome:     "token com exatamente 12 chars",
			token:    "123456789012",
			esperado: "machine-123456789012@orion.internal",
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := MachineGhostEmail(c.token); got != c.esperado {
				t.Errorf("MachineGhostEmail(%q) = %q, esperado %q", c.token, got, c.esperado)
			}
		})
	}
}

// TestJanelaAutoUpdateEmTransito_Limites protege o recorte por idade em
// HasPendingUpdateCommand. Curta demais e o backend empilha um comando novo
// enquanto o anterior ainda está instalando; sem limite (o comportamento
// antigo) um comando órfão em 'sent' — o que sobra quando a auto-atualização
// reinicia o próprio agente antes dele responder — trava toda atualização
// futura daquela máquina, inclusive o botão "Forçar atualização".
func TestJanelaAutoUpdateEmTransito_Limites(t *testing.T) {
	if JanelaAutoUpdateEmTransito <= 5*time.Minute {
		t.Errorf("janela de %v é curta demais: o agente faz poll a cada 30s e a "+
			"instalação envolve download, troca do executável e restart do serviço",
			JanelaAutoUpdateEmTransito)
	}
	if JanelaAutoUpdateEmTransito >= 24*time.Hour {
		t.Errorf("janela de %v é longa demais: um comando órfão seguraria o "+
			"rollout por um dia inteiro", JanelaAutoUpdateEmTransito)
	}
}

// TestAlertaPersisteHaPeloMenos cobre a histerese da abertura automática de
// chamado por alerta crítico de servidor (disco/antivírus, ver
// PersistenciaMinimaAlertaServidor em handler/mon_handlers.go): sem ela, o
// primeiro heartbeat que visse a condição já abriria chamado, mesmo pra um
// pico transitório de um minuto.
func TestAlertaPersisteHaPeloMenos(t *testing.T) {
	agora := time.Now()

	casos := []struct {
		nome          string
		persisteDesde time.Time
		minimo        time.Duration
		esperado      bool
	}{
		{"alerta zero-value (nunca existiu) nunca abre chamado", time.Time{}, PersistenciaMinimaAlertaServidor, false},
		{"acabou de abrir, ainda não persistiu", agora.Add(-1 * time.Minute), PersistenciaMinimaAlertaServidor, false},
		{"exatamente no limiar já conta", agora.Add(-PersistenciaMinimaAlertaServidor), PersistenciaMinimaAlertaServidor, true},
		{"bem além do limiar", agora.Add(-1 * time.Hour), PersistenciaMinimaAlertaServidor, true},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := AlertaPersisteHaPeloMenos(c.persisteDesde, agora, c.minimo); got != c.esperado {
				t.Errorf("AlertaPersisteHaPeloMenos(%v, agora, %v) = %v, esperado %v",
					c.persisteDesde, c.minimo, got, c.esperado)
			}
		})
	}
}
