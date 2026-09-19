package handler

import (
	"encoding/json"
	"math"
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
