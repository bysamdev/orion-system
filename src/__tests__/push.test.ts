import { describe, expect, it } from 'vitest';
import { base64UrlParaBytes } from '@/lib/push';

describe('base64UrlParaBytes', () => {
  it('decodifica base64url sem preenchimento', () => {
    // "hi?" em base64 é "aGk/"; em base64url sem "=" vira "aGk_".
    expect(Array.from(base64UrlParaBytes('aGk_'))).toEqual([104, 105, 63]);
  });

  it('completa o preenchimento que falta', () => {
    expect(Array.from(base64UrlParaBytes('aGk'))).toEqual([104, 105]);
  });

  it('gera 65 bytes para uma chave pública VAPID', () => {
    const chave = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    expect(base64UrlParaBytes(chave).length).toBe(65);
  });
});
