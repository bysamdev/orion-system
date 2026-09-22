// Comando compactar-agente grava orion-agent.exe em gzip (nível máximo) no
// caminho que o instalador embute (cmd/installer/assets/orion-agent.exe.gz).
// O executável do agente comprime para ~40% do tamanho, e é ele que pesa no
// instalador: sem isto cada instalador gerado tinha ~17 MB.
//
// Uso: go run ./cmd/compactar-agente orion-agent.exe cmd/installer/assets/orion-agent.exe.gz
package main

import (
	"compress/gzip"
	"fmt"
	"os"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "uso: compactar-agente <origem.exe> <destino.gz>")
		os.Exit(2)
	}
	if err := compactar(os.Args[1], os.Args[2]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func compactar(origem, destino string) error {
	dados, err := os.ReadFile(origem)
	if err != nil {
		return err
	}
	f, err := os.Create(destino)
	if err != nil {
		return err
	}
	defer f.Close()
	w, err := gzip.NewWriterLevel(f, gzip.BestCompression)
	if err != nil {
		return err
	}
	if _, err := w.Write(dados); err != nil {
		return err
	}
	return w.Close()
}
