import { describe, expect, it } from 'vitest'
import { ehTipoValido, montarMensagem } from './mensagem'

const AGORA = new Date('2026-09-18T12:00:00Z')

describe('montarMensagem', () => {
  it('avisa o início com a taxa e a escala em relação ao normal', () => {
    const m = montarMensagem(
      { tipo: 'inicio', taxa_por_segundo: 1470, janela_segundos: 300, desde: '2026-09-18T11:55:00Z' },
      AGORA,
    )
    expect(m.assunto).toBe('[Orion] Banco com erros em excesso')
    expect(m.html).toContain('1.470 rollbacks por segundo')
    // 1470 / 0,1 = 14.700 vezes o normal. Sem essa escala, o número sozinho
    // não diz se é grave.
    expect(m.html).toContain('14.700 vezes o normal')
    expect(m.html).toContain('Como investigar')
  })

  it('no lembrete, diz há quanto tempo o problema continua', () => {
    const m = montarMensagem(
      { tipo: 'persiste', taxa_por_segundo: 80, janela_segundos: 300, desde: '2026-09-18T09:30:00Z' },
      AGORA,
    )
    expect(m.assunto).toBe('[Orion] Banco continua com erros em excesso há 2 horas e 30 min')
    expect(m.html).toContain('<strong>continua</strong>')
  })

  it('avisa a normalização com a duração da anomalia', () => {
    const m = montarMensagem(
      { tipo: 'normalizado', taxa_por_segundo: 0.1, janela_segundos: 300, desde: '2026-09-18T11:15:00Z' },
      AGORA,
    )
    expect(m.assunto).toBe('[Orion] Banco normalizado')
    expect(m.html).toContain('45 minutos')
    // Na normalização não faz sentido mandar o roteiro de investigação.
    expect(m.html).not.toContain('Como investigar')
  })

  it('não inventa escala quando a taxa está perto do normal', () => {
    const m = montarMensagem(
      { tipo: 'inicio', taxa_por_segundo: 0.15, janela_segundos: 300, desde: null },
      AGORA,
    )
    expect(m.html).not.toContain('vezes o normal')
  })

  it('funciona sem data de início', () => {
    const m = montarMensagem(
      { tipo: 'persiste', taxa_por_segundo: 50, janela_segundos: 300, desde: null },
      AGORA,
    )
    expect(m.assunto).toBe('[Orion] Banco continua com erros em excesso')
  })

  it('usa singular e plural corretos na duração', () => {
    const m = montarMensagem(
      { tipo: 'normalizado', taxa_por_segundo: 0, janela_segundos: 300, desde: '2026-09-18T11:59:00Z' },
      AGORA,
    )
    expect(m.html).toContain('1 minuto<')
    expect(m.html).not.toContain('1 minutos')
  })
})

describe('ehTipoValido', () => {
  it('aceita só os três tipos que o banco envia', () => {
    expect(ehTipoValido('inicio')).toBe(true)
    expect(ehTipoValido('persiste')).toBe(true)
    expect(ehTipoValido('normalizado')).toBe(true)
    expect(ehTipoValido('outro')).toBe(false)
    expect(ehTipoValido(undefined)).toBe(false)
  })
})
