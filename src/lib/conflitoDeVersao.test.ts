import { describe, expect, it } from 'vitest'
import { ehConflitoDeVersao } from './conflitoDeVersao'

describe('ehConflitoDeVersao', () => {
  it('reconhece o código atual, PT409', () => {
    expect(ehConflitoDeVersao({ code: 'PT409' })).toBe(true)
  })

  // Mantido por segurança, para função que ainda levante o código antigo.
  it('reconhece o código antigo, 40001', () => {
    expect(ehConflitoDeVersao({ code: '40001' })).toBe(true)
  })

  // 42501 é "não encontrado ou sem permissão". Tratá-lo como conflito faria a
  // tela pedir para recarregar quando o problema é permissão, e recarregar não
  // resolveria nada.
  it('não confunde falta de permissão com conflito', () => {
    expect(ehConflitoDeVersao({ code: '42501' })).toBe(false)
  })

  it('não trata como conflito um erro sem código', () => {
    expect(ehConflitoDeVersao({})).toBe(false)
    expect(ehConflitoDeVersao(null)).toBe(false)
    expect(ehConflitoDeVersao(undefined)).toBe(false)
  })
})
