package tray

import (
	"embed"
	"encoding/binary"
	"fmt"
	"sort"
)

//go:embed assets/*.png
var iconAssets embed.FS

// nomesIconesEmbutidos lista os PNGs da logo real do Orion em cada resolução
// que a bandeja do Windows pode pedir, conforme a escala de DPI configurada
// (100%/125%/150%/200%/250%/300% em cima do ícone "pequeno" de 16px lógicos).
// Substitui o quadrado azul placeholder que existia antes (ver histórico de
// icon.go) pela identidade visual real do produto.
var nomesIconesEmbutidos = []string{
	"assets/icon_16.png",
	"assets/icon_20.png",
	"assets/icon_24.png",
	"assets/icon_32.png",
	"assets/icon_40.png",
	"assets/icon_48.png",
}

// DataIcon é o .ico multi-resolução carregado a partir de nomesIconesEmbutidos,
// pronto para systray.SetIcon. Formato "PNG-compressed icon" (ICONDIR +
// ICONDIRENTRY apontando pra cada PNG cru), suportado desde o Windows Vista —
// sem precisar recodificar como BMP+máscara AND do .ico clássico pré-Vista.
//
// Painel do Windows escolhe a entrada mais próxima da resolução pedida em
// tempo de exibição; embutir várias resoluções evita que o ícone saia
// borrado ou serrilhado em telas de alto DPI.
var DataIcon = mustConstruirDataIcon()

func mustConstruirDataIcon() []byte {
	pngs := make([][]byte, 0, len(nomesIconesEmbutidos))
	for _, nome := range nomesIconesEmbutidos {
		dados, err := iconAssets.ReadFile(nome)
		if err != nil {
			panic(fmt.Sprintf("tray: ícone embutido ausente (%s): %v", nome, err))
		}
		pngs = append(pngs, dados)
	}
	ico, err := construirICOMultiplo(pngs)
	if err != nil {
		panic(fmt.Sprintf("tray: falha ao montar .ico: %v", err))
	}
	return ico
}

// construirICOMultiplo monta um .ico com uma entrada por PNG de entrada, sem
// recodificar nenhuma imagem — só o envelope ICONDIR/ICONDIRENTRY que o
// Win32 exige para reconhecer o arquivo como ícone (ver LoadImageW em
// systray, que é quem consome DataIcon no Windows).
//
// A largura/altura de cada entrada vem do próprio cabeçalho IHDR do PNG
// (bytes 16:24), não de configuração externa — elimina a chance de o
// ICONDIRENTRY declarar um tamanho que não bate com a imagem real.
func construirICOMultiplo(pngs [][]byte) ([]byte, error) {
	const (
		tamanhoICONDIR      = 6
		tamanhoICONDIRENTRY = 16
	)
	if len(pngs) == 0 {
		return nil, fmt.Errorf("nenhuma imagem fornecida")
	}
	if len(pngs) > 0xFFFF {
		return nil, fmt.Errorf("muitas imagens (%d) para um único .ico", len(pngs))
	}

	// Windows espera as entradas do menor pro maior tamanho declarado.
	ordenado := make([][]byte, len(pngs))
	copy(ordenado, pngs)
	for i, png := range ordenado {
		if _, _, err := dimensoesPNG(png); err != nil {
			return nil, fmt.Errorf("imagem %d: %w", i, err)
		}
	}
	sort.Slice(ordenado, func(i, j int) bool {
		li, _, _ := dimensoesPNG(ordenado[i])
		lj, _, _ := dimensoesPNG(ordenado[j])
		return li < lj
	})

	count := len(ordenado)
	cabecalho := make([]byte, 0, tamanhoICONDIR+tamanhoICONDIRENTRY*count)

	// ICONDIR: reserved=0, type=1 (ícone), count=N.
	cabecalho = append(cabecalho, 0x00, 0x00, 0x01, 0x00)
	cabecalho = append(cabecalho, byte(count), byte(count>>8))

	offset := uint32(tamanhoICONDIR + tamanhoICONDIRENTRY*count)
	entradas := make([]byte, 0, tamanhoICONDIRENTRY*count)
	for _, png := range ordenado {
		largura, altura, err := dimensoesPNG(png)
		if err != nil {
			return nil, err
		}
		// ICONDIRENTRY usa 1 byte por dimensão; 0 significa 256.
		byteDim := func(v int) (byte, error) {
			if v == 256 {
				return 0, nil
			}
			if v < 1 || v > 255 {
				return 0, fmt.Errorf("dimensão %d fora do intervalo suportado por ICONDIRENTRY (1-256)", v)
			}
			return byte(v), nil
		}
		bl, err := byteDim(largura)
		if err != nil {
			return nil, err
		}
		ba, err := byteDim(altura)
		if err != nil {
			return nil, err
		}

		tamanho := uint32(len(png))
		entradas = append(entradas,
			bl, ba,
			0x00,       // paleta de cores: nenhuma (imagem não indexada)
			0x00,       // reservado, deve ser 0
			0x01, 0x00, // planos de cor: 1
			0x20, 0x00, // bits por pixel: 32
			byte(tamanho), byte(tamanho>>8), byte(tamanho>>16), byte(tamanho>>24),
			byte(offset), byte(offset>>8), byte(offset>>16), byte(offset>>24),
		)
		offset += tamanho
	}

	ico := append(cabecalho, entradas...)
	for _, png := range ordenado {
		ico = append(ico, png...)
	}
	return ico, nil
}

// dimensoesPNG lê largura e altura direto do chunk IHDR (bytes 16:24 de um
// PNG válido — 8 de assinatura + 4 de tamanho do chunk + 4 do tipo "IHDR" —
// sem precisar decodificar a imagem inteira.
func dimensoesPNG(png []byte) (largura, altura int, err error) {
	const offsetIHDR = 16
	if len(png) < offsetIHDR+8 {
		return 0, 0, fmt.Errorf("dados PNG curtos demais (%d bytes) para conter IHDR", len(png))
	}
	assinatura := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}
	for i, b := range assinatura {
		if png[i] != b {
			return 0, 0, fmt.Errorf("assinatura PNG inválida")
		}
	}
	largura = int(binary.BigEndian.Uint32(png[offsetIHDR : offsetIHDR+4]))
	altura = int(binary.BigEndian.Uint32(png[offsetIHDR+4 : offsetIHDR+8]))
	return largura, altura, nil
}
