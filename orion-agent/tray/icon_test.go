package tray

import (
	"bytes"
	"encoding/binary"
	"testing"
)

// TestDataIcon_NaoComecaComAssinaturaPNG é o teste de regressão direto do bug
// original: antes desta correção, DataIcon ERA o PNG cru (assinatura
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
// reserved=0, type=1 (ícone, não cursor), count=1 (uma imagem só).
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
	if count != 1 {
		t.Errorf("ICONDIR.count = %d; esperado 1 (uma única imagem embutida)", count)
	}
}

// TestDataIcon_ICONDIRENTRYApontaParaOPNGOriginal garante que o tamanho e o
// offset gravados no ICONDIRENTRY realmente localizam pngIconData dentro de
// DataIcon — é o que faz o Windows conseguir achar e decodificar a imagem.
func TestDataIcon_ICONDIRENTRYApontaParaOPNGOriginal(t *testing.T) {
	const offsetTamanho = 8  // ICONDIRENTRY.bytesInRes começa no byte 14 (6+8)
	const offsetOffset = 12  // ICONDIRENTRY.imageOffset começa no byte 18 (6+12)
	entry := DataIcon[6:22]  // ICONDIRENTRY tem 16 bytes, logo após o ICONDIR de 6

	tamanho := binary.LittleEndian.Uint32(entry[offsetTamanho : offsetTamanho+4])
	offset := binary.LittleEndian.Uint32(entry[offsetOffset : offsetOffset+4])

	if int(tamanho) != len(pngIconData) {
		t.Errorf("ICONDIRENTRY.bytesInRes = %d; esperado %d (len(pngIconData))", tamanho, len(pngIconData))
	}
	if offset != 22 {
		t.Errorf("ICONDIRENTRY.imageOffset = %d; esperado 22 (6 do ICONDIR + 16 do ICONDIRENTRY)", offset)
	}

	dadosEmbutidos := DataIcon[offset : offset+tamanho]
	if !bytes.Equal(dadosEmbutidos, pngIconData) {
		t.Error("bytes apontados pelo ICONDIRENTRY não batem com pngIconData — o PNG embutido está corrompido ou deslocado")
	}
}

// TestDataIcon_LarguraEAlturaBatemComOPNG trava a largura/altura declaradas
// no ICONDIRENTRY em 16x16, mesmo tamanho do PNG original — um mismatch
// aqui faz o Windows escalar ou rejeitar o ícone.
func TestDataIcon_LarguraEAlturaBatemComOPNG(t *testing.T) {
	entry := DataIcon[6:22]
	largura, altura := entry[0], entry[1]

	if largura != 16 || altura != 16 {
		t.Errorf("ICONDIRENTRY largura/altura = %d/%d; esperado 16/16", largura, altura)
	}
}

// TestConstruirICO_EhDeterministico garante que a montagem do envelope é
// pura — mesma entrada, mesma saída sempre.
func TestConstruirICO_EhDeterministico(t *testing.T) {
	a := construirICO(pngIconData)
	b := construirICO(pngIconData)
	if !bytes.Equal(a, b) {
		t.Fatal("construirICO não é determinística para a mesma entrada")
	}
}
