package tray

// pngIconData é um quadrado azul simples de 16x16 em PNG — mesmo ícone de
// antes (placeholder, não a identidade visual real do produto — ver
// ARCHITECTURE.md §6.9), só que agora embrulhado num .ico válido via
// DataIcon, em vez de passado cru para systray.SetIcon.
var pngIconData = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68,
	0x36, 0x00, 0x00, 0x00, 0x01, 0x73, 0x52, 0x47, 0x42, 0x00, 0xae, 0xce, 0x1c, 0xe9, 0x00, 0x00,
	0x00, 0x1c, 0x49, 0x44, 0x41, 0x54, 0x28, 0xcf, 0x63, 0x60, 0x64, 0xf8, 0xff, 0x3f, 0x03, 0x0d,
	0x0c, 0x0c, 0x18, 0xa5, 0x20, 0x21, 0x21, 0x00, 0x7e, 0x04, 0x00, 0xaa, 0x81, 0x1d, 0xb0, 0x1d,
	0x16, 0x98, 0xac, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
}

// DataIcon é pngIconData embrulhado num .ico de verdade — formato
// "PNG-compressed icon" (ICONDIR + ICONDIRENTRY apontando pro PNG cru,
// suportado desde o Windows Vista, sem precisar recodificar como BMP+máscara
// AND do .ico clássico pré-Vista).
//
// Bug corrigido aqui: DataIcon ERA o PNG cru, passado direto para
// systray.SetIcon. No Windows, systray grava esses bytes num arquivo
// temporário e chama LoadImageW(..., IMAGE_ICON, ...) — que exige o
// container ICONDIR/ICONDIRENTRY de verdade, não um PNG solto. Sem esse
// envelope o parse falha, LoadImageW retorna erro, e SetIcon loga "Unable to
// set icon: The operation completed successfully" (GetLastError residual de
// uma chamada Win32 anterior bem-sucedida, mascarando o erro real de
// parsing do ícone) — o ícone da bandeja nunca chegava a ser definido.
var DataIcon = construirICO(pngIconData)

// construirICO monta o cabeçalho .ico mínimo (ICONDIR de 1 entrada +
// ICONDIRENTRY) na frente dos bytes de um PNG, sem recodificar a imagem —
// só o envelope que o Win32 exige para reconhecer o arquivo como ícone.
func construirICO(png []byte) []byte {
	const (
		tamanhoICONDIR      = 6
		tamanhoICONDIRENTRY = 16
	)

	ico := make([]byte, 0, tamanhoICONDIR+tamanhoICONDIRENTRY+len(png))

	// ICONDIR: reserved=0, type=1 (ícone), count=1.
	ico = append(ico, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00)

	// ICONDIRENTRY: 16x16 (mesmo tamanho do PNG original), sem paleta, 1
	// plano de cor, 32 bits por pixel; tamanho e offset apontam pro PNG
	// logo em seguida no arquivo.
	tamanho := uint32(len(png))
	offset := uint32(tamanhoICONDIR + tamanhoICONDIRENTRY)
	ico = append(ico,
		16, 16, // largura, altura em pixels
		0x00,       // paleta de cores: nenhuma (imagem não indexada)
		0x00,       // reservado, deve ser 0
		0x01, 0x00, // planos de cor: 1
		0x20, 0x00, // bits por pixel: 32
		byte(tamanho), byte(tamanho>>8), byte(tamanho>>16), byte(tamanho>>24),
		byte(offset), byte(offset>>8), byte(offset>>16), byte(offset>>24),
	)

	return append(ico, png...)
}
