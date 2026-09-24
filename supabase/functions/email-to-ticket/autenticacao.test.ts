import { describe, expect, it } from 'vitest'
import { remetenteAutenticado } from './autenticacao'

describe('remetenteAutenticado', () => {
  it('aceita DMARC pass', () => {
    expect(remetenteAutenticado({ spf: 'pass', dkim: 'pass', dmarc: 'pass' })).toBe(true)
  })

  it('aceita DMARC gray quando SPF ou DKIM passou (domínio com p=none, como o Gmail)', () => {
    expect(remetenteAutenticado({ spf: 'pass', dkim: 'gray', dmarc: 'gray' })).toBe(true)
    expect(remetenteAutenticado({ spf: 'gray', dkim: 'pass', dmarc: 'gray' })).toBe(true)
  })

  it('recusa DMARC gray sem SPF nem DKIM', () => {
    expect(remetenteAutenticado({ spf: 'gray', dkim: 'gray', dmarc: 'gray' })).toBe(false)
  })

  it('recusa DMARC fail, unknown ou falha de processamento', () => {
    expect(remetenteAutenticado({ spf: 'pass', dkim: 'pass', dmarc: 'fail' })).toBe(false)
    expect(remetenteAutenticado({ spf: 'pass', dkim: 'pass', dmarc: 'unknown' })).toBe(false)
    expect(remetenteAutenticado({ spf: 'pass', dkim: 'pass', dmarc: 'processing_failed' })).toBe(false)
  })

  it('recusa quando o resultado não veio', () => {
    expect(remetenteAutenticado(null)).toBe(false)
    expect(remetenteAutenticado(undefined)).toBe(false)
    expect(remetenteAutenticado({})).toBe(false)
  })
})
