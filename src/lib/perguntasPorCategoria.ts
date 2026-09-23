/**
 * Perguntas do formulário de abertura, por categoria.
 *
 * Espelha o formulário do Octadesk usado com a Senior: em vez de um campo de
 * descrição livre, cada categoria pergunta exatamente o que o técnico
 * precisaria perguntar de volta — qual programa, qual mensagem apareceu,
 * afeta só você ou mais gente. Cada ida e volta evitada é um ciclo de
 * atendimento a menos.
 *
 * As respostas viram a descrição do chamado (montarDescricao), que é o que
 * todas as telas já exibem, e ficam também estruturadas em
 * metadata.formulario para relatório futuro.
 *
 * Mudar texto de pergunta aqui não quebra chamado antigo: a descrição já foi
 * gravada com o texto da época.
 */

// opcoes: escolhe uma. multipla: marca quantas quiser (ex.: criar acesso no
// Windows e no Senior no mesmo chamado).
export type TipoDePergunta = 'curta' | 'longa' | 'opcoes' | 'multipla';

export interface Pergunta {
  id: string;
  rotulo: string;
  tipo: TipoDePergunta;
  obrigatoria: boolean;
  opcoes?: readonly string[];
  placeholder?: string;
}

const SIM_NAO = ['Sim', 'Não'] as const;

/** Limite por resposta, para a descrição somada caber nos 5000 do schema. */
export const MAX_RESPOSTA = 1500;
const MAX_DESCRICAO = 5000;

export const PERGUNTAS_POR_CATEGORIA: Record<string, readonly Pergunta[]> = {
  erp: [
    { id: 'objetivo', rotulo: 'O que você precisa realizar?', tipo: 'longa', obrigatoria: true },
    { id: 'erro', rotulo: 'Qual mensagem aparece ou o que está errado neste processo?', tipo: 'longa', obrigatoria: true, placeholder: 'Copie o texto da mensagem, se houver' },
    { id: 'empresa_filial', rotulo: 'Em qual empresa e filial a situação acontece?', tipo: 'curta', obrigatoria: true },
    { id: 'modulo', rotulo: 'Em qual módulo ou tela do sistema?', tipo: 'curta', obrigatoria: true, placeholder: 'Ex.: Sapiens > Faturamento > Notas fiscais' },
    { id: 'urgencia', rotulo: 'Quando você precisa concluir esta operação? Justifique o prazo.', tipo: 'longa', obrigatoria: true },
    { id: 'outros_usuarios', rotulo: 'Acontece com outros usuários também?', tipo: 'opcoes', obrigatoria: false, opcoes: ['Sim', 'Não', 'Não sei'] },
    { id: 'passos', rotulo: 'Quais os passos para reproduzir a situação?', tipo: 'longa', obrigatoria: false },
  ],
  email: [
    { id: 'problema', rotulo: 'O que está acontecendo com o e-mail?', tipo: 'longa', obrigatoria: true },
    { id: 'endereco', rotulo: 'Qual endereço de e-mail está com o problema?', tipo: 'curta', obrigatoria: true },
    { id: 'onde', rotulo: 'Onde você usa esse e-mail?', tipo: 'opcoes', obrigatoria: true, opcoes: ['Outlook no computador', 'Navegador (webmail)', 'Celular'] },
    { id: 'erro', rotulo: 'Aparece alguma mensagem de erro? Qual?', tipo: 'longa', obrigatoria: false },
    { id: 'abrangencia', rotulo: 'Acontece com todas as mensagens ou só com algum destinatário?', tipo: 'curta', obrigatoria: false },
  ],
  hardware: [
    { id: 'problema', rotulo: 'O que está acontecendo com o equipamento?', tipo: 'longa', obrigatoria: true },
    { id: 'equipamento', rotulo: 'Qual é o equipamento?', tipo: 'opcoes', obrigatoria: true, opcoes: ['Computador', 'Notebook', 'Impressora', 'Monitor', 'Outro'] },
    { id: 'desde_quando', rotulo: 'Desde quando o problema acontece?', tipo: 'curta', obrigatoria: true },
    { id: 'liga', rotulo: 'O equipamento liga normalmente?', tipo: 'opcoes', obrigatoria: true, opcoes: SIM_NAO },
    { id: 'reiniciou', rotulo: 'Você já tentou reiniciar?', tipo: 'opcoes', obrigatoria: true, opcoes: SIM_NAO },
    { id: 'patrimonio', rotulo: 'Número de patrimônio ou etiqueta do equipamento', tipo: 'curta', obrigatoria: false },
  ],
  software: [
    { id: 'problema', rotulo: 'O que você precisa ou o que está acontecendo?', tipo: 'longa', obrigatoria: true },
    { id: 'programa', rotulo: 'Qual programa?', tipo: 'curta', obrigatoria: true, placeholder: 'Ex.: Excel, Adobe Acrobat, Chrome' },
    { id: 'instalacao', rotulo: 'É a instalação de um programa novo?', tipo: 'opcoes', obrigatoria: true, opcoes: SIM_NAO },
    { id: 'reiniciou', rotulo: 'Já tentou fechar o programa ou reiniciar o computador?', tipo: 'opcoes', obrigatoria: true, opcoes: SIM_NAO },
    { id: 'erro', rotulo: 'Aparece alguma mensagem de erro? Qual?', tipo: 'longa', obrigatoria: false },
  ],
  rede: [
    { id: 'problema', rotulo: 'O que está acontecendo?', tipo: 'longa', obrigatoria: true },
    { id: 'sem_acesso', rotulo: 'O que está sem acesso?', tipo: 'opcoes', obrigatoria: true, opcoes: ['Internet', 'Pasta na rede', 'Impressora', 'Sistema ou site específico'] },
    { id: 'abrangencia', rotulo: 'Afeta só você ou outras pessoas também?', tipo: 'opcoes', obrigatoria: true, opcoes: ['Só eu', 'Outras pessoas também', 'Não sei'] },
    { id: 'conexao', rotulo: 'Como você está conectado?', tipo: 'opcoes', obrigatoria: false, opcoes: ['Cabo', 'Wi-Fi', 'VPN', 'Não sei'] },
    { id: 'endereco', rotulo: 'Qual pasta, impressora ou site?', tipo: 'curta', obrigatoria: false },
  ],
  criacao_usuario: [
    { id: 'sistemas', rotulo: 'Em quais sistemas o acesso precisa ser criado?', tipo: 'multipla', obrigatoria: true, opcoes: ['Windows / rede', 'Senior', 'E-mail', 'VPN', 'Outro'] },
    { id: 'nome', rotulo: 'Nome completo da pessoa', tipo: 'curta', obrigatoria: true },
    { id: 'setor_cargo', rotulo: 'Setor e cargo', tipo: 'curta', obrigatoria: true },
    { id: 'a_partir_de', rotulo: 'A partir de quando o acesso precisa estar pronto?', tipo: 'curta', obrigatoria: true, placeholder: 'Ex.: segunda-feira, 22/09' },
    { id: 'copiar_de', rotulo: 'Copiar as permissões de qual usuário?', tipo: 'curta', obrigatoria: false, placeholder: 'Alguém do mesmo setor que já tenha os acessos certos' },
    { id: 'outro_sistema', rotulo: 'Se marcou "Outro", qual sistema?', tipo: 'curta', obrigatoria: false },
  ],
  impressora: [
    { id: 'problema', rotulo: 'O que está acontecendo com a impressora?', tipo: 'longa', obrigatoria: true },
    { id: 'qual', rotulo: 'Qual impressora ou em que local ela fica?', tipo: 'curta', obrigatoria: true, placeholder: 'Ex.: impressora do financeiro, 2º andar' },
    { id: 'abrangencia', rotulo: 'Afeta só você ou outras pessoas também?', tipo: 'opcoes', obrigatoria: true, opcoes: ['Só eu', 'Outras pessoas também', 'Não sei'] },
    { id: 'religou', rotulo: 'Já desligou e religou a impressora?', tipo: 'opcoes', obrigatoria: true, opcoes: SIM_NAO },
    { id: 'mensagem', rotulo: 'Aparece alguma mensagem no visor ou no computador? Qual?', tipo: 'longa', obrigatoria: false },
  ],
  outros: [
    { id: 'solicitacao', rotulo: 'O que você precisa?', tipo: 'longa', obrigatoria: true },
    { id: 'para_quem', rotulo: 'Para quem é a solicitação?', tipo: 'curta', obrigatoria: false, placeholder: 'Ex.: novo colaborador, nome e setor' },
    { id: 'prazo', rotulo: 'Até quando você precisa? Justifique o prazo.', tipo: 'longa', obrigatoria: false },
  ],
};

/** Texto, opção escolhida, ou lista de opções marcadas (tipo 'multipla'). */
export type Respostas = Record<string, string | string[]>;

function comoLista(valor: string | string[] | undefined): string[] {
  if (Array.isArray(valor)) return valor;
  return valor ? [valor] : [];
}

export function perguntasDa(categoria: string): readonly Pergunta[] {
  return PERGUNTAS_POR_CATEGORIA[categoria] ?? [];
}

/**
 * Devolve, por id de pergunta, a mensagem de erro de cada resposta inválida.
 * Objeto vazio quando está tudo certo.
 */
export function validarRespostas(categoria: string, respostas: Respostas): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const p of perguntasDa(categoria)) {
    if (p.tipo === 'multipla') {
      const marcadas = comoLista(respostas[p.id]);
      if (p.obrigatoria && marcadas.length === 0) {
        erros[p.id] = 'Marque ao menos uma opção.';
      } else if (marcadas.some((m) => !p.opcoes?.includes(m))) {
        erros[p.id] = 'Escolha entre as opções.';
      }
      continue;
    }
    const bruto = respostas[p.id];
    const valor = (Array.isArray(bruto) ? bruto.join(', ') : bruto ?? '').trim();
    if (p.obrigatoria && !valor) {
      erros[p.id] = p.tipo === 'opcoes' ? 'Escolha uma opção.' : 'Responda esta pergunta.';
    } else if (valor.length > MAX_RESPOSTA) {
      erros[p.id] = `Use no máximo ${MAX_RESPOSTA} caracteres.`;
    } else if (p.tipo === 'opcoes' && valor && !p.opcoes?.includes(valor)) {
      erros[p.id] = 'Escolha uma das opções.';
    }
  }
  return erros;
}

// type, e não interface: só type alias é atribuível ao Json do Supabase,
// que exige index signature (vai gravado em tickets.metadata).
export type RespostaGravada = {
  pergunta: string;
  resposta: string;
};

/** Só as perguntas respondidas, na ordem do formulário. */
export function respostasPreenchidas(
  categoria: string,
  respostas: Respostas,
  normalizar: (texto: string) => string = (t) => t,
): RespostaGravada[] {
  return perguntasDa(categoria)
    .map((p) => {
      if (p.tipo === 'multipla') {
        // Na ordem das opções, e não na ordem em que foram clicadas.
        const marcadas = comoLista(respostas[p.id]);
        const resposta = (p.opcoes ?? []).filter((o) => marcadas.includes(o)).join(', ');
        return { pergunta: p.rotulo, resposta };
      }
      const valor = respostas[p.id];
      const bruto = (Array.isArray(valor) ? valor.join(', ') : valor ?? '').trim();
      // Opção escolhida é texto nosso: não passa pela normalização do cliente.
      const resposta = p.tipo === 'opcoes' ? bruto : normalizar(bruto);
      return { pergunta: p.rotulo, resposta };
    })
    .filter((r) => r.resposta);
}

/**
 * Descrição do chamado: cada pergunta seguida da resposta, separadas por
 * linha em branco. A tela de detalhe exibe com whitespace-pre-wrap, então a
 * estrutura aparece sem precisar de markdown.
 */
export function montarDescricao(preenchidas: RespostaGravada[], complemento = ''): string {
  const blocos = preenchidas.map((r) => `${r.pergunta}\n${r.resposta}`);
  const extra = complemento.trim();
  if (extra) blocos.push(`Informações adicionais\n${extra}`);
  return blocos.join('\n\n').slice(0, MAX_DESCRICAO);
}

/**
 * Respostas do formulário gravadas no chamado (metadata.formulario), mais o
 * bloco "Informações adicionais" que só existe na descrição. Devolve lista
 * vazia para chamado aberto antes do formulário ou sem respostas, e aí a tela
 * mostra a descrição como sempre.
 */
export function respostasDoChamado(metadata: unknown, descricao: string | null | undefined): RespostaGravada[] {
  const formulario = (metadata as { formulario?: { respostas?: unknown } } | null)?.formulario;
  const brutas = Array.isArray(formulario?.respostas) ? formulario.respostas : [];
  const respostas = brutas
    .filter((r): r is RespostaGravada =>
      !!r && typeof r === 'object'
      && typeof (r as RespostaGravada).pergunta === 'string'
      && typeof (r as RespostaGravada).resposta === 'string'
      && (r as RespostaGravada).resposta.trim() !== '')
    .map((r) => ({ pergunta: r.pergunta, resposta: r.resposta }));
  if (respostas.length === 0) return [];

  const adicional = (descricao ?? '')
    .split('\n\n')
    .find((bloco) => bloco.startsWith('Informações adicionais\n'));
  if (adicional) {
    const texto = adicional.slice('Informações adicionais\n'.length).trim();
    if (texto) respostas.push({ pergunta: 'Informações adicionais', resposta: texto });
  }
  return respostas;
}
