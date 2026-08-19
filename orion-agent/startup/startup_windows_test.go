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
	t.Cleanup(func() { _ = disableComChave(chaveRun, valor) })

	if err := enableComChave(chaveRun, valor, `C:\Orion\orion-agent.exe`); err != nil {
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
	if err := enableComChave(chaveRun, valor, `C:\Orion\orion-agent.exe`); err != nil {
		t.Fatalf("enableComChave: %v", err)
	}

	if err := disableComChave(chaveRun, valor); err != nil {
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
	if err := disableComChave(chaveRun, valor); err != nil {
		t.Errorf("disableComChave em valor inexistente deveria ser no-op, deu erro: %v", err)
	}
}
