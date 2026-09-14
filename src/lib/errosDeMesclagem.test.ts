import { describe, it, expect } from 'vitest';
import { mensagemDeErroDeMesclagem, MENSAGENS_DE_MESCLAGEM } from './errosDeMesclagem';

describe('mensagemDeErroDeMesclagem', () => {
  it('traduz cada ERRCODE que a função de banco levanta', () => {
    for (const [code, esperado] of Object.entries(MENSAGENS_DE_MESCLAGEM)) {
      expect(mensagemDeErroDeMesclagem({ code, message: 'texto cru do postgres' })).toBe(esperado);
    }
  });

  it('cobre exatamente os códigos que fn_merge_tickets levanta', () => {
    // Se a migration ganhar um RAISE novo, este teste é o lembrete de
    // traduzi-lo em vez de deixar vazar o texto do Postgres.
    expect(Object.keys(MENSAGENS_DE_MESCLAGEM).sort()).toEqual(
      ['28000', '42501', 'ORI10', 'ORI11', 'ORI12', 'ORI13'].sort()
    );
  });

  it('mantém a mensagem original quando o código é desconhecido', () => {
    expect(mensagemDeErroDeMesclagem({ code: '23505', message: 'duplicate key' })).toBe('duplicate key');
  });

  it('mantém a mensagem original quando não há código', () => {
    expect(mensagemDeErroDeMesclagem({ message: 'Failed to fetch' })).toBe('Failed to fetch');
  });

  it('cai no texto genérico quando não há nada aproveitável', () => {
    const generico = 'Não foi possível mesclar os chamados.';
    expect(mensagemDeErroDeMesclagem(null)).toBe(generico);
    expect(mensagemDeErroDeMesclagem(undefined)).toBe(generico);
    expect(mensagemDeErroDeMesclagem('erro em string')).toBe(generico);
    expect(mensagemDeErroDeMesclagem({ code: 'XX000', message: '   ' })).toBe(generico);
  });
});
