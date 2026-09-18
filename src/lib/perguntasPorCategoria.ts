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

export type TipoDePergunta = 'curta' | 'longa' | 'opcoes';

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
  outros: [
    { id: 'solicitacao', rotulo: 'O que você precisa?', tipo: 'longa', obrigatoria: true },
    { id: 'para_quem', rotulo: 'Para quem é a solicitação?', tipo: 'curta', obrigatoria: false, placeholder: 'Ex.: novo colaborador, nome e setor' },
    { id: 'prazo', rotulo: 'Até quando você precisa? Justifique o prazo.', tipo: 'longa', obrigatoria: false },
  ],
};

export type Respostas = Record<string, string>;

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
    const valor = (respostas[p.id] ?? '').trim();
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
      const bruto = (respostas[p.id] ?? '').trim();
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
