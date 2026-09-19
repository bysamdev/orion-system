package handler

import (
	"encoding/json"
	"math"
	"sort"
)

// umGiB é a resolução do espaço usado guardado no inventário.
const umGiB = 1 << 30

// arredondarUsoDosDiscos arredonda o campo "used" de cada partição para 1 GiB
// antes de o inventário ir para o Supabase.
//
// O inventário só é regravado quando muda (UpsertHardware compara a linha
// inteira), mas o "used" em bytes muda a cada coleta — qualquer arquivo
// temporário mexe nele. Medido na fase 3 da separação do monitoramento: era o
// único campo do inventário que mudava entre heartbeats, e fazia a linha
// inteira ser regravada a cada 5 minutos por máquina. A tela mostra o espaço
// em GB, e o valor exato continua no Orion Monitor.
//
// Qualquer coisa que não seja uma lista de objetos volta intacta: o
// inventário não pode ser perdido por causa de um formato inesperado.
func arredondarUsoDosDiscos(disks json.RawMessage) json.RawMessage {
	var particoes []map[string]any
	if len(disks) == 0 || json.Unmarshal(disks, &particoes) != nil {
		return disks
	}
	for _, p := range particoes {
		if usado, ok := p["used"].(float64); ok && usado >= 0 {
			p["used"] = math.Round(usado/umGiB) * umGiB
		}
	}
	saida, err := json.Marshal(particoes)
	if err != nil {
		return disks
	}
	return saida
}

// normalizarOrdem devolve o JSON com toda lista de objetos ordenada de forma
// estável, recursivamente.
//
// O agente não garante a ordem das listas do inventário: partições, placas de
// rede e antivírus chegam às vezes em outra sequência. Para a comparação de
// UpsertHardware isso é uma mudança, e regravava a linha inteira. Medido na
// fase 3: depois de arredondar o espaço usado, a troca de ordem de discos e
// antivírus era o que ainda fazia o inventário ser regravado. No inventário a
// ordem não tem significado; a tela ordena o que exibe.
//
// A ordem é a da serialização de cada elemento (json.Marshal ordena as chaves
// dos objetos), então dois retratos iguais produzem sempre o mesmo texto.
// Formato inesperado volta intacto.
func normalizarOrdem(bruto json.RawMessage) json.RawMessage {
	if len(bruto) == 0 {
		return bruto
	}
	var v any
	if json.Unmarshal(bruto, &v) != nil {
		return bruto
	}
	saida, err := json.Marshal(ordenarListas(v))
	if err != nil {
		return bruto
	}
	return saida
}

func ordenarListas(v any) any {
	switch x := v.(type) {
	case map[string]any:
		for k, filho := range x {
			x[k] = ordenarListas(filho)
		}
		return x
	case []any:
		type par struct {
			chave string
			valor any
		}
		pares := make([]par, len(x))
		for i, filho := range x {
			ordenado := ordenarListas(filho)
			b, _ := json.Marshal(ordenado)
			pares[i] = par{string(b), ordenado}
		}
		sort.SliceStable(pares, func(i, j int) bool { return pares[i].chave < pares[j].chave })
		for i, p := range pares {
			x[i] = p.valor
		}
		return x
	default:
		return v
	}
}
