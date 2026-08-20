//go:build windows

// Package addremove registra o Orion Agent em Configurações > Aplicativos
// instalados do Windows (e no antigo Painel de Controle > Programas e
// Recursos) — sem isso, o agente existe na máquina (arquivos + serviço)
// mas fica invisível pra qualquer um desses dois lugares, e o único jeito
// de desinstalar é saber de cor o comando `orion-agent.exe uninstall`.
package addremove

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"syscall"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// chaveDesinstalar é onde o Windows procura por programas instalados —
// mesma árvore de registro que qualquer instalador de verdade (MSI,
// InstallShield, Inno Setup etc.) usa pra aparecer nessa lista.
const chaveDesinstalar = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OrionAgent`

// Registrar cria a entrada em Aplicativos Instalados, com um
// UninstallString que roda o desinstalador de verdade (ver
// orion-agent/main.go, comando "uninstall", que por sua vez chama
// Remover() pra tirar esta mesma entrada quando terminar).
func Registrar(caminhoExe, versao string) error {
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, chaveDesinstalar, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("criar chave de desinstalação: %w", err)
	}
	defer k.Close()

	valores := map[string]string{
		"DisplayName":     "Orion Agent",
		"DisplayVersion":  versao,
		"Publisher":       "Orion System",
		"InstallLocation": filepath.Dir(caminhoExe),
		"UninstallString": fmt.Sprintf(`"%s" uninstall`, caminhoExe),
		"DisplayIcon":     caminhoExe,
	}
	for nome, valor := range valores {
		if err := k.SetStringValue(nome, valor); err != nil {
			return fmt.Errorf("gravar %s: %w", nome, err)
		}
	}

	// NoModify/NoRepair: esconde os botões "Modificar"/"Reparar" que o
	// Windows mostra por padrão — não suportamos nenhum dos dois, só
	// instalar do zero (rodando um novo instalador) ou desinstalar.
	if err := k.SetDWordValue("NoModify", 1); err != nil {
		return fmt.Errorf("gravar NoModify: %w", err)
	}
	if err := k.SetDWordValue("NoRepair", 1); err != nil {
		return fmt.Errorf("gravar NoRepair: %w", err)
	}
	return nil
}

// Remover apaga a entrada de Aplicativos Instalados — chamado pelo
// comando "uninstall". Chave inexistente não é erro (idempotente: rodar
// uninstall duas vezes, ou numa máquina onde o registro nunca foi criado
// por ter sido instalada antes desta correção, não deve falhar).
func Remover() error {
	err := registry.DeleteKey(registry.LOCAL_MACHINE, chaveDesinstalar)
	if err != nil && err != registry.ErrNotExist {
		return fmt.Errorf("remover chave de desinstalação: %w", err)
	}
	return nil
}

// LimparPastaDepoisDeSair agenda a remoção recursiva de uma pasta —
// tipicamente C:\Orion, incluindo o próprio orion-agent.exe que está
// chamando esta função. Não dá pra um processo apagar (ou um caller
// apagar por ele) o próprio arquivo de imagem enquanto ele ainda está
// carregado: o Windows mantém esse arquivo travado até o processo
// terminar de verdade.
//
// A saída: um processo cmd.exe DETACHED (sobrevive à saída do processo
// que o criou — não fica preso a ele como um filho comum ficaria) espera
// 2 segundos — tempo de sobra pro processo chamador terminar e soltar o
// arquivo — e só então apaga a pasta inteira. Retorna assim que o cmd.exe
// é lançado; não espera a limpeza de verdade acontecer.
func LimparPastaDepoisDeSair(pasta string) error {
	cmd := exec.Command("cmd", "/C", fmt.Sprintf(`timeout /t 2 /nobreak >nul & taskkill /f /im orion-agent.exe >nul 2>&1 & timeout /t 1 /nobreak >nul & rmdir /s /q %q`, pasta))
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.DETACHED_PROCESS}
	return cmd.Start()
}
