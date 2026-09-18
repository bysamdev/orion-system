import { describe, expect, it } from 'vitest';
import {
  MAX_RESPOSTA,
  PERGUNTAS_POR_CATEGORIA,
  montarDescricao,
  respostasPreenchidas,
  validarRespostas,
} from './perguntasPorCategoria';

describe('PERGUNTAS_POR_CATEGORIA', () => {
  it('cobre todas as categorias que o cliente pode escolher', () => {
    expect(Object.keys(PERGUNTAS_POR_CATEGORIA).sort()).toEqual(
      ['email', 'erp', 'hardware', 'outros', 'rede', 'software'],
    );
  });

  it('toda categoria tem ao menos uma pergunta obrigatória', () => {
    // Sem isso a descrição poderia sair vazia e o banco recusaria o chamado
    // (tickets_description_length exige 10 caracteres).
    for (const [categoria, perguntas] of Object.entries(PERGUNTAS_POR_CATEGORIA)) {
      expect(perguntas.some((p) => p.obrigatoria), categoria).toBe(true);
    }
  });

  it('ids de pergunta não se repetem dentro da categoria', () => {
    for (const perguntas of Object.values(PERGUNTAS_POR_CATEGORIA)) {
      const ids = perguntas.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('validarRespostas', () => {
  it('cobra as obrigatórias e deixa as opcionais passarem vazias', () => {
    const erros = validarRespostas('outros', {});
    expect(Object.keys(erros)).toEqual(['solicitacao']);
  });

  it('aceita o formulário completo', () => {
    expect(validarRespostas('outros', { solicitacao: 'Acesso à pasta do financeiro' })).toEqual({});
  });

  it('não aceita resposta só de espaços', () => {
    expect(validarRespostas('outros', { solicitacao: '   ' })).toHaveProperty('solicitacao');
  });

  it('recusa opção que não está na lista', () => {
    const erros = validarRespostas('hardware', {
      problema: 'Não liga', equipamento: 'Geladeira', desde_quando: 'ontem', liga: 'Não', reiniciou: 'Sim',
    });
    expect(Object.keys(erros)).toEqual(['equipamento']);
  });

  it('limita o tamanho de cada resposta', () => {
    const erros = validarRespostas('outros', { solicitacao: 'x'.repeat(MAX_RESPOSTA + 1) });
    expect(erros.solicitacao).toMatch(/no máximo/);
  });
});

describe('montarDescricao', () => {
  it('põe cada pergunta seguida da resposta, pulando as não respondidas', () => {
    const preenchidas = respostasPreenchidas('rede', {
      problema: 'sem internet desde cedo',
      sem_acesso: 'Internet',
      abrangencia: 'Só eu',
    });
    expect(montarDescricao(preenchidas)).toBe(
      'O que está acontecendo?\nsem internet desde cedo\n\n' +
      'O que está sem acesso?\nInternet\n\n' +
      'Afeta só você ou outras pessoas também?\nSó eu',
    );
  });

  it('normaliza o texto livre mas não a opção escolhida', () => {
    const preenchidas = respostasPreenchidas(
      'rede',
      { problema: 'caiu', sem_acesso: 'Internet', abrangencia: 'Só eu' },
      (t) => t.toUpperCase(),
    );
    expect(preenchidas.map((r) => r.resposta)).toEqual(['CAIU', 'Internet', 'Só eu']);
  });

  it('acrescenta o complemento livre no fim', () => {
    const descricao = montarDescricao([{ pergunta: 'O que você precisa?', resposta: 'Um mouse' }], ' urgente ');
    expect(descricao).toBe('O que você precisa?\nUm mouse\n\nInformações adicionais\nurgente');
  });
});
