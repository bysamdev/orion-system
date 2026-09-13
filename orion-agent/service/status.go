package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"orion-agent/token"
)

// estadoDoAgente é o que o laço de heartbeat publica, a cada check-in, para a
// bandeja mostrar o estado REAL da conexão.
//
// Antes, a bandeja dizia "conectado" só por conseguir ler a identidade da
// máquina — o que não prova nada sobre o servidor — e "conectando…" quando não
// conseguia, mesmo com o serviço fazendo check-in normalmente. Como bandeja e
// serviço são processos diferentes (sessão do usuário x NT SERVICE\OrionAgent),
// a informação passa por um arquivo ao lado da identidade, legível pelo usuário
// interativo (ver token/acl_windows.go). Não contém segredo nem mensagem de erro.
type estadoDoAgente struct {
	UltimoCheckinOK   time.Time `json:"ultimo_checkin_ok"`
	UltimaFalha       time.Time `json:"ultima_falha"`
	IntervaloSegundos int       `json:"intervalo_segundos"`
}

const (
	StatusConectado          = "conectado"
	StatusAguardandoCheckin  = "aguardando primeiro check-in…"
	StatusSemConexao         = "sem conexão com o servidor"
	StatusServicoParado      = "serviço parado"
	StatusSemAcessoIdentidad = "sem acesso à identidade da máquina"
)

func caminhoDoEstado() string {
	return filepath.Join(filepath.Dir(token.GetTokenPath()), "status.json")
}

// gravarEstadoEm grava via arquivo temporário + rename, para a bandeja nunca
// ler um JSON pela metade.
func gravarEstadoEm(caminho string, e estadoDoAgente) error {
	dados, err := json.Marshal(e)
	if err != nil {
		return err
	}
	temp := caminho + ".tmp"
	if err := os.WriteFile(temp, dados, 0644); err != nil {
		return err
	}
	return os.Rename(temp, caminho)
}

func lerEstadoDe(caminho string) (estadoDoAgente, error) {
	var e estadoDoAgente
	dados, err := os.ReadFile(caminho)
	if err != nil {
		return e, err
	}
	err = json.Unmarshal(dados, &e)
	return e, err
}

// toleranciaSemCheckin é quanto tempo sem check-in bem-sucedido ainda conta
// como "conectado": três intervalos, com piso de 3 minutos — um heartbeat
// perdido isolado não pisca o status.
func toleranciaSemCheckin(intervaloSegundos int) time.Duration {
	if intervaloSegundos <= 0 {
		intervaloSegundos = 300
	}
	t := 3 * time.Duration(intervaloSegundos) * time.Second
	if t < 3*time.Minute {
		t = 3 * time.Minute
	}
	return t
}

// descreverStatus traduz o estado publicado no texto da bandeja. Pura, para
// ser testável sem serviço, arquivo ou relógio reais.
func descreverStatus(e estadoDoAgente, servicoInstalado, servicoRodando, identidadeLegivel bool, agora time.Time) string {
	if servicoInstalado && !servicoRodando {
		return StatusServicoParado
	}
	if e.UltimoCheckinOK.IsZero() {
		if !e.UltimaFalha.IsZero() {
			return StatusSemConexao
		}
		return StatusAguardandoCheckin
	}
	if !identidadeLegivel {
		return StatusSemAcessoIdentidad
	}
	if agora.Sub(e.UltimoCheckinOK) > toleranciaSemCheckin(e.IntervaloSegundos) {
		return StatusSemConexao
	}
	return StatusConectado
}

// registrarCheckin atualiza o estado em memória e o publica em disco. Roda só
// na goroutine do laço (tick), mas o estado em memória também é lido pela
// bandeja quando ela mesma roda o laço (sem serviço instalado) — daí o mutex.
func (s *Svc) registrarCheckin(ok bool) {
	agora := time.Now()
	intervalo := s.proximoIntervaloSegundos
	if intervalo <= 0 && s.cfg != nil {
		intervalo = s.cfg.IntervalSeconds
	}

	s.mu.Lock()
	if ok {
		s.estado.UltimoCheckinOK = agora
	} else {
		s.estado.UltimaFalha = agora
	}
	s.estado.IntervaloSegundos = intervalo
	copia := s.estado
	s.mu.Unlock()

	if err := gravarEstadoEm(caminhoDoEstado(), copia); err != nil && !s.falhaAoGravarEstadoLogada {
		s.falhaAoGravarEstadoLogada = true
		s.logger.Printf("[AVISO] Não foi possível publicar o status para a bandeja (%s): %v", caminhoDoEstado(), err)
	}
}

// StatusParaBandeja devolve o texto de status que a bandeja deve mostrar.
// servicoInstalado/servicoRodando vêm do SCM (main.go); quando o serviço não
// está instalado, é este mesmo processo que roda o laço.
func (s *Svc) StatusParaBandeja(servicoInstalado, servicoRodando bool) string {
	if s.getMachineToken() == "" {
		_ = s.PreloadMachineToken()
	}
	identidadeLegivel := s.TokenDaMaquina() != ""

	e, err := lerEstadoDe(caminhoDoEstado())
	s.mu.RLock()
	memoria := s.estado
	s.mu.RUnlock()
	if err != nil || memoria.UltimoCheckinOK.After(e.UltimoCheckinOK) {
		e = memoria
	}

	return descreverStatus(e, servicoInstalado, servicoRodando, identidadeLegivel, time.Now())
}
