package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestGravarExeMesmoEmUso_ArquivoLivre é o caminho comum (primeira instalação
// ou nenhum processo segurando o binário): grava direto, sem deixar sobra.
func TestGravarExeMesmoEmUso_ArquivoLivre(t *testing.T) {
	pasta := t.TempDir()
	destino := filepath.Join(pasta, "orion-agent.exe")

	if err := os.WriteFile(destino, []byte("versao antiga"), 0755); err != nil {
		t.Fatal(err)
	}

	if err := gravarExeMesmoEmUso(destino, []byte("versao nova")); err != nil {
		t.Fatalf("gravarExeMesmoEmUso: %v", err)
	}

	conteudo, err := os.ReadFile(destino)
	if err != nil {
		t.Fatal(err)
	}
	if string(conteudo) != "versao nova" {
		t.Errorf("conteúdo = %q, esperado %q", conteudo, "versao nova")
	}

	if sobras := contarBinariosAntigos(t, pasta); sobras != 0 {
		t.Errorf("%d arquivo(s) .old-* deixados sem necessidade", sobras)
	}
}

// TestGravarExeMesmoEmUso_LimpaSobrasDeAtualizacoesAnteriores garante que os
// .old-* de atualizações passadas não se acumulam em C:\Orion.
func TestGravarExeMesmoEmUso_LimpaSobrasDeAtualizacoesAnteriores(t *testing.T) {
	pasta := t.TempDir()
	destino := filepath.Join(pasta, "orion-agent.exe")

	if err := os.WriteFile(destino, []byte("atual"), 0755); err != nil {
		t.Fatal(err)
	}
	for _, sobra := range []string{"orion-agent.exe.old-111", "orion-agent.exe.old-222"} {
		if err := os.WriteFile(filepath.Join(pasta, sobra), []byte("lixo"), 0755); err != nil {
			t.Fatal(err)
		}
	}

	if err := gravarExeMesmoEmUso(destino, []byte("nova")); err != nil {
		t.Fatalf("gravarExeMesmoEmUso: %v", err)
	}

	if sobras := contarBinariosAntigos(t, pasta); sobras != 0 {
		t.Errorf("%d arquivo(s) .old-* não foram limpos", sobras)
	}
}

// TestGravarExeMesmoEmUso_ArquivoTravado cobre o caso que derrubava a
// auto-atualização: no caminho remoto o instalador roda pelo serviço (sessão
// 0) e o taskkill não alcança a bandeja do usuário (outra sessão, outra
// conta), que segue segurando C:\Orion\orion-agent.exe. Antes, o os.WriteFile
// direto falhava com "Access is denied", instalar() abortava antes de
// re-registrar o serviço e a máquina ficava com o agente parado. Agora a
// gravação cai para renomear-e-escrever e conclui mesmo assim.
func TestGravarExeMesmoEmUso_ArquivoTravado(t *testing.T) {
	pasta := t.TempDir()
	destino := filepath.Join(pasta, "orion-agent.exe")

	if err := os.WriteFile(destino, []byte("versao em uso"), 0755); err != nil {
		t.Fatal(err)
	}

	// Somente-leitura reproduz de forma determinística o que interessa aqui:
	// os.WriteFile falha, os.Rename continua permitido. É a mesma forma do
	// bloqueio real de um .exe em execução no Windows, sem depender de
	// carregar um processo de verdade dentro do teste.
	if err := os.Chmod(destino, 0444); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(destino, []byte("x"), 0755); err == nil {
		t.Skip("ambiente permite sobrescrever arquivo somente-leitura — bloqueio não reproduzível aqui")
	}

	if err := gravarExeMesmoEmUso(destino, []byte("versao nova")); err != nil {
		t.Fatalf("gravarExeMesmoEmUso com arquivo em uso: %v", err)
	}

	conteudo, err := os.ReadFile(destino)
	if err != nil {
		t.Fatal(err)
	}
	if string(conteudo) != "versao nova" {
		t.Errorf("conteúdo = %q, esperado %q — o binário novo precisa assumir o nome original", conteudo, "versao nova")
	}

	// O binário antigo tem de continuar por perto: o processo que o mantinha
	// aberto segue rodando a partir dele até reiniciar.
	if sobras := contarBinariosAntigos(t, pasta); sobras != 1 {
		t.Errorf("%d arquivo(s) .old-*, esperado exatamente 1 (o binário substituído)", sobras)
	}
}

func contarBinariosAntigos(t *testing.T, pasta string) int {
	t.Helper()
	entradas, err := os.ReadDir(pasta)
	if err != nil {
		t.Fatal(err)
	}
	n := 0
	for _, e := range entradas {
		if strings.Contains(e.Name(), "orion-agent.exe.old-") {
			n++
		}
	}
	return n
}

// TestExtrairSIDDeShowsid usa a saída real observada em produção (SAMUEL,
// sc showsid OrionAgent) e cobre servicoJaRegistrado.
func TestExtrairSIDDeShowsid(t *testing.T) {
	saidaReal := "NOME: OrionAgent \r\nSID DO SERVIÇO: S-1-5-80-2442242212-214070666-144826950-2431307122-546831793\r\nSTATUS: Inativo\r\n"

	sid, err := extrairSIDDeShowsid(saidaReal)
	if err != nil {
		t.Fatalf("extrairSIDDeShowsid: %v", err)
	}
	if esperado := "S-1-5-80-2442242212-214070666-144826950-2431307122-546831793"; sid != esperado {
		t.Errorf("sid = %q, esperado %q", sid, esperado)
	}
}

func TestExtrairSIDDeShowsid_SaidaInesperada(t *testing.T) {
	if _, err := extrairSIDDeShowsid("[SC] EnumQueryServicesStatus:OpenService FAILED 1060"); err == nil {
		t.Error("esperava erro para saída sem SID, não travar silenciosamente com string vazia")
	}
}
