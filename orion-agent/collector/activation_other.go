//go:build !windows

package collector

// coletarAtivacao: ativação de licença é um conceito específico do Windows.
// Em outras plataformas devolvemos Activated=true ("Not Applicable") em vez
// de false — um false aqui dispararia falsamente o alerta de "licença não
// ativada" (ver alerta configurado no Grafana) numa máquina Linux/macOS que
// não tem esse conceito.
func coletarAtivacao() ActivationInfo {
	return ActivationInfo{Activated: true, Status: "Not Applicable"}
}
