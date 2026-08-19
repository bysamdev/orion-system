package tray

import (
	"bytes"
	"encoding/binary"
	"regexp"
	"strconv"
	"testing"
)

// pngMinimo monta um PNG sintético válido só até onde dimensoesPNG olha
// (assinatura + IHDR com largura/altura escolhidas) — não precisa ser uma
// imagem decodificável de verdade para os testes de envelope .ico.
func pngMinimo(largura, altura uint32) []byte {
	png := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a} // assinatura
	png = append(png, 0x00, 0x00, 0x00, 0x0d)                      // tamanho do chunk IHDR (13, não usado por dimensoesPNG)
	png = append(png, 'I', 'H', 'D', 'R')
	larguraBytes := make([]byte, 4)
	alturaBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(larguraBytes, largura)
	binary.BigEndian.PutUint32(alturaBytes, altura)
	png = append(png, larguraBytes...)
	png = append(png, alturaBytes...)
	png = append(png, 0x08, 0x02, 0x00, 0x00, 0x00) // resto do IHDR, irrelevante aqui
	return png
}

// TestDataIcon_NaoComecaComAssinaturaPNG é o teste de regressão direto do bug
// original: antes da correção, DataIcon ERA um PNG cru (assinatura
// \x89PNG\r\n\x1a\n), passado sem envelope para systray.SetIcon — que no
// Windows exige um .ico de verdade. Um PNG cru nos primeiros bytes é
// sintoma de a correção ter sido desfeita.
func TestDataIcon_NaoComecaComAssinaturaPNG(t *testing.T) {
	assinaturaPNG := []byte{0x89, 0x50, 0x4e, 0x47}
	if bytes.HasPrefix(DataIcon, assinaturaPNG) {
		t.Fatal("DataIcon começa com a assinatura de um PNG cru — falta o envelope ICONDIR/ICONDIRENTRY que o Windows exige (ver comentário em icon.go)")
	}
}

// TestDataIcon_TemCabecalhoICONDIRValido verifica os 6 bytes do ICONDIR:
// reserved=0, type=1 (ícone, não cursor), count=len(nomesIconesEmbutidos) —
// uma entrada por resolução embutida da logo real.
func TestDataIcon_TemCabecalhoICONDIRValido(t *testing.T) {
	if len(DataIcon) < 6 {
		t.Fatalf("DataIcon tem só %d bytes; ICONDIR sozinho já precisa de 6", len(DataIcon))
	}

	reserved := binary.LittleEndian.Uint16(DataIcon[0:2])
	tipo := binary.LittleEndian.Uint16(DataIcon[2:4])
	count := binary.LittleEndian.Uint16(DataIcon[4:6])

	if reserved != 0 {
		t.Errorf("ICONDIR.reserved = %d; esperado 0", reserved)
	}
	if tipo != 1 {
		t.Errorf("ICONDIR.type = %d; esperado 1 (RES_ICON)", tipo)
	}
	if int(count) != len(nomesIconesEmbutidos) {
		t.Errorf("ICONDIR.count = %d; esperado %d (uma entrada por resolução embutida)", count, len(nomesIconesEmbutidos))
	}
}

// TestDataIcon_EntradasCrescentesEApontamParaDadosValidos percorre as N
// ICONDIRENTRY de DataIcon em ordem, confirmando que (a) a largura declarada
// cresce estritamente a cada entrada — Windows espera as entradas ordenadas
// — e (b) o offset/tamanho de cada uma aponta para bytes que começam com a
// assinatura PNG, dentro dos limites do slice.
func TestDataIcon_EntradasCrescentesEApontamParaDadosValidos(t *testing.T) {
	const tamanhoICONDIR = 6
	const tamanhoICONDIRENTRY = 16

	count := int(binary.LittleEndian.Uint16(DataIcon[4:6]))
	assinaturaPNG := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}

	larguraAnterior := -1
	for i := 0; i < count; i++ {
		entryOffset := tamanhoICONDIR + i*tamanhoICONDIRENTRY
		entry := DataIcon[entryOffset : entryOffset+tamanhoICONDIRENTRY]

		largura := int(entry[0])
		if largura == 0 {
			largura = 256
		}
		if largura <= larguraAnterior {
			t.Errorf("entrada %d: largura %d não é estritamente maior que a anterior (%d) — entradas devem vir em ordem crescente", i, largura, larguraAnterior)
		}
		larguraAnterior = largura

		tamanho := binary.LittleEndian.Uint32(entry[8:12])
		offset := binary.LittleEndian.Uint32(entry[12:16])

		if int(offset+tamanho) > len(DataIcon) {
			t.Fatalf("entrada %d: offset+tamanho (%d+%d) ultrapassa DataIcon (%d bytes)", i, offset, tamanho, len(DataIcon))
		}
		dados := DataIcon[offset : offset+tamanho]
		if !bytes.HasPrefix(dados, assinaturaPNG) {
			t.Errorf("entrada %d: bytes no offset %d não começam com a assinatura PNG", i, offset)
		}
	}
}

// TestConstruirICOMultiplo_EhDeterministico garante que a montagem do
// envelope é pura — mesma entrada, mesma saída sempre.
func TestConstruirICOMultiplo_EhDeterministico(t *testing.T) {
	pngs := [][]byte{pngMinimo(16, 16), pngMinimo(32, 32)}

	a, err := construirICOMultiplo(pngs)
	if err != nil {
		t.Fatalf("construirICOMultiplo: %v", err)
	}
	b, err := construirICOMultiplo(pngs)
	if err != nil {
		t.Fatalf("construirICOMultiplo: %v", err)
	}
	if !bytes.Equal(a, b) {
		t.Fatal("construirICOMultiplo não é determinística para a mesma entrada")
	}
}

// TestConstruirICOMultiplo_OrdenaPorLargura confirma que a ordem de entrada
// não importa — o resultado sempre sai com as entradas em ordem crescente
// de largura.
func TestConstruirICOMultiplo_OrdenaPorLargura(t *testing.T) {
	fora := [][]byte{pngMinimo(48, 48), pngMinimo(16, 16), pngMinimo(32, 32)}

	ico, err := construirICOMultiplo(fora)
	if err != nil {
		t.Fatalf("construirICOMultiplo: %v", err)
	}

	const tamanhoICONDIR = 6
	count := int(binary.LittleEndian.Uint16(ico[4:6]))
	if count != 3 {
		t.Fatalf("count = %d; esperado 3", count)
	}
	larguras := []int{int(ico[tamanhoICONDIR+0]), int(ico[tamanhoICONDIR+16]), int(ico[tamanhoICONDIR+32])}
	if larguras[0] != 16 || larguras[1] != 32 || larguras[2] != 48 {
		t.Errorf("larguras nas entradas = %v; esperado [16 32 48] (ordem crescente independente da ordem de entrada)", larguras)
	}
}

// TestConstruirICOMultiplo_RejeitaListaVazia e
// TestConstruirICOMultiplo_RejeitaDimensaoInvalida cobrem os dois jeitos de
// entrada malformada que dimensoesPNG/construirICOMultiplo detectam.
func TestConstruirICOMultiplo_RejeitaListaVazia(t *testing.T) {
	if _, err := construirICOMultiplo(nil); err == nil {
		t.Fatal("esperava erro para lista vazia de imagens")
	}
}

func TestConstruirICOMultiplo_RejeitaDimensaoInvalida(t *testing.T) {
	if _, err := construirICOMultiplo([][]byte{pngMinimo(0, 16)}); err == nil {
		t.Fatal("esperava erro para largura 0 (fora do intervalo 1-256 do ICONDIRENTRY)")
	}
	if _, err := construirICOMultiplo([][]byte{pngMinimo(512, 16)}); err == nil {
		t.Fatal("esperava erro para largura 512 (fora do intervalo 1-256 do ICONDIRENTRY)")
	}
}

// TestDimensoesPNG_LeCorretamenteDoIHDR e
// TestDimensoesPNG_RejeitaAssinaturaInvalida cobrem o parser que extrai
// largura/altura sem decodificar a imagem inteira.
func TestDimensoesPNG_LeCorretamenteDoIHDR(t *testing.T) {
	l, a, err := dimensoesPNG(pngMinimo(48, 40))
	if err != nil {
		t.Fatalf("dimensoesPNG: %v", err)
	}
	if l != 48 || a != 40 {
		t.Errorf("dimensoesPNG = (%d, %d); esperado (48, 40)", l, a)
	}
}

func TestDimensoesPNG_RejeitaAssinaturaInvalida(t *testing.T) {
	if _, _, err := dimensoesPNG([]byte("nao e um png")); err == nil {
		t.Fatal("esperava erro para dados sem assinatura PNG válida")
	}
}

// TestNomesIconesEmbutidos_TodosCarregamEBatemComOTamanhoNoNome confirma que
// cada arquivo embutido em assets/ existe, é um PNG válido quadrado, e que a
// dimensão real bate com o número no nome do arquivo (icon_NN.png) — pega
// divergência entre o asset gerado e o nome que descreve seu tamanho.
func TestNomesIconesEmbutidos_TodosCarregamEBatemComOTamanhoNoNome(t *testing.T) {
	re := regexp.MustCompile(`icon_(\d+)\.png$`)
	for _, nome := range nomesIconesEmbutidos {
		dados, err := iconAssets.ReadFile(nome)
		if err != nil {
			t.Fatalf("ReadFile(%s): %v", nome, err)
		}
		l, a, err := dimensoesPNG(dados)
		if err != nil {
			t.Fatalf("dimensoesPNG(%s): %v", nome, err)
		}
		if l != a {
			t.Errorf("%s: largura (%d) != altura (%d) — ícone deveria ser quadrado", nome, l, a)
		}

		match := re.FindStringSubmatch(nome)
		if match == nil {
			t.Fatalf("%s: nome não segue o padrão icon_NN.png", nome)
		}
		esperado, _ := strconv.Atoi(match[1])
		if l != esperado {
			t.Errorf("%s: dimensão real (%d) não bate com o tamanho no nome (%d)", nome, l, esperado)
		}
	}
}
