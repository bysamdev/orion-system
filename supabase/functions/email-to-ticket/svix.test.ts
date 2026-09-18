import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { assinarComoOResend, TOLERANCIA_SEGUNDOS, verificarAssinaturaSvix } from './svix'

// Roda no `npm test` junto com o resto da suíte: o Vitest do projeto não
// restringe `include`, então pega este arquivo mesmo fora de src/. É o que põe
// a verificação de assinatura na CI sem precisar de job novo.
//
// O risco de testar assinatura é provar só que o código concorda consigo
// mesmo: assinar e verificar com a mesma implementação passa mesmo que as duas
// estejam erradas do mesmo jeito. Por isso a correção é conferida contra duas
// referências INDEPENDENTES do svix.ts:
//
//   1. o vetor de teste publicado na documentação do Svix;
//   2. o HMAC do node:crypto, uma implementação diferente da Web Crypto que o
//      svix.ts usa.
//
// Conferido também que a suíte fica vermelha: trocando só o separador "." por
// ":" no conteúdo assinado, quatro testes falham, incluindo o do vetor.

const VETOR = {
  segredo: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: '1614265330',
  corpo: '{"test": 2432232314}',
  assinatura: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
}

const AGORA = Number(VETOR.timestamp)

function verificar(sobrescreve: Partial<typeof VETOR & { agora: number; assinatura: string | null; id: string | null }> = {}) {
  const e = { ...VETOR, agora: AGORA, ...sobrescreve }
  return verificarAssinaturaSvix(e.segredo, e.id, e.timestamp, e.assinatura, e.corpo, e.agora)
}

describe('verificarAssinaturaSvix — correção', () => {
  it('aceita o vetor de teste publicado pelo Svix', async () => {
    expect(await verificar()).toEqual({ valida: true })
  })

  it('node:crypto chega à mesma assinatura do vetor, de forma independente', () => {
    const chave = Buffer.from(VETOR.segredo.slice('whsec_'.length), 'base64')
    const porNodeCrypto = 'v1,' + createHmac('sha256', chave)
      .update(`${VETOR.id}.${VETOR.timestamp}.${VETOR.corpo}`)
      .digest('base64')

    expect(porNodeCrypto).toBe(VETOR.assinatura)
  })

  it('assina exatamente como o node:crypto', async () => {
    const chave = Buffer.from(VETOR.segredo.slice('whsec_'.length), 'base64')
    const porNodeCrypto = 'v1,' + createHmac('sha256', chave)
      .update(`${VETOR.id}.${VETOR.timestamp}.${VETOR.corpo}`)
      .digest('base64')

    expect(await assinarComoOResend(VETOR.segredo, VETOR.id, VETOR.timestamp, VETOR.corpo)).toBe(porNodeCrypto)
  })
})

describe('verificarAssinaturaSvix — recusas', () => {
  // O ataque principal: alguém intercepta uma entrega legítima e troca o
  // conteúdo, mantendo a assinatura original.
  it('recusa corpo alterado em um único caractere', async () => {
    expect(await verificar({ corpo: '{"test": 2432232315}' }))
      .toEqual({ valida: false, motivo: 'assinatura_nao_confere' })
  })

  it('recusa id trocado', async () => {
    expect(await verificar({ id: 'msg_outro' }))
      .toEqual({ valida: false, motivo: 'assinatura_nao_confere' })
  })

  it('recusa segredo errado', async () => {
    const outro = 'whsec_' + Buffer.from('outro-segredo-qualquer').toString('base64')
    expect(await verificar({ segredo: outro }))
      .toEqual({ valida: false, motivo: 'assinatura_nao_confere' })
  })

  // Reenvio: a entrega é legítima e intacta, mas chega depois da janela.
  it('recusa entrega antiga mesmo com assinatura válida', async () => {
    expect(await verificar({ agora: AGORA + TOLERANCIA_SEGUNDOS + 1 }))
      .toEqual({ valida: false, motivo: 'fora_da_janela' })
  })

  it('aceita entrega exatamente no limite da janela', async () => {
    expect(await verificar({ agora: AGORA + TOLERANCIA_SEGUNDOS })).toEqual({ valida: true })
  })

  it('recusa carimbo no futuro além da janela', async () => {
    expect(await verificar({ agora: AGORA - TOLERANCIA_SEGUNDOS - 1 }))
      .toEqual({ valida: false, motivo: 'fora_da_janela' })
  })

  it('recusa quando falta svix-signature', async () => {
    expect(await verificar({ assinatura: null }))
      .toEqual({ valida: false, motivo: 'cabecalho_ausente' })
  })

  it('recusa quando falta svix-id', async () => {
    expect(await verificar({ id: null }))
      .toEqual({ valida: false, motivo: 'cabecalho_ausente' })
  })

  it('recusa segredo sem o prefixo whsec_', async () => {
    expect(await verificar({ segredo: VETOR.segredo.slice('whsec_'.length) }))
      .toEqual({ valida: false, motivo: 'segredo_invalido' })
  })

  // Rotação de segredo: o Resend manda a assinatura do segredo novo e do velho
  // juntas. Basta uma bater.
  it('aceita quando uma de várias assinaturas bate (rotação de segredo)', async () => {
    const lixo = `v1,${Buffer.alloc(32).toString('base64')}`
    expect(await verificar({ assinatura: `${lixo} ${VETOR.assinatura}` })).toEqual({ valida: true })
  })

  // Versão desconhecida não pode ser tratada como v1.
  it('ignora assinatura certa com versão desconhecida', async () => {
    expect(await verificar({ assinatura: VETOR.assinatura.replace('v1,', 'v2,') }))
      .toEqual({ valida: false, motivo: 'assinatura_nao_confere' })
  })

  it('não quebra com base64 inválido na assinatura', async () => {
    expect(await verificar({ assinatura: 'v1,@@@nao-e-base64@@@' }))
      .toEqual({ valida: false, motivo: 'assinatura_nao_confere' })
  })
})
