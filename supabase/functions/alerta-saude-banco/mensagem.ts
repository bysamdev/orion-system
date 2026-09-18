// Monta o e-mail de alerta de saúde do banco. Módulo puro, sem Deno.*, para ser
// testado pelo Vitest junto com o resto da suíte.
//
// Quem decide QUANDO alertar é o banco (public.verificar_saude_do_banco, rodando
// pelo pg_cron). Esta parte só transforma a decisão em uma mensagem que alguém
// consiga entender às três da manhã, sem abrir painel nenhum.

export type TipoDeAlerta = 'inicio' | 'persiste' | 'normalizado'

export interface DadosDoAlerta {
  tipo: TipoDeAlerta
  /** Rollbacks por segundo medidos na última janela. */
  taxa_por_segundo: number
  /** Duração da janela medida, em segundos. */
  janela_segundos: number
  /** Quando a anomalia começou a ser observada (ISO 8601). */
  desde: string | null
}

export interface Mensagem {
  assunto: string
  html: string
}

// Referência de "normal", medida em 18/09/2026 depois da correção do incidente:
// 210 rollbacks em 36 minutos. Serve para dar escala ao número no e-mail — um
// "12 por segundo" sozinho não diz se é pouco ou muito.
const TAXA_NORMAL_DE_REFERENCIA = 0.1

export function ehTipoValido(tipo: unknown): tipo is TipoDeAlerta {
  return tipo === 'inicio' || tipo === 'persiste' || tipo === 'normalizado'
}

function formatarTaxa(taxa: number): string {
  return taxa.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function formatarDuracao(desdeIso: string | null, agora: Date): string | null {
  if (!desdeIso) return null
  const desde = new Date(desdeIso)
  if (Number.isNaN(desde.getTime())) return null

  const minutos = Math.max(0, Math.round((agora.getTime() - desde.getTime()) / 60000))
  if (minutos < 60) return `${minutos} minuto${minutos === 1 ? '' : 's'}`

  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  const textoHoras = `${horas} hora${horas === 1 ? '' : 's'}`
  return resto ? `${textoHoras} e ${resto} min` : textoHoras
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// O que olhar primeiro, na ordem em que resolveu o incidente de 18/09. Fica no
// próprio e-mail porque quem recebe o alerta não vai lembrar o caminho.
const COMO_INVESTIGAR = `
  <ol style="margin:8px 0 0 18px;padding:0;line-height:1.6">
    <li>Nos logs do Postgres, agrupe os erros por mensagem e veja qual domina.</li>
    <li>Veja se os erros se concentram em uma ou duas conexões antigas, pelo
        <code>process_id</code> e pelo início da sessão. Se sim, é uma requisição
        presa sendo repetida pelo servidor, e não tráfego de verdade.</li>
    <li>Confira se alguma função levanta erro com código da classe
        <code>40</code> (<code>40001</code>, <code>40P01</code>) para uma falha que
        não é transitória. Esse foi o incidente de 18/09: o PostgREST repete essas
        transações sozinho, para sempre.</li>
  </ol>`

export function montarMensagem(dados: DadosDoAlerta, agora: Date = new Date()): Mensagem {
  const taxa = formatarTaxa(dados.taxa_por_segundo)
  const vezes = dados.taxa_por_segundo / TAXA_NORMAL_DE_REFERENCIA
  const escala = vezes >= 2
    ? ` — cerca de ${Math.round(vezes).toLocaleString('pt-BR')} vezes o normal`
    : ''
  const duracao = formatarDuracao(dados.desde, agora)

  if (dados.tipo === 'normalizado') {
    return {
      assunto: '[Orion] Banco normalizado',
      html: `
        <p>A taxa de erros do banco do Orion voltou ao normal.</p>
        <p>Taxa atual: <strong>${escapar(taxa)} rollbacks por segundo</strong>.</p>
        ${duracao ? `<p>A anomalia durou cerca de <strong>${escapar(duracao)}</strong>.</p>` : ''}
        <p style="color:#666">Mesmo resolvido, vale entender a causa para não voltar.</p>`,
    }
  }

  const persistindo = dados.tipo === 'persiste'

  return {
    assunto: persistindo
      ? `[Orion] Banco continua com erros em excesso${duracao ? ` há ${duracao}` : ''}`
      : '[Orion] Banco com erros em excesso',
    html: `
      <p>${persistindo
        ? 'A taxa anormal de erros no banco do Orion <strong>continua</strong>.'
        : 'O banco do Orion está com uma <strong>taxa anormal de erros</strong>.'}</p>
      <p>Taxa medida: <strong>${escapar(taxa)} rollbacks por segundo</strong>${escapar(escala)}.
         O normal fica em torno de ${formatarTaxa(TAXA_NORMAL_DE_REFERENCIA)} por segundo.</p>
      ${duracao ? `<p>Observado há <strong>${escapar(duracao)}</strong>.</p>` : ''}
      <p><strong>Como investigar:</strong></p>
      ${COMO_INVESTIGAR}
      <p style="color:#666">Enquanto durar, este aviso se repete de hora em hora. Quando
         normalizar, chega um e-mail avisando.</p>`,
  }
}
