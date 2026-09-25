import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Relatório analítico do inventário: uma linha por máquina, com hardware e
// segurança, filtro por cliente e exportação para CSV e Excel.

type Disco = { total?: number; used?: number };
type Seguranca = {
  antivirus?: { name?: string; active?: boolean }[];
  firewall_active?: boolean;
  bitlocker_active?: boolean;
};

interface LinhaDoInventario {
  id: string;
  cliente: string;
  maquina: string;
  tipo: string;
  sistema: string;
  usuario: string;
  ip: string;
  processador: string;
  memoriaGb: number | null;
  discoGb: number | null;
  discoUsoPct: number | null;
  antivirus: string;
  firewall: string;
  bitlocker: string;
  versaoAgente: string;
  situacao: 'Online' | 'Offline';
  ultimoContato: string | null;
  diasSemContato: number | null;
}

const GB = 1024 ** 3;
const TIPOS: Record<string, string> = { desktop: 'Computador', notebook: 'Notebook', server: 'Servidor' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- linha do PostgREST com joins aninhados
function montarLinha(m: Record<string, any>): LinhaDoInventario {
  const hw = (Array.isArray(m.machine_hardware) ? m.machine_hardware[0] : m.machine_hardware) ?? {};
  const discos: Disco[] = Array.isArray(hw.disks) ? hw.disks : [];
  const total = discos.reduce((s, d) => s + (d.total ?? 0), 0);
  const usado = discos.reduce((s, d) => s + (d.used ?? 0), 0);
  const seg: Seguranca = hw.security_info ?? {};
  const av = (seg.antivirus ?? []).filter(a => a.active).map(a => a.name).filter(Boolean).join(', ');
  const ultimo = m.last_seen as string | null;
  return {
    id: m.id,
    cliente: m.companies?.name ?? '—',
    maquina: m.hostname,
    tipo: TIPOS[m.device_type] ?? 'Não identificado',
    sistema: [m.os, m.os_version].filter(Boolean).join(' ') || '—',
    usuario: m.logged_in_user ?? m.current_user ?? '—',
    ip: m.local_ip ?? m.ip_address ?? '—',
    processador: hw.cpu_model || '—',
    memoriaGb: m.ram_total ? Math.round((m.ram_total / GB) * 10) / 10 : null,
    discoGb: total ? Math.round(total / GB) : null,
    discoUsoPct: total ? Math.round((usado / total) * 100) : null,
    antivirus: seg.antivirus ? av || 'Nenhum ativo' : '—',
    firewall: seg.firewall_active === undefined ? '—' : seg.firewall_active ? 'Ativo' : 'Desligado',
    bitlocker: seg.bitlocker_active === undefined ? '—' : seg.bitlocker_active ? 'Ativo' : 'Desligado',
    versaoAgente: m.agent_version ?? '—',
    situacao: m.status === 'online' ? 'Online' : 'Offline',
    ultimoContato: ultimo,
    diasSemContato: ultimo ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 86_400_000) : null,
  };
}

const COLUNAS: { chave: keyof LinhaDoInventario; titulo: string; valor?: (l: LinhaDoInventario) => string }[] = [
  { chave: 'cliente', titulo: 'Cliente' },
  { chave: 'maquina', titulo: 'Máquina' },
  { chave: 'tipo', titulo: 'Tipo' },
  { chave: 'sistema', titulo: 'Sistema operacional' },
  { chave: 'usuario', titulo: 'Usuário' },
  { chave: 'ip', titulo: 'IP' },
  { chave: 'processador', titulo: 'Processador' },
  { chave: 'memoriaGb', titulo: 'Memória (GB)', valor: l => (l.memoriaGb ?? '—').toString() },
  { chave: 'discoGb', titulo: 'Disco (GB)', valor: l => (l.discoGb ?? '—').toString() },
  { chave: 'discoUsoPct', titulo: 'Disco em uso', valor: l => (l.discoUsoPct === null ? '—' : `${l.discoUsoPct}%`) },
  { chave: 'antivirus', titulo: 'Antivírus' },
  { chave: 'firewall', titulo: 'Firewall' },
  { chave: 'bitlocker', titulo: 'BitLocker' },
  { chave: 'versaoAgente', titulo: 'Versão do agente' },
  { chave: 'situacao', titulo: 'Situação' },
  { chave: 'ultimoContato', titulo: 'Último contato', valor: l => (l.ultimoContato ? format(new Date(l.ultimoContato), 'dd/MM/yyyy HH:mm') : '—') },
];

const texto = (l: LinhaDoInventario, c: (typeof COLUNAS)[number]) => (c.valor ? c.valor(l) : String(l[c.chave] ?? '—'));

function baixar(conteudo: string, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarCsv(linhas: LinhaDoInventario[], nome: string) {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const corpo = [COLUNAS.map(c => c.titulo), ...linhas.map(l => COLUNAS.map(c => texto(l, c)))]
    .map(r => r.map(esc).join(';'))
    .join('\r\n');
  // BOM para o Excel abrir acentos corretamente; ";" é o separador do Excel em pt-BR.
  baixar('﻿' + corpo, `${nome}.csv`, 'text/csv;charset=utf-8');
}

function exportarExcel(linhas: LinhaDoInventario[], nome: string) {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const numericas = new Set<keyof LinhaDoInventario>(['memoriaGb', 'discoGb']);
  const celula = (l: LinhaDoInventario, c: (typeof COLUNAS)[number]) => {
    const v = l[c.chave];
    return numericas.has(c.chave) && typeof v === 'number'
      ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${esc(texto(l, c))}</Data></Cell>`;
  };
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="Inventário"><Table>
<Row>${COLUNAS.map(c => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(c.titulo)}</Data></Cell>`).join('')}</Row>
${linhas.map(l => `<Row>${COLUNAS.map(c => celula(l, c)).join('')}</Row>`).join('\n')}
</Table></Worksheet></Workbook>`;
  baixar(xml, `${nome}.xls`, 'application/vnd.ms-excel');
}

export const RelatorioDeInventario: React.FC = () => {
  const [cliente, setCliente] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [situacao, setSituacao] = useState('todas');
  const [busca, setBusca] = useState('');

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ['inventario', 'relatorio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('id, hostname, os, os_version, device_type, logged_in_user, current_user, local_ip, ip_address, ram_total, agent_version, status, last_seen, companies(name), machine_hardware(cpu_model, disks, security_info)')
        .eq('approval_status', 'approved')
        .order('hostname');
      if (error) throw error;
      return (data ?? []).map(m => montarLinha(m as Parameters<typeof montarLinha>[0]));
    },
    staleTime: 60_000,
  });

  const clientes = useMemo(() => [...new Set(linhas.map(l => l.cliente))].sort(), [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter(l =>
      (cliente === 'todos' || l.cliente === cliente) &&
      (tipo === 'todos' || l.tipo === tipo) &&
      (situacao === 'todas' || l.situacao === situacao) &&
      (!q || [l.maquina, l.usuario, l.ip, l.processador].some(v => v.toLowerCase().includes(q)))
    );
  }, [linhas, cliente, tipo, situacao, busca]);

  const resumo = useMemo(() => ({
    total: filtradas.length,
    online: filtradas.filter(l => l.situacao === 'Online').length,
    semContato7d: filtradas.filter(l => (l.diasSemContato ?? 0) >= 7).length,
    discoCheio: filtradas.filter(l => (l.discoUsoPct ?? 0) >= 90).length,
    semAntivirus: filtradas.filter(l => l.antivirus === 'Nenhum ativo').length,
    semBitlocker: filtradas.filter(l => l.bitlocker === 'Desligado').length,
  }), [filtradas]);

  const nomeDoArquivo = `inventario_${cliente === 'todos' ? 'todos-os-clientes' : cliente.replace(/\W+/g, '-')}_${format(new Date(), 'yyyy-MM-dd')}`;

  const indicadores: { rotulo: string; valor: number; alerta?: boolean }[] = [
    { rotulo: 'Máquinas', valor: resumo.total },
    { rotulo: 'Online agora', valor: resumo.online },
    { rotulo: 'Sem contato há 7+ dias', valor: resumo.semContato7d, alerta: true },
    { rotulo: 'Disco acima de 90%', valor: resumo.discoCheio, alerta: true },
    { rotulo: 'Sem antivírus ativo', valor: resumo.semAntivirus, alerta: true },
    { rotulo: 'BitLocker desligado', valor: resumo.semBitlocker, alerta: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={cliente} onValueChange={setCliente}>
          <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clientes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {['Computador', 'Notebook', 'Servidor', 'Não identificado'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Online e offline</SelectItem>
            <SelectItem value="Online">Online</SelectItem>
            <SelectItem value="Offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Máquina, usuário, IP ou processador" className="h-9 pl-8" />
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={!filtradas.length} onClick={() => exportarCsv(filtradas, nomeDoArquivo)}>
          <Download className="w-4 h-4" /> CSV
        </Button>
        <Button size="sm" className="h-9 gap-1.5" disabled={!filtradas.length} onClick={() => exportarExcel(filtradas, nomeDoArquivo)}>
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {indicadores.map(i => (
          <Card key={i.rotulo} className="p-3 border-border/50">
            <p className="text-xs text-muted-foreground">{i.rotulo}</p>
            <p className={cn('text-2xl font-bold mt-1', i.alerta && i.valor > 0 && 'text-amber-600 dark:text-amber-400')}>{i.valor}</p>
          </Card>
        ))}
      </div>

      <div className="overflow-auto rounded-lg border border-border/60 bg-card max-h-[65vh]">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
        ) : (
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr>{COLUNAS.map(c => <th key={c.chave} className="px-3 h-9 text-left text-xs font-semibold text-muted-foreground border-b border-border/60">{c.titulo}</th>)}</tr>
            </thead>
            <tbody>
              {filtradas.map(l => (
                <tr key={l.id} className="hover:bg-muted/40">
                  {COLUNAS.map(c => <td key={c.chave} className="px-3 h-10 border-b border-border/40">{texto(l, c)}</td>)}
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={COLUNAS.length} className="py-12 text-center text-muted-foreground">Nenhuma máquina com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
