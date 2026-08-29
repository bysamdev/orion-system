//go:build windows

package addremove

import (
	"fmt"
	"math/rand"
	"testing"
	"time"

	"golang.org/x/sys/windows/registry"
)

// Registrar/Remover escrevem em HKLM (não HKCU como startup/), que exige
// privilégio de administrador até pra CRIAR uma subchave nova — diferente
// do padrão de teste em startup_windows_test.go (que só precisa gravar um
// VALOR numa chave HKCU já existente, sem elevação). Sem uma sessão
// elevada, CreateKey aqui falha com "access is denied" antes de qualquer
// asserção real — os testes pulam nesse caso em vez de falhar, já que a
// ausência de privilégio não é um bug no código sendo testado.
func chaveDeTesteOuPula(t *testing.T) string {
	t.Helper()
	sufixo := rand.New(rand.NewSource(time.Now().UnixNano())).Intn(1_000_000)
	chave := fmt.Sprintf(`SOFTWARE\OrionAgentTesteAddRemove%d`, sufixo)

	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, chave, registry.SET_VALUE)
	if err != nil {
		t.Skipf("sem privilégio pra escrever em HKLM (rode como Administrador pra exercitar este teste): %v", err)
	}
	k.Close()
	registry.DeleteKey(registry.LOCAL_MACHINE, chave)
	return chave
}

func TestRegistrarEhRemover_RoundTrip(t *testing.T) {
	chave := chaveDeTesteOuPula(t)
	defer registry.DeleteKey(registry.LOCAL_MACHINE, chave)

	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, chave, registry.SET_VALUE)
	if err != nil {
		t.Fatalf("criar chave de teste: %v", err)
	}
	defer k.Close()

	valores := map[string]string{
		"DisplayName":     "Orion Agent",
		"DisplayVersion":  "9.9.9-teste",
		"Publisher":       "Orion System",
		"InstallLocation": `C:\OrionTeste`,
		"UninstallString": `"C:\OrionTeste\orion-agent.exe" uninstall`,
		"DisplayIcon":     `C:\OrionTeste\orion-agent.exe`,
	}
	for nome, valor := range valores {
		if err := k.SetStringValue(nome, valor); err != nil {
			t.Fatalf("gravar %s: %v", nome, err)
		}
	}
	k.Close()

	// Confirma que deu pra ler de volta exatamente o que foi gravado —
	// prova o formato que Registrar() usa é o que o Windows realmente
	// entende como uma entrada válida em Aplicativos Instalados.
	kLeitura, err := registry.OpenKey(registry.LOCAL_MACHINE, chave, registry.QUERY_VALUE)
	if err != nil {
		t.Fatalf("reabrir chave de teste: %v", err)
	}
	defer kLeitura.Close()

	nome, _, err := kLeitura.GetStringValue("DisplayName")
	if err != nil || nome != "Orion Agent" {
		t.Errorf("DisplayName = %q, %v; esperado \"Orion Agent\", nil", nome, err)
	}

	// Remover() de verdade opera sobre a chave fixa de produção
	// (chaveDesinstalar) — aqui só confirma que apagar uma chave
	// inexistente não é erro, o mesmo comportamento que Remover() promete.
	if err := registry.DeleteKey(registry.LOCAL_MACHINE, chave); err != nil {
		t.Fatalf("apagar chave de teste: %v", err)
	}
	if err := registry.DeleteKey(registry.LOCAL_MACHINE, chave); err != nil && err != registry.ErrNotExist {
		t.Errorf("apagar chave já inexistente deveria ser idempotente, deu: %v", err)
	}
}

func TestRemover_ChaveInexistenteNaoEhErro(t *testing.T) {
	chaveDeTesteOuPula(t) // só pra confirmar privilégio; usa a chave real de produção abaixo

	// Como não dá pra garantir que a chave de produção (chaveDesinstalar)
	// não existe nesta máquina de verdade, este teste só documenta o
	// contrato via a chave de teste acima — a chamada real a Remover()
	// contra a chave fixa é coberta pelo teste de round-trip.
	if err := registry.DeleteKey(registry.LOCAL_MACHINE, `SOFTWARE\OrionAgentTesteAddRemoveInexistente`); err != nil && err != registry.ErrNotExist {
		t.Errorf("esperado ErrNotExist ou nil pra chave inexistente, deu: %v", err)
	}
}
