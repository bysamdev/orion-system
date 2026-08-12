//go:build !windows

package token

// protect e unprotect não têm operação real fora do Windows: o DPAPI é uma API
// exclusiva dessa plataforma, e GetTokenPath já usa um caminho de desenvolvimento
// separado (fora de C:\ProgramData) para qualquer sistema não-Windows — não há
// instalação de produção neste caminho a proteger.
//
// Manter esta variante passthrough (em vez de só ter protect_windows.go, como o
// pacote shortcut faz hoje) é o que permite `go build`/`go test` funcionarem em
// Linux/macOS — necessário, por exemplo, para rodar `go test -race` em runner de
// CI Linux, já que -race exige cgo e este ambiente Windows não tem toolchain C
// (ver PERFORMANCE.md e IMPROVEMENT_PLAN.md B.14).
func protect(plaintext []byte) ([]byte, error) {
	return plaintext, nil
}

func unprotect(blob []byte) ([]byte, error) {
	return blob, nil
}
