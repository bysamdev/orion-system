// Compressão de imagem no navegador, antes do envio ao Storage: reduz a
// maior dimensão e regrava em WebP. Sem dependência externa (canvas nativo).
// Só troca o arquivo quando o resultado sai realmente menor; GIF (pode ser
// animado) e SVG (vetorial) passam intactos.

export interface OpcoesDeCompressao {
  ladoMaximo?: number;
  qualidade?: number;
}

const TIPOS_COMPRIMIVEIS = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];

export function podeComprimir(tipo: string): boolean {
  return TIPOS_COMPRIMIVEIS.includes(tipo.toLowerCase());
}

// Nova largura/altura mantendo a proporção, sem nunca aumentar a imagem.
export function dimensoesReduzidas(largura: number, altura: number, ladoMaximo: number) {
  const maior = Math.max(largura, altura);
  if (maior <= ladoMaximo) return { largura, altura };
  const fator = ladoMaximo / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

export function nomeComExtensao(nome: string, extensao: string): string {
  const ponto = nome.lastIndexOf('.');
  const base = ponto > 0 ? nome.slice(0, ponto) : nome;
  return `${base}.${extensao}`;
}

export async function comprimirImagem(arquivo: File, opcoes: OpcoesDeCompressao = {}): Promise<File> {
  const { ladoMaximo = 1920, qualidade = 0.8 } = opcoes;
  if (!podeComprimir(arquivo.type) || typeof createImageBitmap !== 'function') return arquivo;

  try {
    const bitmap = await createImageBitmap(arquivo);
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height, ladoMaximo);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', qualidade));
    // Navegador sem suporte a WebP devolve PNG; nesse caso, ou se não
    // ficou menor, mantém o original.
    if (!blob || blob.type !== 'image/webp' || blob.size >= arquivo.size) return arquivo;

    return new File([blob], nomeComExtensao(arquivo.name, 'webp'), {
      type: 'image/webp',
      lastModified: arquivo.lastModified,
    });
  } catch {
    return arquivo;
  }
}
