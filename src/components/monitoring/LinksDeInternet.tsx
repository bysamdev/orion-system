import React, { useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle, ArrowRightLeft, Building2, CheckCircle2, ExternalLink, Globe, Pencil, Plus, Radio,
  Satellite, Server, Trash2, Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCompanies } from '@/hooks/useCompanies';
import {
  useDeleteNetworkLink, useNetworkLinks, useSalvarLink,
  type NetworkLink, type PapelDoLink, type TipoDeLink,
} from '@/hooks/useNetworkLinks';
import { cn } from '@/lib/utils';

// Links de internet por cliente: o principal (dedicado) e a redundância
// (Starlink ou internet comum). Duas medições, lado a lado:
//  - Sonda: o agente no servidor do cliente (link em uso, latência, perda).
//  - De fora: ping do servidor de monitoramento no IP público do link.
// O histórico completo fica no Grafana (painel "Links de Internet").

const PAINEL_DO_GRAFANA = 'https://monitor-orion.bysam.de/d/orion-links';

const TIPOS: Record<TipoDeLink, { rotulo: string; icone: React.ElementType }> = {
  dedicado: { rotulo: 'Link dedicado', icone: Server },
  starlink: { rotulo: 'Starlink', icone: Satellite },
  internet: { rotulo: 'Internet comum', icone: Wifi },
};

const PAPEIS: Record<PapelDoLink, string> = { principal: 'Principal', backup: 'Backup' };

const ms = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)} ms`);
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

function Situacao({ ok, rotuloOk, rotuloFalha, desconhecido }: { ok: boolean | null | undefined; rotuloOk: string; rotuloFalha: string; desconhecido: string }) {
  if (ok == null) return <span className="text-muted-foreground">{desconhecido}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      <span className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-emerald-500' : 'bg-red-500')} />
      {ok ? rotuloOk : rotuloFalha}
    </span>
  );
}

const CartaoDoLink: React.FC<{ link: NetworkLink; onEditar: () => void; onApagar: () => void; apagando: boolean }> = ({ link, onEditar, onApagar, apagando }) => {
  const tipo = TIPOS[link.type] ?? TIPOS.internet;
  const Icone = tipo.icone;
  const sonda = link.estado;
  const emUso = link.em_uso;
  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-3', emUso ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border/50')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-muted/50 border border-border/40 shrink-0"><Icone className="w-4 h-4" /></div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{link.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {tipo.rotulo}{link.ip_or_host ? ` · ${link.ip_or_host}` : ' · sem IP fixo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-[10px] font-semibold">{PAPEIS[link.papel]}</Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditar} aria-label={`Editar ${link.name}`}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={onApagar} disabled={apagando} aria-label={`Excluir ${link.name}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {emUso != null && (
        <p className={cn('text-xs font-semibold', emUso ? 'text-primary' : 'text-muted-foreground')}>
          {emUso ? 'Em uso agora' : 'Em espera'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted/30 px-3 py-2 space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Sonda (servidor do cliente)</p>
          <Situacao ok={sonda?.up} rotuloOk="Online" rotuloFalha="Sem resposta"
            desconhecido={sonda ? 'Sem medição deste link' : 'Aguardando a sonda'} />
          {sonda?.up != null && (
            <p className="font-mono text-foreground">{ms(sonda.latencia_ms)} · perda {pct(sonda.perda_pct)} · jitter {ms(sonda.jitter_ms)}</p>
          )}
        </div>
        <div className="rounded-lg bg-muted/30 px-3 py-2 space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">De fora (IP público)</p>
          {link.ip_or_host ? (
            <>
              <Situacao ok={link.de_fora?.responde} rotuloOk="Responde" rotuloFalha="Sem resposta" desconhecido="Aguardando medição" />
              {link.de_fora?.responde && <p className="font-mono text-foreground">{ms(link.de_fora.latencia_ms)}</p>}
            </>
          ) : (
            <span className="text-muted-foreground">Sem IP fixo</span>
          )}
        </div>
      </div>

      {sonda?.medido_em && (
        <p className="text-[11px] text-muted-foreground">
          Medido pela sonda {formatDistanceToNowStrict(new Date(sonda.medido_em), { locale: ptBR, addSuffix: true })}
          {link.alvo_teste ? ` · rota de teste ${link.alvo_teste}` : ''}
        </p>
      )}
    </div>
  );
};

interface Formulario {
  id?: string;
  company_id: string;
  nome: string;
  tipo: TipoDeLink;
  papel: PapelDoLink;
  ip_publico: string;
  alvo_teste: string;
}

const VAZIO: Formulario = { company_id: '', nome: '', tipo: 'dedicado', papel: 'principal', ip_publico: '', alvo_teste: '' };

export const LinksDeInternet: React.FC = () => {
  const { data: companies } = useCompanies();
  const [empresa, setEmpresa] = useState('all');
  const { data: links = [], isLoading, isError, error } = useNetworkLinks(empresa !== 'all' ? empresa : undefined);
  const salvar = useSalvarLink();
  const apagar = useDeleteNetworkLink();
  const [form, setForm] = useState<Formulario | null>(null);

  const porCliente = useMemo(() => {
    const grupos = new Map<string, NetworkLink[]>();
    for (const l of links) {
      const chave = l.company_name ?? 'Sem cliente';
      grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
    }
    const ordemPapel = (l: NetworkLink) => (l.papel === 'principal' ? 0 : 1);
    return [...grupos.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(([cliente, lista]) => ({ cliente, lista: lista.sort((a, b) => ordemPapel(a) - ordemPapel(b) || a.name.localeCompare(b.name)) }));
  }, [links]);

  const resumo = useMemo(() => {
    const clientesNoBackup = new Set(links.filter(l => l.papel === 'backup' && l.em_uso).map(l => l.company_id));
    return {
      total: links.length,
      clientes: porCliente.length,
      noBackup: clientesNoBackup.size,
      fora: links.filter(l => l.status === 'offline').length,
    };
  }, [links, porCliente]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.company_id || !form.nome.trim()) {
      toast.error('Preencha o cliente e o nome do link');
      return;
    }
    try {
      await salvar.mutateAsync({ ...form, nome: form.nome.trim(), ip_publico: form.ip_publico.trim(), alvo_teste: form.alvo_teste.trim() });
      toast.success(form.id ? 'Link atualizado' : 'Link cadastrado');
      setForm(null);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar o link');
    }
  };

  const excluir = async (l: NetworkLink) => {
    if (!confirm(`Excluir o link "${l.name}"? O histórico no Grafana continua até expirar.`)) return;
    try {
      await apagar.mutateAsync(l.id);
      toast.success('Link excluído');
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao excluir o link');
    }
  };

  const indicadores = [
    { rotulo: 'Links monitorados', valor: resumo.total, detalhe: `${resumo.clientes} cliente(s)`, icone: Radio, alerta: false },
    { rotulo: 'Clientes no backup', valor: resumo.noBackup, detalhe: 'tráfego saindo pela redundância', icone: ArrowRightLeft, alerta: resumo.noBackup > 0 },
    { rotulo: 'Links sem resposta', valor: resumo.fora, detalhe: 'pela sonda ou pelo ping de fora', icone: AlertTriangle, alerta: resumo.fora > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {indicadores.map(i => (
          <Card key={i.rotulo} className="border-border/40">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{i.rotulo}</p>
                <p className={cn('text-2xl font-bold mt-1', i.alerta && 'text-red-600 dark:text-red-400')}>{i.valor}</p>
                <p className="text-xs text-muted-foreground">{i.detalhe}</p>
              </div>
              <div className={cn('p-2 rounded-lg', i.alerta ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600')}>
                {i.alerta ? <i.icone className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Links de internet por cliente</h2>
          <p className="text-xs text-muted-foreground">Principal e redundância, medidos pelo servidor do cliente e pelo servidor de monitoramento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-[200px]">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5" asChild>
            <a href={PAINEL_DO_GRAFANA} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Histórico no Grafana</a>
          </Button>
          <Button size="sm" className="h-9 rounded-xl gap-1.5" onClick={() => setForm({ ...VAZIO, company_id: empresa !== 'all' ? empresa : '' })}>
            <Plus className="w-4 h-4" /> Novo link
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando links...</p>
      ) : isError ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-6 text-sm text-red-700 dark:text-red-300">
            Não foi possível falar com o servidor de monitoramento: {(error as Error)?.message}
          </CardContent>
        </Card>
      ) : porCliente.length === 0 ? (
        <Card className="border-dashed border-2 border-border/60 bg-muted/20">
          <CardContent className="p-12 text-center flex flex-col items-center gap-3">
            <Globe className="w-8 h-8 text-muted-foreground" />
            <div>
              <h3 className="font-bold">Nenhum link cadastrado</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Cadastre o link principal e o de backup de cada cliente. O servidor do cliente com o agente do Orion passa a medir os links sozinho.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {porCliente.map(({ cliente, lista }) => (
            <section key={cliente} className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">{cliente}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {lista.map(l => (
                  <CartaoDoLink key={l.id} link={l} apagando={apagar.isPending}
                    onApagar={() => excluir(l)}
                    onEditar={() => setForm({
                      id: l.id, company_id: l.company_id ?? '', nome: l.name, tipo: l.type, papel: l.papel,
                      ip_publico: l.ip_or_host, alvo_teste: l.alvo_teste,
                    })} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={aberto => { if (!aberto) setForm(null); }}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar link' : 'Novo link de internet'}</DialogTitle>
            <DialogDescription>
              O servidor do cliente com o agente do Orion mede o link sozinho. O IP público permite também o ping de fora.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={enviar} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="link-cliente">Cliente</Label>
                  <Select value={form.company_id} onValueChange={v => setForm({ ...form, company_id: v })}>
                    <SelectTrigger id="link-cliente" className="rounded-xl"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>
                      {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="link-nome">Nome do link</Label>
                  <Input id="link-nome" className="rounded-xl" placeholder="Ex.: Vivo 500 Mb" value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })} maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-tipo">Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as TipoDeLink })}>
                    <SelectTrigger id="link-tipo" className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPOS) as TipoDeLink[]).map(t => <SelectItem key={t} value={t}>{TIPOS[t].rotulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-papel">Papel</Label>
                  <Select value={form.papel} onValueChange={v => setForm({ ...form, papel: v as PapelDoLink })}>
                    <SelectTrigger id="link-papel" className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="principal">Principal</SelectItem>
                      <SelectItem value="backup">Backup (redundância)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="link-ip">IP público fixo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input id="link-ip" className="rounded-xl font-mono text-sm" placeholder="Ex.: 200.150.10.1"
                    value={form.ip_publico} onChange={e => setForm({ ...form, ip_publico: e.target.value })} />
                  <p className="text-xs text-muted-foreground">
                    Do contrato da operadora ou da WAN do roteador. Serve para o ping de fora e para saber qual link está em uso. Starlink comum não tem: deixe vazio.
                  </p>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="link-teste">Rota de teste <span className="text-muted-foreground font-normal">(opcional, MikroTik)</span></Label>
                  <Input id="link-teste" className="rounded-xl font-mono text-sm" placeholder="Ex.: 1.0.0.1"
                    value={form.alvo_teste} onChange={e => setForm({ ...form, alvo_teste: e.target.value })} />
                  <p className="text-xs text-muted-foreground">
                    IP que o roteador manda sempre por este link. Com ele a sonda mede o link mesmo quando ele está em espera.
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit" className="rounded-xl font-semibold" disabled={salvar.isPending}>
                  {salvar.isPending ? 'Salvando...' : 'Salvar link'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
