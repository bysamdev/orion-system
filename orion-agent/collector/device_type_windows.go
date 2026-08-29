//go:build windows

package collector

import (
	"fmt"
	"strings"

	"github.com/yusufpapurcu/wmi"
)

// win32OperatingSystem espelha só os campos WMI que interessam para
// classificar a máquina como servidor: ProductType (1=estação de trabalho,
// 2=controladora de domínio, 3=servidor) é o critério oficial da Microsoft,
// mais confiável que inspecionar o texto de Caption — mas Caption entra
// como reforço para distribuições/edições que não populam ProductType como
// esperado.
type win32OperatingSystem struct {
	ProductType uint32
	Caption     string
}

// win32Battery: a simples presença de qualquer linha já indica bateria
// cadastrada no sistema (notebook), independente do estado de carga.
type win32Battery struct {
	Name string
}

// win32SystemEnclosure.ChassisTypes: código Win32 do tipo de gabinete. 8, 9,
// 10 e 14 cobrem Portátil/Laptop/Notebook/Sub-Notebook — usado como
// fallback quando Win32_Battery não retorna nada (bateria removida/gasta,
// ainda assim reconhecível pelo chassi).
//
// Campo declarado como []int32, não []uint16: embora o WMI documente
// ChassisTypes como um array de uint16, o VARIANT que chega via COM
// automation nesta consulta é tipado como inteiro de 32 bits com sinal —
// declarar como []uint16 faz github.com/yusufpapurcu/wmi entrar num branch
// reflect.Value.Uint() sobre um int32, que sempre entra em panic (verificado
// nesta máquina: TestCollect_PreencheDominioEUsuario). []int32 é o tipo que
// a própria lib usa nos exemplos para arrays WMI numéricos justamente por
// essa divergência entre o schema WMI e o VARIANT real.
type win32SystemEnclosure struct {
	ChassisTypes []int32
}

const (
	chassisPortatil    = 8
	chassisLaptop      = 9
	chassisNotebook    = 10
	chassisSubNotebook = 14
)

// detectarTipoDispositivo consulta o WMI (via github.com/yusufpapurcu/wmi,
// já usado indiretamente pelo gopsutil) em ordem de confiabilidade:
//  1. SO Server é definitivo, mesmo em hardware que "parece" notebook (raro,
//     mas possível numa VM de laptop);
//  2. bateria cadastrada é o sinal mais direto de notebook;
//  3. tipo de gabinete cobre o caso de bateria não reportada.
//
// Qualquer falha de consulta (WMI indisponível, permissão) simplesmente
// deixa a checagem passar para a próxima — best-effort, nunca bloqueia a
// coleta do resto do payload.
//
// Devolve também o motivo (Fase 3 do plano de escalabilidade: "armazenar
// tipo detectado e, se possível, motivo/confiança"). Se NENHUMA das três
// consultas WMI teve sucesso (não só "não bateu com notebook/servidor", mas
// literalmente falhou), o resultado é "unknown" em vez de presumir
// "desktop" sem nenhum sinal — o "desktop" antigo por omissão escondia a
// diferença entre "confirmamos que é desktop" e "não conseguimos
// determinar nada".
func detectarTipoDispositivo() (tipo, motivo string) {
	osOK, servidor, info := ehServidor()
	if servidor {
		return "server", fmt.Sprintf("Win32_OperatingSystem: ProductType=%d, Caption=%q", info.ProductType, info.Caption)
	}

	bateriaOK, temBateria := temBateriaCadastrada()
	if temBateria {
		return "notebook", "Win32_Battery: pelo menos uma bateria cadastrada"
	}

	chassiOK, notebook, tipoChassi := chassiDeNotebook()
	if notebook {
		return "notebook", fmt.Sprintf("Win32_SystemEnclosure.ChassisTypes contém %d (portátil/laptop/notebook)", tipoChassi)
	}

	if !osOK && !bateriaOK && !chassiOK {
		return "unknown", "nenhuma consulta WMI teve sucesso (WMI indisponível ou sem permissão)"
	}
	return "desktop", "sem sinal de servidor/bateria/chassi portátil"
}

func ehServidor() (sucesso, servidor bool, info win32OperatingSystem) {
	var resultado []win32OperatingSystem
	if err := wmi.Query("SELECT ProductType, Caption FROM Win32_OperatingSystem", &resultado); err != nil || len(resultado) == 0 {
		return false, false, win32OperatingSystem{}
	}
	info = resultado[0]
	if info.ProductType == 2 || info.ProductType == 3 {
		return true, true, info
	}
	return true, strings.Contains(strings.ToLower(info.Caption), "server"), info
}

func temBateriaCadastrada() (sucesso, tem bool) {
	var baterias []win32Battery
	if err := wmi.Query("SELECT Name FROM Win32_Battery", &baterias); err != nil {
		return false, false
	}
	return true, len(baterias) > 0
}

func chassiDeNotebook() (sucesso, notebook bool, tipoEncontrado int32) {
	var gabinetes []win32SystemEnclosure
	if err := wmi.Query("SELECT ChassisTypes FROM Win32_SystemEnclosure", &gabinetes); err != nil {
		return false, false, 0
	}
	for _, g := range gabinetes {
		for _, tipo := range g.ChassisTypes {
			switch tipo {
			case chassisPortatil, chassisLaptop, chassisNotebook, chassisSubNotebook:
				return true, true, tipo
			}
		}
	}
	return true, false, 0
}
