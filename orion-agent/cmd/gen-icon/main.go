// Command gen-icon grava tray.DataIcon (o mesmo .ico multi-resolução que a
// bandeja usa em tempo de execução — ver orion-agent/tray/icon.go) num
// arquivo .ico estático em disco, pra servir de fonte pro recurso de ícone
// do Windows PE (embutido via goversioninfo/rsrc — ver
// orion-agent/versioninfo.json e orion-agent/cmd/installer/versioninfo.json).
//
// Existe porque tray.DataIcon só existe em memória, montado em tempo de
// execução a partir dos PNGs embutidos (go:embed); o embutidor de recurso
// PE precisa de um arquivo .ico de verdade no disco ANTES da compilação.
// Rodar de novo (ver packaging/msi/build.ps1) sempre que os PNGs de
// orion-agent/tray/assets/ mudarem, pra manter orion.ico em sincronia.
package main

import (
	"fmt"
	"os"

	"orion-agent/tray"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "uso: gen-icon <caminho-de-saída.ico>")
		os.Exit(1)
	}
	if err := os.WriteFile(os.Args[1], tray.DataIcon, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "gen-icon: %v\n", err)
		os.Exit(1)
	}
}
