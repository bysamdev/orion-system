//go:build !windows

package shortcut

// CreatePortalShortcut não tem operação real fora do Windows.
//
// Antes desta correção (item B.14), o pacote shortcut só tinha
// shortcut_windows.go — que o Go trata como exclusivo de GOOS=windows pelo
// próprio sufixo do nome do arquivo, sem precisar de `//go:build windows`
// explícito. Sem um arquivo irmão para as demais plataformas, o pacote ficava
// vazio fora do Windows: qualquer `go build`/`go test`/`go vet` em Linux ou
// macOS falhava só de tentar compilar quem importa "orion-agent/shortcut"
// (hoje, service/windows.go), o que por sua vez impedia rodar `go test -race`
// em runner Linux — `-race` exige cgo, indisponível nesta máquina de
// desenvolvimento Windows (ver PERFORMANCE.md e IMPROVEMENT_PLAN.md B.4).
//
// O comportamento aqui só formaliza o que shortcut_windows.go já fazia em
// tempo de execução: CreatePortalShortcut já verificava runtime.GOOS e
// retornava nil sem criar nada fora do Windows. Esta função preserva
// exatamente essa semântica, só que agora o pacote também COMPILA fora do
// Windows.
func CreatePortalShortcut(apiURL string, machineToken string) error {
	return nil
}
