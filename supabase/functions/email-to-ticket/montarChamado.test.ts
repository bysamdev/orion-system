import { describe, expect, it } from 'vitest'
import {
  ehErroDefinitivo,
  MINIMO_DESCRICAO,
  MINIMO_TITULO,
  montarDescricao,
  montarTitulo,
} from './montarChamado'

// O que importa aqui é que NADA que estas funções devolvem seja recusado pelas
// constraints de public.tickets. Por isso cada caso confere o comprimento
// contra o mínimo do banco, e não só o texto exato.
const passaNoBanco = (texto: string, minimo: number) => texto.trim().length >= minimo

describe('montarDescricao', () => {
  // O caso real que motivou o módulo: o primeiro e-mail de teste tinha
  // corpo "teste" e foi recusado por tickets_description_length.
  it('embrulha corpo curto sem perder a mensagem original', () => {
    const descricao = montarDescricao('teste', null)
    expect(descricao).toContain('"teste"')
    expect(passaNoBanco(descricao, MINIMO_DESCRICAO)).toBe(true)
  })

  it('mantém intacto um corpo que já tem tamanho suficiente', () => {
    expect(montarDescricao('O computador não liga desde ontem.', null))
      .toBe('O computador não liga desde ontem.')
  })

  it('prefere o texto puro ao HTML', () => {
    expect(montarDescricao('texto puro suficiente', '<p>versão html</p>')).toBe('texto puro suficiente')
  })

  // O Resend documenta que text pode vir nulo; nesse caso sobra o HTML.
  it('usa o HTML quando não há texto puro', () => {
    expect(montarDescricao(null, '<p>Mensagem só em HTML</p>')).toBe('<p>Mensagem só em HTML</p>')
  })

  it('gera descrição válida para e-mail sem corpo nenhum', () => {
    const descricao = montarDescricao(null, null)
    expect(passaNoBanco(descricao, MINIMO_DESCRICAO)).toBe(true)
  })

  it('trata corpo feito só de espaços como vazio', () => {
    const descricao = montarDescricao('   \n  ', '')
    expect(passaNoBanco(descricao, MINIMO_DESCRICAO)).toBe(true)
    expect(descricao).not.toContain('""')
  })
})

describe('montarTitulo', () => {
  it('usa o assunto quando ele tem tamanho suficiente', () => {
    expect(montarTitulo('teste')).toBe('teste')
  })

  it('cai no título padrão quando o assunto é curto demais', () => {
    const titulo = montarTitulo('oi')
    expect(passaNoBanco(titulo, MINIMO_TITULO)).toBe(true)
    expect(titulo).not.toBe('oi')
  })

  it('cai no título padrão quando não há assunto', () => {
    expect(passaNoBanco(montarTitulo(undefined), MINIMO_TITULO)).toBe(true)
    expect(passaNoBanco(montarTitulo('   '), MINIMO_TITULO)).toBe(true)
  })
})

describe('ehErroDefinitivo', () => {
  // 23514 é exatamente o erro do primeiro teste real.
  it('considera definitiva a violação de CHECK', () => {
    expect(ehErroDefinitivo('23514')).toBe(true)
  })

  it('considera definitivas as outras violações de integridade e de dados', () => {
    expect(ehErroDefinitivo('23502')).toBe(true) // NOT NULL
    expect(ehErroDefinitivo('23503')).toBe(true) // chave estrangeira
    expect(ehErroDefinitivo('22P02')).toBe(true) // valor inválido para o tipo
  })

  // O oposto importa tanto quanto: um erro transitório tratado como definitivo
  // perderia o e-mail para sempre, sem reenvio.
  it('mantém como transitório o que pode dar certo repetindo', () => {
    expect(ehErroDefinitivo('08006')).toBe(false) // conexão caiu
    expect(ehErroDefinitivo('57014')).toBe(false) // timeout
    expect(ehErroDefinitivo('53300')).toBe(false) // conexões esgotadas
  })

  it('não trata como definitivo um erro sem código', () => {
    expect(ehErroDefinitivo(undefined)).toBe(false)
    expect(ehErroDefinitivo(null)).toBe(false)
  })
})
