import { describe, expect, it } from 'vitest'
import {
  ALFABETO_SENHA,
  gerarSenhaProvisoria,
  podeGerirUsuarios,
  validarAtualizacaoDeUsuario,
  validarCriacaoDeUsuario,
  validarNovaSenha,
  type DadosDaAtualizacao,
} from './regras-de-usuario'

const EMPRESA_A = 'aaaaaaaa-0000-0000-0000-000000000000'
const EMPRESA_B = 'bbbbbbbb-0000-0000-0000-000000000000'

const admin: DadosDaAtualizacao = {
  chamadorId: 'admin',
  papeisDoChamador: ['admin'],
  escopoGlobal: false,
  empresaDoChamador: EMPRESA_A,
  empresaDoAlvo: EMPRESA_A,
  alvoId: 'alvo',
}

describe('podeGerirUsuarios', () => {
  it('libera só admin e developer', () => {
    expect(podeGerirUsuarios(['admin'])).toBe(true)
    expect(podeGerirUsuarios(['developer'])).toBe(true)
    expect(podeGerirUsuarios(['technician'])).toBe(false)
    expect(podeGerirUsuarios(['customer'])).toBe(false)
    expect(podeGerirUsuarios([])).toBe(false)
  })
})

describe('validarAtualizacaoDeUsuario', () => {
  it('libera admin editando alguém da própria empresa', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, papelNovo: 'technician', statusNovo: 'inactive' })).toBeNull()
  })

  it('exige o usuário alvo', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, alvoId: '' })?.status).toBe(400)
  })

  it('impede trocar o próprio papel', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, alvoId: 'admin', papelNovo: 'developer' })?.status).toBe(400)
  })

  it('bloqueia admin de empresa cliente mexendo em outra empresa', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, empresaDoAlvo: EMPRESA_B })).toEqual({
      status: 403, error: 'Usuário não pertence à sua empresa',
    })
    expect(validarAtualizacaoDeUsuario({ ...admin, empresaDoAlvo: null })?.status).toBe(403)
    expect(validarAtualizacaoDeUsuario({ ...admin, empresaDoChamador: null })?.status).toBe(403)
  })

  it('bloqueia mover o usuário para outra empresa', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, empresaNova: EMPRESA_B })?.error)
      .toBe('Não é permitido mover o usuário para outra empresa')
  })

  it('deixa a empresa mãe mexer em qualquer empresa', () => {
    expect(validarAtualizacaoDeUsuario({
      ...admin, escopoGlobal: true, empresaDoChamador: EMPRESA_A, empresaDoAlvo: EMPRESA_B, empresaNova: EMPRESA_B,
    })).toBeNull()
  })

  it('só developer concede developer, mesmo na empresa mãe', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, escopoGlobal: true, papelNovo: 'developer' })?.status).toBe(403)
    expect(validarAtualizacaoDeUsuario({ ...admin, papeisDoChamador: ['developer'], papelNovo: 'developer' })).toBeNull()
  })

  it('senha nova com menos de 6 caracteres é recusada; vazia é ignorada', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, senhaNova: '12345' })?.status).toBe(400)
    expect(validarAtualizacaoDeUsuario({ ...admin, senhaNova: '   ' })).toBeNull()
    expect(validarAtualizacaoDeUsuario({ ...admin, senhaNova: '123456' })).toBeNull()
  })

  it('status só aceita active ou inactive', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, statusNovo: 'banido' })?.error).toBe('Status inválido')
  })

  it('impede inativar a própria conta', () => {
    expect(validarAtualizacaoDeUsuario({ ...admin, alvoId: 'admin', statusNovo: 'inactive' })?.error)
      .toBe('Você não pode inativar a própria conta')
    expect(validarAtualizacaoDeUsuario({ ...admin, alvoId: 'admin', statusNovo: 'active' })).toBeNull()
  })
})

describe('validarCriacaoDeUsuario', () => {
  const base = { papeisDoChamador: ['admin'], escopoGlobal: false, empresaDoChamador: EMPRESA_A, empresaNova: EMPRESA_A, papelNovo: 'technician' }

  it('libera criar na própria empresa', () => {
    expect(validarCriacaoDeUsuario(base)).toBeNull()
  })

  it('bloqueia criar em outra empresa, salvo a empresa mãe', () => {
    expect(validarCriacaoDeUsuario({ ...base, empresaNova: EMPRESA_B })?.status).toBe(403)
    expect(validarCriacaoDeUsuario({ ...base, empresaDoChamador: null })?.status).toBe(403)
    expect(validarCriacaoDeUsuario({ ...base, escopoGlobal: true, empresaNova: EMPRESA_B })).toBeNull()
  })

  it('só developer cria developer', () => {
    expect(validarCriacaoDeUsuario({ ...base, escopoGlobal: true, papelNovo: 'developer' })?.status).toBe(403)
    expect(validarCriacaoDeUsuario({ ...base, papeisDoChamador: ['developer'], papelNovo: 'developer' })).toBeNull()
  })
})

describe('validarNovaSenha', () => {
  it('exige 8 caracteres e sem espaço nas pontas', () => {
    expect(validarNovaSenha('1234567')).not.toBeNull()
    expect(validarNovaSenha(undefined)).not.toBeNull()
    expect(validarNovaSenha(' 12345678')).not.toBeNull()
    expect(validarNovaSenha('12345678 ')).not.toBeNull()
    expect(validarNovaSenha('senha forte 1')).toBeNull()
  })
})

describe('gerarSenhaProvisoria', () => {
  it('gera 16 caracteres do alfabeto, diferentes a cada chamada', () => {
    const a = gerarSenhaProvisoria()
    const b = gerarSenhaProvisoria()
    expect(a).toHaveLength(16)
    expect([...a].every((c) => ALFABETO_SENHA.includes(c))).toBe(true)
    expect(a).not.toBe(b)
  })
})
