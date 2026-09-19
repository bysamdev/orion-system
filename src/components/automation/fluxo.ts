import {
  AlertTriangle, ArrowRightLeft, Bell, Crown, MessageSquare, RefreshCw, Zap,
} from 'lucide-react';
import type { ElementType } from 'react';
import { ACTION_TYPES, CONDITION_FIELDS, OPERADORES, type Acao, type Condicao } from '@/hooks/useAutomation';
import { CATEGORIAS } from '@/lib/categoriasDeChamado';

// Texto e ícone de cada peça do fluxo, iguais no editor, na lista de regras e
// no histórico.

export const ICONE_DA_ACAO: Record<string, ElementType> = {
  assign_tech: ArrowRightLeft,
  assign_to_user: ArrowRightLeft,
  round_robin: RefreshCw,
  escalate_manager: AlertTriangle,
  set_priority: Crown,
  auto_response: MessageSquare,
  notify_all: Bell,
};

export const iconeDaAcao = (tipo: string): ElementType => ICONE_DA_ACAO[tipo] ?? Zap;

export const PRIORIDADES = [
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

const rotuloDaPrioridade = (v: string) => PRIORIDADES.find(p => p.value === v)?.label ?? v;

export interface Nomes {
  empresas: Map<string, string>;
  pessoas: Map<string, string>;
  templates: Map<string, string>;
}

export function descreverCondicao(c: Condicao, nomes: Nomes) {
  const campo = CONDITION_FIELDS.find(f => f.value === c.field)?.label ?? c.field;
  const operador = OPERADORES.find(o => o.value === c.operator)?.label ?? c.operator;
  let valor = c.value;
  if (c.field === 'category') valor = CATEGORIAS[c.value]?.rotulo ?? c.value;
  if (c.field === 'priority') valor = rotuloDaPrioridade(c.value);
  if (c.field === 'company_id') valor = nomes.empresas.get(c.value) ?? 'empresa removida';
  return { campo, operador, valor };
}

export function descreverAcao(a: Acao, nomes: Nomes) {
  const rotulo = ACTION_TYPES.find(t => t.value === a.type)?.label
    ?? (a.type === 'assign_to_user' ? 'Atribuir a um técnico' : a.type);
  let alvo = '';
  const precisaAlvo = ACTION_TYPES.find(t => t.value === a.type)?.precisaAlvo ?? a.type === 'assign_to_user';
  if (precisaAlvo && !a.target) {
    alvo = 'a definir';
  } else if (['assign_tech', 'assign_to_user', 'escalate_manager'].includes(a.type)) {
    alvo = nomes.pessoas.get(a.target) ?? 'pessoa removida';
  } else if (a.type === 'set_priority') {
    alvo = rotuloDaPrioridade(a.target);
  } else if (a.type === 'auto_response') {
    alvo = nomes.templates.get(a.target) ?? 'template removido';
  }
  return { rotulo, alvo };
}

// Regra pronta para salvar: condições e ações completas. Devolve o primeiro
// problema encontrado, em português, ou null.
export function problemaNaRegra(nome: string, empresa: string, condicoes: Condicao[], acoes: Acao[]): string | null {
  if (!nome.trim()) return 'Dê um nome para a regra.';
  if (!empresa) return 'Escolha a empresa em que a regra vale.';
  if (condicoes.length === 0) return 'Adicione pelo menos uma condição.';
  if (condicoes.some(c => !c.value.trim())) return 'Preencha o valor de todas as condições.';
  if (acoes.length === 0) return 'Adicione pelo menos uma ação.';
  const semAlvo = acoes.find(a => ACTION_TYPES.find(t => t.value === a.type)?.precisaAlvo && !a.target);
  if (semAlvo) return `Complete a ação "${ACTION_TYPES.find(t => t.value === semAlvo.type)?.label}".`;
  return null;
}
