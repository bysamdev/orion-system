import { describe, expect, it } from 'vitest';
import { acessosAcimaDoLimite, descreverDispositivo, type SessaoDoUsuario } from '@/lib/sessoes';

const sessao = (id: string): SessaoDoUsuario => ({
  id, criada_em: '', ultimo_uso: '', ip: null, user_agent: null, atual: false,
});

describe('acessosAcimaDoLimite', () => {
  it('é zero até 2 dispositivos', () => {
    expect(acessosAcimaDoLimite([])).toBe(0);
    expect(acessosAcimaDoLimite([sessao('a'), sessao('b')])).toBe(0);
  });

  it('conta quantos passam do limite', () => {
    expect(acessosAcimaDoLimite([sessao('a'), sessao('b'), sessao('c')])).toBe(1);
    expect(acessosAcimaDoLimite(['a', 'b', 'c', 'd', 'e'].map(sessao))).toBe(3);
  });
});

describe('descreverDispositivo', () => {
  it('reconhece os navegadores comuns', () => {
    expect(descreverDispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'))
      .toBe('Chrome no Windows');
    expect(descreverDispositivo('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0'))
      .toBe('Edge no Windows');
    expect(descreverDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'))
      .toBe('Safari no iPhone');
    expect(descreverDispositivo('Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36'))
      .toBe('Chrome no Android');
    expect(descreverDispositivo('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'))
      .toBe('Firefox no Linux');
  });

  it('não quebra com user agent vazio ou estranho', () => {
    expect(descreverDispositivo(null)).toBe('Dispositivo desconhecido');
    expect(descreverDispositivo('')).toBe('Dispositivo desconhecido');
    expect(descreverDispositivo('curl/8.0')).toBe('Dispositivo desconhecido');
  });
});
