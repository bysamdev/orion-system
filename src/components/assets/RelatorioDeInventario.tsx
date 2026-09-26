import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { OsIcon } from '@/components/monitoring/MachineCard';
import { useAllMachines } from '@/hooks/useMonitoring';
import { parseOsInfo } from '@/lib/monitoring/sistemaOperacional';
import { exportarPlanilhaDoInventario } from './planilhaDoInventario';
import { COLUNAS, texto, type LinhaDoInventario } from './colunasDoInventario';

export type { LinhaDoInventario };

// Relatório analítico do inventário: uma linha por máquina, com o hardware e o
// antivírus, e exportação para PDF (impressão) e Excel. Os filtros e a busca
// são os do topo da tela; aqui só chegam os ids já filtrados.

type Disco = { total?: number };
type Seguranca = { antivirus?: { name?: string; active?: boolean }[] };


const GB = 1024 ** 3;
const TIPOS: Record<string, string> = { desktop: 'Computador', notebook: 'Notebook', server: 'Servidor' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- linha do PostgREST com joins aninhados
function montarLinha(m: Record<string, any>): LinhaDoInventario {
  const hw = (Array.isArray(m.machine_hardware) ? m.machine_hardware[0] : m.machine_hardware) ?? {};
  const discos: Disco[] = Array.isArray(hw.disks) ? hw.disks : [];
  const total = discos.reduce((s, d) => s + (d.total ?? 0), 0);
  const seg: Seguranca = hw.security_info ?? {};
  const av = (seg.antivirus ?? []).filter(a => a.active).map(a => a.name).filter(Boolean).join(', ');
  return {
    id: m.id,
    cliente: m.companies?.name ?? '—',
    maquina: m.hostname,
    tipo: TIPOS[m.device_type] ?? 'Não identificado',
    os: m.os,
    osVersion: m.os_version,
    // Só o nome do sistema (Windows 11, Windows 10...), sem a build.
    sistema: m.os ? parseOsInfo(m.os, m.os_version).name : '—',
    usuario: m.logged_in_user ?? m.current_user ?? '—',
    ip: m.local_ip ?? m.ip_address ?? '—',
    processador: hw.cpu_model || '—',
    memoriaGb: null,
    discoGb: total ? Math.round(total / GB) : null,
    antivirus: seg.antivirus ? av || 'Nenhum ativo' : '—',
    versaoAgente: m.agent_version ?? '—',
    situacao: m.status === 'online' ? 'Online' : 'Offline',
    ultimoContato: m.last_seen,
    mac: m.mac_address ?? '—',
    dominio: m.domain || '—',
    criadoEm: m.created_at,
  };
}

const escHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// PDF pela impressão do navegador ("Salvar como PDF"): página própria, em
// paisagem, só com a lista.
function imprimirPdf(linhas: LinhaDoInventario[], subtitulo: string) {
  const janela = window.open('', '_blank');
  if (!janela) return;
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Inventário de máquinas</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: system-ui, sans-serif; color: #111; }
  h1 { font-size: 16px; margin: 0; }
  p { font-size: 11px; color: #555; margin: 2px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #ccc; padding: 3px 5px; text-align: left; }
  th { background: #eee; }
  tr { break-inside: avoid; }
</style></head><body>
<h1>Inventário de máquinas</h1>
<p>${escHtml(subtitulo)} · ${linhas.length} máquina(s) · gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
<table><thead><tr>${COLUNAS.map(c => `<th>${escHtml(c.titulo)}</th>`).join('')}</tr></thead>
<tbody>${linhas.map(l => `<tr>${COLUNAS.map(c => `<td>${escHtml(texto(l, c))}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`);
  janela.document.close();
  janela.focus();
  janela.print();
}

interface RelatorioDeInventarioProps {
  // Máquinas que passaram nos filtros do topo da tela.
  idsFiltrados: Set<string>;
  // Cliente escolhido no filtro do topo, para o nome do arquivo e o título do PDF.
  clienteFiltrado?: string;
}

export const RelatorioDeInventario: React.FC<RelatorioDeInventarioProps> = ({ idsFiltrados, clienteFiltrado }) => {
  // O snapshot de RAM não é mais gravado no Supabase; a API já combina o
  // cadastro escopado por empresa com a última leitura do Orion Monitor.
  const { data: maquinasMonitor = [], isLoading: carregandoMonitor } = useAllMachines();
  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ['inventario', 'relatorio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('id, hostname, os, os_version, device_type, logged_in_user, current_user, local_ip, ip_address, agent_version, status, last_seen, mac_address, domain, created_at, companies(name), machine_hardware(cpu_model, disks, security_info)')
        .eq('approval_status', 'approved')
        .order('hostname');
      if (error) throw error;
      return (data ?? []).map(m => montarLinha(m as Parameters<typeof montarLinha>[0]));
    },
    staleTime: 60_000,
  });

  const filtradas = useMemo(() => {
    const memoriaPorId = new Map(maquinasMonitor.map(m => [m.id, m.ram_total]));
    return linhas.filter(l => idsFiltrados.has(l.id)).map(l => {
      const bytes = memoriaPorId.get(l.id);
      return { ...l, memoriaGb: typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / GB) : null };
    });
  }, [linhas, idsFiltrados, maquinasMonitor]);

  const recorte = clienteFiltrado ?? 'Todos os clientes';
  const nomeDoArquivo = `inventario_${recorte.replace(/\W+/g, '-').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filtradas.length} máquina(s) · {recorte}. Use a busca e os filtros do topo para recortar a lista.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={!filtradas.length} onClick={() => imprimirPdf(filtradas, recorte)}>
            <FileText className="w-4 h-4" /> PDF
          </Button>
          <Button size="sm" className="h-9 gap-1.5" disabled={!filtradas.length} onClick={() => { void exportarPlanilhaDoInventario(filtradas, recorte, nomeDoArquivo); }}>
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-border/60 bg-card max-h-[65vh]">
        {isLoading || carregandoMonitor ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
        ) : (
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr>{COLUNAS.map(c => <th key={c.chave} className="px-3 h-9 text-left text-xs font-semibold text-muted-foreground border-b border-border/60">{c.titulo}</th>)}</tr>
            </thead>
            <tbody>
              {filtradas.map(l => (
                <tr key={l.id} className="hover:bg-muted/40">
                  {COLUNAS.map(c => (
                    <td key={c.chave} className="px-3 h-10 border-b border-border/40">
                      {c.chave === 'sistema' && l.os ? (
                        <span className="inline-flex items-center gap-1.5"><OsIcon os={l.os} osVersion={l.osVersion} />{l.sistema}</span>
                      ) : texto(l, c)}
                    </td>
                  ))}
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
