//go:build windows

package collector

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	modWtsapi32                     = windows.NewLazySystemDLL("wtsapi32.dll")
	procWTSQuerySessionInformationW = modWtsapi32.NewProc("WTSQuerySessionInformationW")
	procWTSFreeMemory               = modWtsapi32.NewProc("WTSFreeMemory")
)

type wtsInfoClass uint32

const (
	wtsUserName   wtsInfoClass = 5
	wtsDomainName wtsInfoClass = 7
)

// usuarioDaSessaoAtiva resolve domínio, usuário e SID da sessão de CONSOLE
// ativa no momento (WTSGetActiveConsoleSessionId) — não do processo do
// agente em si.
//
// Isso importa porque o agente roda como serviço Windows sob a conta
// NT SERVICE\OrionAgent (correção A.4): os.Getenv("USERNAME")/USERDOMAIN
// nesse contexto refletem a conta de serviço, não quem está de fato logado
// na tela — limitação documentada em ARCHITECTURE.md §2.2/§4. Consultar a
// sessão de console via WTS resolve isso quando há um usuário interativo.
//
// WTSQuerySessionInformation não é exposta por golang.org/x/sys/windows
// (verificado em v0.20.0) — vinculada aqui diretamente via wtsapi32.dll,
// mesmo padrão que o próprio pacote x/sys/windows usa internamente para
// APIs Win32 não cobertas por uma função Go dedicada.
//
// O SID resultante é dado puramente informativo de inventário — nunca usado
// para autenticação/autorização (SECURITY-AUTO-PROVISIONING.md §4.2/§4.4).
func usuarioDaSessaoAtiva() (dominio, usuario, sid string, err error) {
	sessionID := windows.WTSGetActiveConsoleSessionId()
	if sessionID == 0xFFFFFFFF {
		return "", "", "", fmt.Errorf("nenhuma sessão de console ativa")
	}

	usuario, err = consultarSessao(sessionID, wtsUserName)
	if err != nil {
		return "", "", "", fmt.Errorf("consultar usuário da sessão %d: %w", sessionID, err)
	}
	if usuario == "" {
		return "", "", "", fmt.Errorf("sessão %d sem usuário associado (tela de logon)", sessionID)
	}

	dominio, err = consultarSessao(sessionID, wtsDomainName)
	if err != nil {
		return "", "", "", fmt.Errorf("consultar domínio da sessão %d: %w", sessionID, err)
	}

	nomeCompleto := usuario
	if dominio != "" {
		nomeCompleto = dominio + `\` + usuario
	}
	sidResolvido, _, _, sidErr := windows.LookupSID("", nomeCompleto)
	if sidErr != nil {
		// Não é fatal: ainda devolvemos domínio/usuário mesmo sem o SID.
		return dominio, usuario, "", nil
	}
	return dominio, usuario, sidResolvido.String(), nil
}

func consultarSessao(sessionID uint32, infoClass wtsInfoClass) (string, error) {
	// buf já nasce com o tipo Go correto (*uint16): a chamada escreve o
	// endereço do buffer alocado pelo Windows em &buf. Evita converter um
	// uintptr solto de volta para unsafe.Pointer na leitura (o que o `go
	// vet` sinaliza como possível uso indevido, corretamente — aqui não
	// seria um bug real, já que a memória é alocada pelo próprio Windows e
	// liberada explicitamente via WTSFreeMemory, não pelo GC do Go, mas o
	// checker não tem como saber disso).
	var buf *uint16
	var bytesReturned uint32

	r, _, e := procWTSQuerySessionInformationW.Call(
		0, // WTS_CURRENT_SERVER_HANDLE
		uintptr(sessionID),
		uintptr(infoClass),
		uintptr(unsafe.Pointer(&buf)),
		uintptr(unsafe.Pointer(&bytesReturned)),
	)
	if r == 0 {
		return "", e
	}
	defer procWTSFreeMemory.Call(uintptr(unsafe.Pointer(buf)))

	if buf == nil || bytesReturned == 0 {
		return "", nil
	}
	return windows.UTF16PtrToString(buf), nil
}
