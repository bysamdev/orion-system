package lib

import (
	"time"
	_ "time/tzdata" // a Vercel não tem a base de fusos do sistema
)

// fusoBrasilia é o horário usado nos textos que as pessoas leem (e-mails,
// chamados automáticos). A API roda na Vercel em UTC; sem converter, os
// horários saíam 3 horas adiantados (ORN-BUG-13).
var fusoBrasilia = func() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.FixedZone("BRT", -3*60*60)
	}
	return loc
}()

// AgoraFormatado devolve o momento atual no horário de Brasília, no formato
// dd/mm/aaaa hh:mm:ss.
func AgoraFormatado() string {
	return time.Now().In(fusoBrasilia).Format("02/01/2006 15:04:05")
}
