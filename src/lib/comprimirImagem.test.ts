import { describe, expect, it } from 'vitest';
import { comprimirImagem, dimensoesReduzidas, nomeComExtensao, podeComprimir } from './comprimirImagem';

describe('comprimirImagem', () => {
  it('só comprime formatos rasterizados estáticos', () => {
    expect(podeComprimir('image/jpeg')).toBe(true);
    expect(podeComprimir('image/PNG')).toBe(true);
    expect(podeComprimir('image/gif')).toBe(false);
    expect(podeComprimir('image/svg+xml')).toBe(false);
    expect(podeComprimir('application/pdf')).toBe(false);
  });

  it('reduz mantendo a proporção e nunca amplia', () => {
    expect(dimensoesReduzidas(4000, 3000, 1920)).toEqual({ largura: 1920, altura: 1440 });
    expect(dimensoesReduzidas(1000, 3000, 1920)).toEqual({ largura: 640, altura: 1920 });
    expect(dimensoesReduzidas(800, 600, 1920)).toEqual({ largura: 800, altura: 600 });
  });

  it('troca só a última extensão', () => {
    expect(nomeComExtensao('print.tela.PNG', 'webp')).toBe('print.tela.webp');
    expect(nomeComExtensao('semextensao', 'webp')).toBe('semextensao.webp');
  });

  it('devolve o próprio arquivo quando não é imagem comprimível', async () => {
    const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    expect(await comprimirImagem(pdf)).toBe(pdf);
  });
});
