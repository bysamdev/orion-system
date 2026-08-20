//go:build !windows

package addremove

// Registrar/Remover/LimparPastaDepoisDeSair só fazem sentido no Windows
// ("Aplicativos Instalados" e travamento de arquivo em execução são
// conceitos específicos da plataforma) — stubs no-op pra manter o resto
// do código independente de build tag.
func Registrar(caminhoExe, versao string) error  { return nil }
func Remover() error                             { return nil }
func LimparPastaDepoisDeSair(pasta string) error { return nil }
