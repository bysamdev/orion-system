//go:build windows

package collector

import "github.com/yusufpapurcu/wmi"

// win32SoftwareLicensingProduct espelha só os campos necessários do WMI
// root\CIMV2\SoftwareLicensingProduct para o produto de licenciamento do
// próprio Windows (filtrado por ApplicationID abaixo).
type win32SoftwareLicensingProduct struct {
	LicenseStatus uint32
	Name          string
}

// applicationIDWindows é o GUID fixo e documentado da Microsoft para o
// "Application ID" de licenciamento do Windows em si — SoftwareLicensingProduct
// também lista Office e outros produtos licenciados via a mesma infraestrutura;
// sem esse filtro a consulta pode devolver múltiplas linhas não relacionadas
// ao SO.
const applicationIDWindows = "55c92734-d682-4d71-983e-d6ec3f16059f"

// mapearStatusAtivacao converte o código LicenseStatus do WMI em texto legível.
// Valores documentados pela Microsoft para SoftwareLicensingProduct.LicenseStatus.
func mapearStatusAtivacao(codigo uint32) string {
	switch codigo {
	case 0:
		return "Unlicensed"
	case 1:
		return "Licensed"
	case 2:
		return "OOBGrace"
	case 3:
		return "OOTGrace"
	case 4:
		return "NonGenuineGrace"
	case 5:
		return "Notification"
	case 6:
		return "ExtendedGrace"
	default:
		return "Unknown"
	}
}

// coletarAtivacao consulta o WMI para determinar se a licença do Windows
// desta máquina está ativada.
func coletarAtivacao() ActivationInfo {
	var produtos []win32SoftwareLicensingProduct
	query := "SELECT LicenseStatus, Name FROM SoftwareLicensingProduct WHERE PartialProductKey IS NOT NULL AND ApplicationID='" + applicationIDWindows + "'"
	if err := wmi.Query(query, &produtos); err != nil || len(produtos) == 0 {
		return ActivationInfo{Activated: false, Status: "Unknown"}
	}

	// PartialProductKey IS NOT NULL já restringe a produtos de fato instalados;
	// em praticamente todo Windows real sobra exatamente uma linha aqui. Se
	// houver mais de uma (licenciamento KMS com produtos adicionais, raro),
	// a primeira já reflete o status da licença ativa do SO.
	p := produtos[0]
	return ActivationInfo{
		Activated: p.LicenseStatus == 1,
		Status:    mapearStatusAtivacao(p.LicenseStatus),
	}
}
