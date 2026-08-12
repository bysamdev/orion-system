//go:build !windows

package main

// garantirInstanciaUnica não tem operação real fora do Windows: mutexes
// nomeados no estilo Win32 são específicos dessa plataforma. Sempre devolve
// "somos a única instância" — não há verificação de fato, mas também não há
// instalação de produção deste agente fora do Windows (ver GetTokenPath e o
// restante dos pares _windows.go/_other.go deste repositório).
func garantirInstanciaUnica() (bool, error) {
	return true, nil
}
