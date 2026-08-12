//go:build windows

package main

import (
	"errors"
	"fmt"

	"golang.org/x/sys/windows"
)

// nomeMutexInstanciaUnica usa o prefixo "Global\" para ser visível através de
// sessões diferentes do Windows — não só dentro da sessão de quem o criou.
// Isso é o que faz a checagem funcionar entre o serviço (SYSTEM, Session 0) e
// uma execução interativa (usuário logado, sessão diferente): sem "Global\",
// cada sessão teria seu próprio namespace de objetos nomeados e as duas
// instâncias não se veriam.
const nomeMutexInstanciaUnica = `Global\OrionAgentSingleInstance`

// garantirInstanciaUnica tenta criar o mutex nomeado global de produção.
func garantirInstanciaUnica() (bool, error) {
	return garantirInstanciaUnicaComNome(nomeMutexInstanciaUnica)
}

// garantirInstanciaUnicaComNome faz o trabalho real, aceitando o nome do
// mutex por parâmetro — separada de garantirInstanciaUnica para que os testes
// usem um nome próprio (ex.: com sufixo aleatório) em vez do nome de
// produção, evitando qualquer interferência com uma instância real do agente
// que porventura esteja rodando na mesma máquina.
//
// Devolve (true, nil) se este processo é quem criou o mutex agora (nenhuma
// outra instância rodando com este nome), (false, nil) se o mutex já existia
// (outra instância já está rodando), ou (false, err) se a checagem em si
// falhou por algum motivo (ex.: falta de privilégio) — nesse caso o chamador
// decide se segue mesmo assim.
//
// De propósito, o handle retornado por CreateMutex nunca é fechado: ele
// precisa permanecer vivo pela vida inteira do processo para manter a
// exclusão mútua. O Windows libera o mutex automaticamente quando o processo
// termina (por qualquer motivo, inclusive crash), então não há vazamento de
// recurso a longo prazo — só "vaza" até o processo morrer, que é exatamente o
// efeito desejado aqui.
func garantirInstanciaUnicaComNome(nomeMutex string) (bool, error) {
	nome, err := windows.UTF16PtrFromString(nomeMutex)
	if err != nil {
		return false, fmt.Errorf("codificar nome do mutex: %w", err)
	}

	_, err = windows.CreateMutex(nil, false, nome)
	if err == nil {
		return true, nil // criado agora: somos a única instância
	}
	if errors.Is(err, windows.ERROR_ALREADY_EXISTS) {
		return false, nil // já existia: outra instância está rodando
	}
	return false, fmt.Errorf("CreateMutex: %w", err)
}
