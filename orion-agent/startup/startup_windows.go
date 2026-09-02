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

// Enable grava \...\Run\OrionAgent apontando pro executável informado —
// HKLM se conseguir (cobre qualquer usuário que logar nesta máquina), com
// HKCU do usuário atual como fallback só se HKLM falhar (ex.: instalador
// rodou sem elevação).
//
// Antes desta correção, os dois hives eram gravados incondicionalmente.
// Quando a instalação roda elevada (o caso comum) sob a conta do próprio
// usuário que depois usa a máquina no dia a dia — cenário típico de
// instalação feita por um técnico logado como o usuário final —, HKLM já
// cobre esse mesmo usuário, e HKCU vira uma segunda entrada de Run
// disparando o MESMO executável duas vezes no login: dois processos, dois
// ícones de bandeja (o bug relatado em "algumas máquinas" — justamente as
// que tiveram instalação elevada sob a conta do usuário final).
func Enable(caminhoExe string) error {
	return enableComValor(valorRun, caminhoExe)
}

// enableComValor é Enable() com o nome do valor parametrizável — separado só
// para os testes gravarem sob um valor aleatório em vez do "OrionAgent" real
// (mesmo padrão de nomeValorDeTeste/enableComChave já usado neste pacote).
//
// Quando HKLM funciona, também remove uma eventual entrada HKCU deixada por
// uma instalação anterior (de antes desta correção, que gravava os dois
// incondicionalmente) — sem isso, uma máquina já afetada pelo bug de ícone
// duplicado continuaria duplicada mesmo depois de atualizar o agente: a
// auto-atualização remota roda o instalador de novo (ver
// cmd/installer/main.go:instalar()), mas só ganhava a correção de não
// piorar o problema, não de limpar o que já estava errado. Com o
// DeleteValue aqui, a próxima auto-atualização já resolve sozinha, sem
// exigir reinstalação manual.
func enableComValor(valor, caminhoExe string) error {
	if err := enableComChave(registry.LOCAL_MACHINE, chaveRun, valor, caminhoExe); err == nil {
		_ = disableComChave(registry.CURRENT_USER, chaveRun, valor)
		return nil
	}
	return enableComChave(registry.CURRENT_USER, chaveRun, valor, caminhoExe)
}

// Disable remove a entrada de auto-início de HKLM e HKCU.
func Disable() error {
	_ = disableComChave(registry.LOCAL_MACHINE, chaveRun, valorRun)
	return disableComChave(registry.CURRENT_USER, chaveRun, valorRun)
}

// enableComChave/disableComChave fazem o trabalho real aceitando o hive raiz (HKLM ou HKCU).
func enableComChave(hive registry.Key, chave, valor, caminhoExe string) error {
	k, _, err := registry.CreateKey(hive, chave, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("abrir/criar %s: %w", chave, err)
	}
	defer k.Close()

	// Aspas em volta do caminho: caminhos com espaço quebrariam sem elas.
	v := `"` + caminhoExe + `"`
	if err := k.SetStringValue(valor, v); err != nil {
		return fmt.Errorf("gravar valor %s: %w", valor, err)
	}
	return nil
}

func disableComChave(hive registry.Key, chave, valor string) error {
	k, err := registry.OpenKey(hive, chave, registry.SET_VALUE)
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
