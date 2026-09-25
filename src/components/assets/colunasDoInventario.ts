import { format } from 'date-fns';

// Colunas do relatório do inventário, iguais na tela, no PDF e no Excel.

export interface LinhaDoInventario {
  id: string;
  cliente: string;
  maquina: string;
  tipo: string;
  os: string | null;
  osVersion: string | null;
  sistema: string;
  usuario: string;
  ip: string;
  processador: string;
  memoriaGb: number | null;
  discoGb: number | null;
  antivirus: string;
  versaoAgente: string;
  situacao: 'Online' | 'Offline';
  ultimoContato: string | null;
  mac: string;
  dominio: string;
  criadoEm: string | null;
}

export const COLUNAS: { chave: keyof LinhaDoInventario; titulo: string; valor?: (l: LinhaDoInventario) => string }[] = [
  { chave: 'cliente', titulo: 'Cliente' },
  { chave: 'maquina', titulo: 'Máquina' },
  { chave: 'tipo', titulo: 'Tipo' },
  { chave: 'sistema', titulo: 'Sistema' },
  { chave: 'usuario', titulo: 'Usuário' },
  { chave: 'ip', titulo: 'IP' },
  { chave: 'processador', titulo: 'Processador' },
  { chave: 'memoriaGb', titulo: 'Memória (GB)', valor: l => (l.memoriaGb ?? '—').toString() },
  { chave: 'discoGb', titulo: 'Disco (GB)', valor: l => (l.discoGb ?? '—').toString() },
  { chave: 'antivirus', titulo: 'Antivírus' },
  { chave: 'versaoAgente', titulo: 'Versão do agente' },
  { chave: 'situacao', titulo: 'Situação' },
  { chave: 'ultimoContato', titulo: 'Último contato', valor: l => (l.ultimoContato ? format(new Date(l.ultimoContato), 'dd/MM/yyyy HH:mm') : '—') },
];

export const texto = (l: LinhaDoInventario, c: (typeof COLUNAS)[number]) => (c.valor ? c.valor(l) : String(l[c.chave] ?? '—'));
