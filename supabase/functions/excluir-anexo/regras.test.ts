import { describe, expect, it } from 'vitest'
import { caminhoDeDescarteValido, caminhoNoBucket, envioRecente, idDeAnexoValido, naoEncontrado } from './regras'

const CHAMADO = '11111111-2222-3333-4444-555555555555'

describe('caminhoNoBucket', () => {
  it('aceita o caminho já relativo', () => {
    expect(caminhoNoBucket(`${CHAMADO}/foto.png`)).toBe(`${CHAMADO}/foto.png`)
    expect(caminhoNoBucket(`/${CHAMADO}/foto.png`)).toBe(`${CHAMADO}/foto.png`)
  })

  it('extrai o caminho de uma URL antiga do Storage', () => {
    const url = `https://x.supabase.co/storage/v1/object/public/ticket-files/${CHAMADO}/meu%20arquivo.pdf`
    expect(caminhoNoBucket(url)).toBe(`${CHAMADO}/meu arquivo.pdf`)
  })

  it('recusa URL de outro bucket ou vazia', () => {
    expect(caminhoNoBucket('https://x.supabase.co/storage/v1/object/public/avatars/a.png')).toBeNull()
    expect(caminhoNoBucket('')).toBeNull()
  })
})

describe('caminhoDeDescarteValido', () => {
  it('aceita só "<chamado>/<arquivo>"', () => {
    expect(caminhoDeDescarteValido(`${CHAMADO}/foto.png`)).toBe(true)
    expect(caminhoDeDescarteValido(`${CHAMADO}/sub/foto.png`)).toBe(false)
    expect(caminhoDeDescarteValido('../outro/foto.png')).toBe(false)
    expect(caminhoDeDescarteValido('foto.png')).toBe(false)
    expect(caminhoDeDescarteValido(null)).toBe(false)
  })
})

describe('envioRecente', () => {
  const agora = Date.parse('2026-09-23T12:00:00Z')

  it('aceita até 15 minutos', () => {
    expect(envioRecente('2026-09-23T11:50:00Z', agora)).toBe(true)
    expect(envioRecente('2026-09-23T11:45:00Z', agora)).toBe(true)
  })

  it('recusa arquivo antigo ou sem data', () => {
    expect(envioRecente('2026-09-23T11:40:00Z', agora)).toBe(false)
    expect(envioRecente(null, agora)).toBe(false)
    expect(envioRecente('data ruim', agora)).toBe(false)
  })
})

describe('naoEncontrado e idDeAnexoValido', () => {
  it('trata objeto ausente como sucesso', () => {
    expect(naoEncontrado('Object not found')).toBe(true)
    expect(naoEncontrado('The resource does not exist')).toBe(true)
    expect(naoEncontrado('permission denied')).toBe(false)
    expect(naoEncontrado(undefined)).toBe(false)
  })

  it('aceita só uuid como id de anexo', () => {
    expect(idDeAnexoValido(CHAMADO)).toBe(true)
    expect(idDeAnexoValido('1 OR 1=1')).toBe(false)
    expect(idDeAnexoValido(42)).toBe(false)
  })
})
