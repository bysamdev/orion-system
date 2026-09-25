import { describe, expect, it } from 'vitest'
import { inscricaoExpirada, montarAviso } from './aviso'

const base = { id: 'abc', title: 'Chamado #12 em andamento', message: 'O técnico começou o atendimento.', link: '/tickets/12' }

describe('montarAviso', () => {
  it('leva título, texto e link interno', () => {
    expect(montarAviso(base)).toEqual({
      title: 'Chamado #12 em andamento',
      body: 'O técnico começou o atendimento.',
      url: '/tickets/12',
      tag: 'orion-/tickets/12',
    })
  })

  it('avisos do mesmo chamado substituem um ao outro', () => {
    expect(montarAviso({ ...base, id: 'outro' }).tag).toBe(montarAviso(base).tag)
    expect(montarAviso({ ...base, link: null }).tag).toBe('orion-abc')
  })

  it('troca link externo ou vazio pela página inicial', () => {
    expect(montarAviso({ ...base, link: 'https://exemplo.com' }).url).toBe('/')
    expect(montarAviso({ ...base, link: '//exemplo.com/x' }).url).toBe('/')
    expect(montarAviso({ ...base, link: null }).url).toBe('/')
  })

  it('corta textos longos', () => {
    const aviso = montarAviso({ ...base, title: 'x'.repeat(200), message: 'y'.repeat(500) })
    expect(aviso.title.length).toBe(80)
    expect(aviso.body.length).toBe(200)
    expect(aviso.body.endsWith('…')).toBe(true)
  })

  it('usa o nome do sistema quando não há título', () => {
    expect(montarAviso({ ...base, title: '' }).title).toBe('Orion System')
  })
})

describe('inscricaoExpirada', () => {
  it('apaga só em 404 e 410', () => {
    expect(inscricaoExpirada(404)).toBe(true)
    expect(inscricaoExpirada(410)).toBe(true)
    expect(inscricaoExpirada(429)).toBe(false)
    expect(inscricaoExpirada(500)).toBe(false)
    expect(inscricaoExpirada(undefined)).toBe(false)
  })
})
