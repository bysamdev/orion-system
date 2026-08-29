package main

import (
	"fmt"
	"os"

	"golang.org/x/sys/windows"
)

// Cor de marca do Orion System (hsl(283, 60%, 46%) — mesmo matiz usado em
// --primary no frontend, ver src/index.css) em truecolor ANSI. anansiOK
// controla se sequências de escape são realmente emitidas: em terminais
// antigos sem suporte a VT100 (ENABLE_VIRTUAL_TERMINAL_PROCESSING
// indisponível), preferimos texto plano a lixo de escape codes na tela.
const (
	corMarca  = "\x1b[38;2;148;47;188m"
	corVerde  = "\x1b[32m"
	corAmarela = "\x1b[33m"
	corVermelha = "\x1b[31m"
	corReset  = "\x1b[0m"
	corNegrito = "\x1b[1m"
)

var ansiOK = habilitarANSI()

// habilitarANSI liga ENABLE_VIRTUAL_TERMINAL_PROCESSING no console atual —
// sem isso, sequências de escape ANSI aparecem como texto literal no
// cmd.exe/PowerShell de versões mais antigas do Windows 10. Suportado desde
// a atualização de aniversário do Windows 10 (2016); se a chamada falhar
// (console muito antigo, ou stdout redirecionado para um arquivo/pipe),
// simplesmente seguimos sem cor em vez de arriscar lixo na tela.
func habilitarANSI() bool {
	handle := windows.Handle(os.Stdout.Fd())
	var modo uint32
	if err := windows.GetConsoleMode(handle, &modo); err != nil {
		return false
	}
	modo |= windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING
	return windows.SetConsoleMode(handle, modo) == nil
}

func colorir(cor, texto string) string {
	if !ansiOK {
		return texto
	}
	return cor + texto + corReset
}

// imprimirBanner mostra o cabeçalho do instalador numa caixa desenhada com
// caracteres Unicode — identidade visual mínima sem depender de nenhuma
// biblioteca gráfica ou arte ASCII frágil (que quebra em fontes de terminal
// diferentes).
func imprimirBanner() {
	const largura = 58
	borda := colorir(corMarca, "╔"+repetir("═", largura)+"╗")
	rodape := colorir(corMarca, "╚"+repetir("═", largura)+"╝")
	lateral := colorir(corMarca, "║")

	fmt.Println()
	fmt.Println(borda)
	fmt.Printf("%s%s%s\n", lateral, centralizar("", largura), lateral)
	fmt.Printf("%s%s%s\n", lateral, centralizar(colorir(corNegrito, "ORION AGENT"), largura), lateral)
	fmt.Printf("%s%s%s\n", lateral, centralizar("Instalador — Monitoramento e suporte remoto", largura), lateral)
	fmt.Printf("%s%s%s\n", lateral, centralizar("", largura), lateral)
	fmt.Println(rodape)
	fmt.Println()
}

// imprimirPasso marca o início de uma etapa numerada do instalador (ex.:
// "[2/4] Copiando arquivos..."), consistente em toda a execução.
func imprimirPasso(numero, total int, texto string) {
	fmt.Printf("%s %s\n", colorir(corMarca+corNegrito, fmt.Sprintf("[%d/%d]", numero, total)), texto)
}

func imprimirOK(texto string) {
	fmt.Printf("      %s %s\n", colorir(corVerde, "✓"), texto)
}

func imprimirAviso(texto string) {
	fmt.Printf("      %s %s\n", colorir(corAmarela, "⚠"), texto)
}

func imprimirErro(texto string) {
	fmt.Printf("      %s %s\n", colorir(corVermelha, "✗"), texto)
}

// imprimirCaixaFinal destaca a mensagem de encerramento (sucesso ou
// pendência) na mesma linguagem visual do banner inicial.
func imprimirCaixaFinal(cor, texto string) {
	largura := len([]rune(texto)) + 4
	if largura < 58 {
		largura = 58
	}
	borda := colorir(cor, "╔"+repetir("═", largura)+"╗")
	rodape := colorir(cor, "╚"+repetir("═", largura)+"╝")
	lateral := colorir(cor, "║")

	fmt.Println()
	fmt.Println(borda)
	fmt.Printf("%s%s%s\n", lateral, centralizar(colorir(corNegrito, texto), largura), lateral)
	fmt.Println(rodape)
	fmt.Println()
}

func repetir(s string, n int) string {
	r := make([]byte, 0, len(s)*n)
	for i := 0; i < n; i++ {
		r = append(r, s...)
	}
	return string(r)
}

// centralizar preenche texto com espaços para caber em largura colunas,
// contando apenas os caracteres visíveis (ignora sequências de escape ANSI
// já embutidas em texto, que não ocupam espaço na tela).
func centralizar(texto string, largura int) string {
	visivel := comprimentoVisivel(texto)
	if visivel >= largura {
		return texto
	}
	sobra := largura - visivel
	esquerda := sobra / 2
	direita := sobra - esquerda
	return repetir(" ", esquerda) + texto + repetir(" ", direita)
}

// comprimentoVisivel conta os runes de texto que não fazem parte de uma
// sequência de escape ANSI "\x1b[...m" — usado só para centralizar texto já
// colorido sem que os bytes de cor distorçam a largura calculada.
func comprimentoVisivel(texto string) int {
	n := 0
	dentroEscape := false
	for _, r := range texto {
		switch {
		case r == '\x1b':
			dentroEscape = true
		case dentroEscape && r == 'm':
			dentroEscape = false
		case !dentroEscape:
			n++
		}
	}
	return n
}
