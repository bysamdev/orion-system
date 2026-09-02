//go:build windows

package startup

import (
	"fmt"
	"math/rand"
	"testing"

	"golang.org/x/sys/windows/registry"
)

// nomeValorDeTeste evita colidir com o "OrionAgent" de produção — os testes
// escrevem e apagam num nome de valor próprio, aleatório, dentro da mesma
// chave Run real (a chave em si é sempre segura de tocar; só o VALOR
// "OrionAgent" é o que importa preservar).
func nomeValorDeTeste(t *testing.T) string {
	t.Helper()
	return fmt.Sprintf("OrionAgentTeste%d", rand.Int())
}

func TestEnableComChave_GravaCaminhoEntreAspas(t *testing.T) {
	valor := nomeValorDeTeste(t)
	t.Cleanup(func() { _ = disableComChave(registry.CURRENT_USER, chaveRun, valor) })

	if err := enableComChave(registry.CURRENT_USER, chaveRun, valor, `C:\Orion\orion-agent.exe`); err != nil {
		t.Fatalf("enableComChave: %v", err)
	}

	k, err := registry.OpenKey(registry.CURRENT_USER, chaveRun, registry.QUERY_VALUE)
	if err != nil {
		t.Fatalf("abrir chave pra conferir: %v", err)
	}
	defer k.Close()

	got, _, err := k.GetStringValue(valor)
	if err != nil {
		t.Fatalf("ler valor gravado: %v", err)
	}
	want := `"C:\Orion\orion-agent.exe"`
	if got != want {
		t.Errorf("valor gravado = %q; esperado %q", got, want)
	}
}

func TestDisableComChave_RemoveOValorGravado(t *testing.T) {
	valor := nomeValorDeTeste(t)
	if err := enableComChave(registry.CURRENT_USER, chaveRun, valor, `C:\Orion\orion-agent.exe`); err != nil {
		t.Fatalf("enableComChave: %v", err)
	}

	if err := disableComChave(registry.CURRENT_USER, chaveRun, valor); err != nil {
		t.Fatalf("disableComChave: %v", err)
	}

	k, err := registry.OpenKey(registry.CURRENT_USER, chaveRun, registry.QUERY_VALUE)
	if err != nil {
		t.Fatalf("abrir chave pra conferir: %v", err)
	}
	defer k.Close()

	if _, _, err := k.GetStringValue(valor); err == nil {
		t.Error("valor ainda existe depois de disableComChave")
	}
}

func TestDisableComChave_IdempotenteQuandoValorNaoExiste(t *testing.T) {
	valor := nomeValorDeTeste(t)
	if err := disableComChave(registry.CURRENT_USER, chaveRun, valor); err != nil {
		t.Errorf("disableComChave em valor inexistente deveria ser no-op, deu erro: %v", err)
	}
}

// TestEnable_NuncaGravaEmHKLMEHKCUAoMesmoTempo cobre o bug relatado em
// produção: agente duplicado (dois ícones de bandeja) em algumas máquinas.
// Causa raiz — Enable() gravava HKLM e HKCU incondicionalmente; quando os
// dois apontam pro mesmo executável, o Windows lança o processo duas vezes
// no login de quem está coberto por ambos. O teste não assume se o ambiente
// de CI roda elevado (só HKLM exige elevação) — verifica a invariante que
// importa: nunca os dois hives com o valor ao mesmo tempo, não qual dos
// dois venceu.
func TestEnable_NuncaGravaEmHKLMEHKCUAoMesmoTempo(t *testing.T) {
	valor := nomeValorDeTeste(t)
	t.Cleanup(func() {
		_ = disableComChave(registry.LOCAL_MACHINE, chaveRun, valor)
		_ = disableComChave(registry.CURRENT_USER, chaveRun, valor)
	})

	if err := enableComValor(valor, `C:\Orion\orion-agent.exe`); err != nil {
		t.Fatalf("enableComValor: %v", err)
	}

	temEmHKLM := valorExiste(t, registry.LOCAL_MACHINE, valor)
	temEmHKCU := valorExiste(t, registry.CURRENT_USER, valor)

	if !temEmHKLM && !temEmHKCU {
		t.Fatal("Enable não gravou o valor em nenhum dos dois hives")
	}
	if temEmHKLM && temEmHKCU {
		t.Error("Enable gravou em HKLM e HKCU ao mesmo tempo — isso duplica o lançamento no login (dois ícones de bandeja)")
	}
}

// TestEnable_LimpaHKCUQueSobrouDeInstalacaoAntigaQuandoHKLMFunciona cobre o
// self-heal: uma máquina já afetada pelo bug (HKCU com a entrada de uma
// instalação anterior a esta correção) precisa ficar com um ícone só depois
// da próxima auto-atualização remota, que roda o instalador de novo — sem
// isso, a correção só evitaria piorar instalações novas, sem consertar as
// que já estão duplicadas hoje.
func TestEnable_LimpaHKCUQueSobrouDeInstalacaoAntigaQuandoHKLMFunciona(t *testing.T) {
	valor := nomeValorDeTeste(t)
	t.Cleanup(func() {
		_ = disableComChave(registry.LOCAL_MACHINE, chaveRun, valor)
		_ = disableComChave(registry.CURRENT_USER, chaveRun, valor)
	})

	// Simula o estado de uma máquina já afetada: HKCU já tem a entrada de
	// uma instalação anterior a esta correção.
	if err := enableComChave(registry.CURRENT_USER, chaveRun, valor, `C:\Orion\orion-agent.exe`); err != nil {
		t.Fatalf("preparar estado de HKCU pré-existente: %v", err)
	}

	if err := enableComValor(valor, `C:\Orion\orion-agent.exe`); err != nil {
		t.Fatalf("enableComValor: %v", err)
	}

	if !valorExiste(t, registry.LOCAL_MACHINE, valor) {
		t.Skip("HKLM não gravável neste ambiente (sem elevação) — self-heal não se aplica aqui, cai no fallback de HKCU")
	}

	if valorExiste(t, registry.CURRENT_USER, valor) {
		t.Error("HKCU de uma instalação antiga continua presente depois de HKLM funcionar — a máquina não se autocorrige na próxima auto-atualização")
	}
}

func valorExiste(t *testing.T, hive registry.Key, valor string) bool {
	t.Helper()
	k, err := registry.OpenKey(hive, chaveRun, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	_, _, err = k.GetStringValue(valor)
	return err == nil
}
