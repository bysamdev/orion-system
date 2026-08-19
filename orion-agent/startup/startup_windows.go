//go:build windows

// Package startup gerencia a entrada de auto-início do Orion Agent no login
// do Windows (HKCU\...\Run) — o que faz a bandeja aparecer sozinha quando o
// usuário loga, sem precisar clicar no .exe manualmente. Complementa o
// serviço Windows (que cobre a máquina sem ninguém logado); ver main.go
// para a lógica de qual dos dois manda o heartbeat quando os dois estão
// ativos.
package startup

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

const (
	chaveRun = `Software\Microsoft\Windows\CurrentVersion\Run`
	valorRun = "OrionAgent"
)

// Enable grava HKCU\...\Run\OrionAgent apontando pro executável informado.
// HKEY_CURRENT_USER é por usuário — se o instalador for rodado elevado
// (UAC) a partir da própria sessão do usuário (o caso comum), isso ainda
// grava no HKCU de quem está instalando, não no de um administrador
// diferente, porque a elevação por consentimento não troca de identidade.
func Enable(caminhoExe string) error {
	return enableComChave(chaveRun, valorRun, caminhoExe)
}

// Disable remove a entrada de auto-início, se existir. Não é erro chamar
// quando ela já não existe (idempotente — uninstall pode rodar mais de
// uma vez, ou num sistema onde o Enable nunca rodou).
func Disable() error {
	return disableComChave(chaveRun, valorRun)
}

// enableComChave/disableComChave fazem o trabalho real, aceitando chave e
// nome do valor por parâmetro — separadas de Enable/Disable para que os
// testes usem um valor próprio (com sufixo aleatório) em vez do nome de
// produção "OrionAgent", evitando tocar no Run key de verdade de quem
// rodar `go test`.
func enableComChave(chave, valor, caminhoExe string) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, chave, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("abrir/criar %s: %w", chave, err)
	}
	defer k.Close()

	// Aspas em volta do caminho: caminhos com espaço (ex.: "Program Files")
	// quebrariam a leitura do Windows sem elas.
	v := `"` + caminhoExe + `"`
	if err := k.SetStringValue(valor, v); err != nil {
		return fmt.Errorf("gravar valor %s: %w", valor, err)
	}
	return nil
}

func disableComChave(chave, valor string) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, chave, registry.SET_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return fmt.Errorf("abrir %s: %w", chave, err)
	}
	defer k.Close()

	if err := k.DeleteValue(valor); err != nil && err != registry.ErrNotExist {
		return fmt.Errorf("remover valor %s: %w", valor, err)
	}
	return nil
}
