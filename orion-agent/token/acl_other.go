//go:build !windows

package token

// endurecerACLDoDiretorio não tem operação real fora do Windows: ACLs no estilo
// icacls são específicas dessa plataforma, e não há instalação de produção em
// diretório de desenvolvimento não-Windows a proteger (ver GetTokenPath).
func endurecerACLDoDiretorio(dir string) error {
	return nil
}
