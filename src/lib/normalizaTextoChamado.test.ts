import { describe, it, expect } from 'vitest';
import {
  normalizarTituloChamado,
  normalizarDescricaoChamado,
  SIGLAS_PRESERVADAS,
} from './normalizaTextoChamado';

describe('normalizarTituloChamado — casos da especificação', () => {
  it('PROBLEMA NO ERP', () => {
    expect(normalizarTituloChamado('PROBLEMA NO ERP')).toBe('Problema no ERP');
  });

  it('erro na impressora', () => {
    expect(normalizarTituloChamado('erro na impressora')).toBe('Erro na impressora');
  });

  it('SISTEMA LENTO. NAO ABRE O SQL SERVER', () => {
    expect(normalizarTituloChamado('SISTEMA LENTO. NAO ABRE O SQL SERVER'))
      .toBe('Sistema lento. Nao abre o SQL Server');
  });

  it('VPN caiu — inalterado', () => {
    expect(normalizarTituloChamado('VPN caiu')).toBe('VPN caiu');
  });

  it('CPU em 100% — inalterado', () => {
    expect(normalizarTituloChamado('CPU em 100%')).toBe('CPU em 100%');
  });

  it('erro CH-C15 no log — o código não é tocado', () => {
    // A tabela da especificação diz "inalterado". A inicial maiúscula é a
    // regra geral de título e vale aqui também; o que a linha protege é o
    // CH-C15, que tem dígito e não pode virar minúscula.
    expect(normalizarTituloChamado('erro CH-C15 no log')).toBe('Erro CH-C15 no log');
  });

  it('URL preservada byte a byte', () => {
    expect(normalizarTituloChamado('acesse https://ORION.BYSAM.DEV'))
      .toBe('Acesse https://ORION.BYSAM.DEV');
  });

  it('espaços em excesso', () => {
    expect(normalizarTituloChamado('   muitos     espaços   ')).toBe('Muitos espaços');
  });

  it('AJUDA!!!', () => {
    expect(normalizarTituloChamado('AJUDA!!!')).toBe('Ajuda');
  });
});

describe('regra de CAPS', () => {
  it('palavra isolada com menos de 4 letras fica como está', () => {
    expect(normalizarTituloChamado('backup do PDV falhou')).toBe('Backup do PDV falhou');
  });

  it('palavra isolada com 4 letras ou mais é baixada', () => {
    expect(normalizarTituloChamado('impressora TRAVOU de novo'))
      .toBe('Impressora travou de novo');
  });

  it('palavra com dígito nunca é baixada', () => {
    expect(normalizarTituloChamado('erro SQL2019 na base')).toBe('Erro SQL2019 na base');
    expect(normalizarTituloChamado('prioridade P0 agora')).toBe('Prioridade P0 agora');
  });

  it('frase em CAPS baixa até palavras curtas de 2 e 3 letras', () => {
    // "NAO" tem 3 letras: sozinha não seria baixada, na frase em CAPS sim.
    expect(normalizarTituloChamado('NAO ABRE O SISTEMA')).toBe('Nao abre o sistema');
  });

  it('duas palavras em CAPS não formam frase em CAPS', () => {
    // Só "SISTEMA" (7 letras) é baixada pela regra de palavra isolada; "OK"
    // tem 2 letras e fica.
    expect(normalizarTituloChamado('SISTEMA OK')).toBe('Sistema OK');
  });

  it('siglas sobrevivem dentro de frase em CAPS', () => {
    expect(normalizarTituloChamado('SEM ACESSO A VPN E AO RDP'))
      .toBe('Sem acesso a VPN e ao RDP');
  });

  it('sigla digitada em minúscula volta à forma canônica', () => {
    expect(normalizarTituloChamado('problema no erp da empresa'))
      .toBe('Problema no ERP da empresa');
  });

  it('nome de produto ganha a grafia canônica', () => {
    expect(normalizarTituloChamado('instalar TEAMVIEWER na máquina'))
      .toBe('Instalar TeamViewer na máquina');
  });
});

describe('trechos protegidos', () => {
  it('conteúdo entre crases não é tocado', () => {
    expect(normalizarTituloChamado('rodar `SELECT * FROM CLIENTES` no banco'))
      .toBe('Rodar `SELECT * FROM CLIENTES` no banco');
  });

  it('e-mail preservado', () => {
    expect(normalizarTituloChamado('não recebo de SUPORTE@BYSAM.DEV'))
      .toBe('Não recebo de SUPORTE@BYSAM.DEV');
  });

  it('URL não vira início de frase', () => {
    expect(normalizarDescricaoChamado('veja https://ORION.BYSAM.DEV/AJUDA. depois me diga'))
      .toBe('Veja https://ORION.BYSAM.DEV/AJUDA. Depois me diga');
  });
});

describe('pontuação final do título', () => {
  it('remove exclamações repetidas', () => {
    expect(normalizarTituloChamado('urgente!!!')).toBe('Urgente');
  });

  it('remove reticências', () => {
    expect(normalizarTituloChamado('não sei o que houve...')).toBe('Não sei o que houve');
  });

  it('remove ponto final solto', () => {
    expect(normalizarTituloChamado('impressora parou.')).toBe('Impressora parou');
  });

  it('mantém interrogação única — é pergunta, não ênfase', () => {
    expect(normalizarTituloChamado('como faço backup?')).toBe('Como faço backup?');
  });

  it('mantém exclamação única', () => {
    expect(normalizarTituloChamado('parou tudo!')).toBe('Parou tudo!');
  });
});

describe('normalizarDescricaoChamado', () => {
  it('capitaliza cada frase', () => {
    expect(normalizarDescricaoChamado('não liga. tentei de tudo! o que faço?'))
      .toBe('Não liga. Tentei de tudo! O que faço?');
  });

  it('colapsa espaços sem destruir parágrafos', () => {
    expect(normalizarDescricaoChamado('primeira    linha\n\nsegunda   linha'))
      .toBe('Primeira linha\n\nSegunda linha');
  });

  it('reduz quebras excessivas a no máximo uma linha em branco', () => {
    expect(normalizarDescricaoChamado('um\n\n\n\n\ndois')).toBe('Um\n\nDois');
  });

  it('não remove pontuação final — a regra é só do título', () => {
    expect(normalizarDescricaoChamado('socorro!!!')).toBe('Socorro!!!');
  });

  it('capitaliza depois de quebra de linha', () => {
    expect(normalizarDescricaoChamado('primeiro item\nsegundo item'))
      .toBe('Primeiro item\nSegundo item');
  });
});

describe('robustez', () => {
  it('string vazia passa direto', () => {
    expect(normalizarTituloChamado('')).toBe('');
    expect(normalizarDescricaoChamado('')).toBe('');
  });

  it('só espaços vira vazio', () => {
    expect(normalizarTituloChamado('     ')).toBe('');
  });

  it('é idempotente — rodar duas vezes dá o mesmo resultado', () => {
    const entradas = [
      'PROBLEMA NO ERP',
      'SISTEMA LENTO. NAO ABRE O SQL SERVER',
      'erro CH-C15 no log',
      'acesse https://ORION.BYSAM.DEV',
      'AJUDA!!!',
    ];
    for (const e of entradas) {
      const uma = normalizarTituloChamado(e);
      expect(normalizarTituloChamado(uma)).toBe(uma);
    }
  });

  it('a allowlist não tem duplicata', () => {
    const vistos = SIGLAS_PRESERVADAS.map(s => s.toUpperCase());
    expect(new Set(vistos).size).toBe(vistos.length);
  });
});
