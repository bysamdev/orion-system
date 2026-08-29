//go:build windows

package collector

import (
	"fmt"
	"os"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

var (
	modWtsapi32                     = windows.NewLazySystemDLL("wtsapi32.dll")
	procWTSQuerySessionInformationW = modWtsapi32.NewProc("WTSQuerySessionInformationW")
	procWTSFreeMemory               = modWtsapi32.NewProc("WTSFreeMemory")

	modNetapi32               = windows.NewLazySystemDLL("netapi32.dll")
	procNetGetJoinInformation = modNetapi32.NewProc("NetGetJoinInformation")
	procNetApiBufferFree      = modNetapi32.NewProc("NetApiBufferFree")
)

type wtsInfoClass uint32

const (
	wtsUserName   wtsInfoClass = 5
	wtsDomainName wtsInfoClass = 7
)

// obterDominioMaquina consulta a API Win32 NetGetJoinInformation para identificar com precisão
// se a máquina faz parte de um Domínio Active Directory (NetSetupDomainName = 3) ou WORKGROUP.
func obterDominioMaquina() string {
	var nameBuf *uint16
	var joinStatus uint32

	r, _, _ := procNetGetJoinInformation.Call(
		0,
		uintptr(unsafe.Pointer(&nameBuf)),
		uintptr(unsafe.Pointer(&joinStatus)),
	)
	if r == 0 && nameBuf != nil {
		defer procNetApiBufferFree.Call(uintptr(unsafe.Pointer(nameBuf)))
		name := windows.UTF16PtrToString(nameBuf)
		name = strings.TrimSpace(name)
		if name != "" {
			// joinStatus 3 = NetSetupDomainName (Domínio Active Directory)
			// joinStatus 2 = NetSetupWorkgroupName (Grupo de Trabalho)
			return name
		}
	}

	// Fallback via USERDNSDOMAIN (definido em ambientes Active Directory)
	if dnsDomain := strings.TrimSpace(os.Getenv("USERDNSDOMAIN")); dnsDomain != "" {
		return dnsDomain
	}

	// Fallback se USERDOMAIN for diferente do COMPUTERNAME
	userDomain := strings.TrimSpace(os.Getenv("USERDOMAIN"))
	computerName := strings.TrimSpace(os.Getenv("COMPUTERNAME"))
	if userDomain != "" && computerName != "" && !strings.EqualFold(userDomain, computerName) {
		return userDomain
	}

	return "WORKGROUP"
}

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
		// Tenta resolver apenas com o usuário local se falhar com DOMINIO\usuario
		if sidResolvido2, _, _, sidErr2 := windows.LookupSID("", usuario); sidErr2 == nil {
			return dominio, usuario, sidResolvido2.String(), nil
		}
		// Não é fatal: ainda devolvemos domínio/usuário mesmo sem o SID.
		return dominio, usuario, "", nil
	}
	return dominio, usuario, sidResolvido.String(), nil
}

// ultimoUsuarioLogado lê HKLM\...\Authentication\LogonUI\LastLoggedOnUser —
// o Windows grava esse valor a cada logon interativo bem-sucedido,
// independente de quem está perguntando. Diferente de usuarioDaSessaoAtiva
// (que exige consultar a sessão de OUTRO processo via WTS, permissão que a
// conta de serviço NT SERVICE\OrionAgent não tem — ver A.4), isto é uma
// leitura de registro comum, sem checagem cross-session.
//
// Fallback de dois estágios, não substituto: não reflete quem está logado
// agora neste segundo (pode estar desatualizado se um usuário diferente
// logou por RDP e saiu, por exemplo), mas é muito melhor que reportar a
// própria conta de serviço — o problema que motivou essa função.
func ultimoUsuarioLogado() (dominio, usuario string) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\LogonUI`, registry.QUERY_VALUE)
	if err != nil {
		return "", ""
	}
	defer k.Close()

	val, _, err := k.GetStringValue("LastLoggedOnUser")
	if err != nil {
		return "", ""
	}
	val = strings.TrimSpace(val)
	if val == "" {
		return "", ""
	}

	partes := strings.SplitN(val, `\`, 2)
	if len(partes) == 2 {
		return strings.TrimSpace(partes[0]), strings.TrimSpace(partes[1])
	}
	return "", val
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
