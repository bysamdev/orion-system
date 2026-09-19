import React, { useMemo, useState } from 'react';
import { Filter, Loader2, Plus, Sparkles, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ACTION_TYPES, CONDITION_FIELDS, OPERADORES, listaDeAcoes, listaDeCondicoes,
  type Acao, type CannedResponseRef, type Company, type Condicao, type RegraParaSalvar, type RoutingRule,
} from '@/hooks/useAutomation';
import type { MembroDaEquipe } from '@/hooks/useEquipeInterna';
import { CATEGORIAS } from '@/lib/categoriasDeChamado';
import { PRIORIDADES, descreverAcao, descreverCondicao, iconeDaAcao, problemaNaRegra, type Nomes } from './fluxo';

interface Props {
  regra: RoutingRule | null;
  empresaPadrao: string;
  empresas: Company[];
  equipe: MembroDaEquipe[];
  templates: CannedResponseRef[];
  nomes: Nomes;
  salvando: boolean;
  onSalvar: (regra: RegraParaSalvar) => void;
  onCancelar: () => void;
}

// Nó do fluxo: cartão com faixa colorida, ícone e título, como no n8n.
const No: React.FC<{ cor: string; icone: React.ElementType; titulo: string; subtitulo: string; children: React.ReactNode }> = ({
  cor, icone: Icone, titulo, subtitulo, children,
}) => (
  <section className="relative rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
    <span className={cn('absolute left-0 top-0 bottom-0 w-1', cor)} aria-hidden />
    <header className="flex items-center gap-2.5 pl-4 pr-3 pt-3">
      <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0', cor)}>
        <Icone className="w-4 h-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-tight">{titulo}</h3>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </div>
    </header>
    <div className="pl-4 pr-3 pb-3 pt-3 space-y-2">{children}</div>
  </section>
);

const Conector: React.FC<{ rotulo?: string }> = ({ rotulo }) => (
  <div className="flex flex-col items-center py-1" aria-hidden>
    <span className="w-px h-4 bg-border" />
    {rotulo && <span className="text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-full border border-border/70 bg-background">{rotulo}</span>}
    <span className="w-px h-4 bg-border" />
  </div>
);

const Botaozinho: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full h-9 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors inline-flex items-center justify-center gap-1.5"
  >
    <Plus className="w-3.5 h-3.5" aria-hidden /> {children}
  </button>
);

const CONDICAO_NOVA: Condicao = { field: 'category', operator: 'equals', value: '' };
const ACAO_NOVA: Acao = { type: 'assign_tech', target: '' };

export const EditorDeFluxo: React.FC<Props> = ({
  regra, empresaPadrao, empresas, equipe, templates, nomes, salvando, onSalvar, onCancelar,
}) => {
  const [nome, setNome] = useState(regra?.name ?? '');
  const [descricao, setDescricao] = useState(regra?.description ?? '');
  const [ordem, setOrdem] = useState(regra?.priority ?? 10);
  const [ativa, setAtiva] = useState(regra?.is_active ?? true);
  const [empresa, setEmpresa] = useState(regra?.company_id ?? empresaPadrao);
  const [condicoes, setCondicoes] = useState<Condicao[]>(() => {
    const l = listaDeCondicoes(regra?.conditions);
    return l.length ? l : [{ ...CONDICAO_NOVA }];
  });
  const [acoes, setAcoes] = useState<Acao[]>(() => {
    const l = listaDeAcoes(regra?.actions).map(a => (a.type === 'assign_to_user' ? { ...a, type: 'assign_tech' } : a));
    return l.length ? l : [{ ...ACAO_NOVA }];
  });
  const [erro, setErro] = useState<string | null>(null);

  const templatesDaEmpresa = useMemo(() => templates.filter(t => t.company_id === empresa), [templates, empresa]);

  const mudarCondicao = (i: number, parcial: Partial<Condicao>) =>
    setCondicoes(l => l.map((c, k) => (k === i ? { ...c, ...parcial } : c)));
  const mudarAcao = (i: number, parcial: Partial<Acao>) =>
    setAcoes(l => l.map((a, k) => (k === i ? { ...a, ...parcial } : a)));

  const resumo = useMemo(() => {
    const nomeEmpresa = nomes.empresas.get(empresa) ?? 'escolha a empresa';
    const se = condicoes.filter(c => c.value).map(c => {
      const d = descreverCondicao(c, nomes);
      return `${d.campo.toLowerCase()} ${d.operador} "${d.valor}"`;
    });
    const entao = acoes.map(a => {
      const d = descreverAcao(a, nomes);
      return d.alvo ? `${d.rotulo.toLowerCase()}: ${d.alvo}` : d.rotulo.toLowerCase();
    });
    return `Quando um chamado de ${nomeEmpresa} for aberto${se.length ? ` e ${se.join(' e ')}` : ''}, então ${entao.join(', depois ')}.`;
  }, [empresa, condicoes, acoes, nomes]);

  const salvar = () => {
    const problema = problemaNaRegra(nome, empresa, condicoes, acoes);
    setErro(problema);
    if (problema) return;
    onSalvar({
      id: regra?.id,
      company_id: empresa,
      name: nome.trim(),
      description: descricao.trim(),
      priority: ordem,
      conditions: condicoes.map(c => ({ ...c, value: c.value.trim() })),
      actions: acoes.map(a => ({ ...a, target: ACTION_TYPES.find(t => t.value === a.type)?.precisaAlvo ? a.target : '' })),
      is_active: ativa,
    });
  };

  const valorDaCondicao = (c: Condicao, i: number) => {
    if (c.field === 'category') {
      return (
        <Select value={c.value} onValueChange={v => mudarCondicao(i, { value: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIAS).map(([v, { rotulo }]) => <SelectItem key={v} value={v}>{rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (c.field === 'priority') {
      return (
        <Select value={c.value} onValueChange={v => mudarCondicao(i, { value: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (c.field === 'company_id') {
      return (
        <Select value={c.value} onValueChange={v => mudarCondicao(i, { value: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    return (
      <Input
        className="h-9"
        value={c.value}
        placeholder={c.field === 'title' ? 'Ex: impressora' : 'Ex: Financeiro'}
        onChange={e => mudarCondicao(i, { value: e.target.value })}
      />
    );
  };

  const alvoDaAcao = (a: Acao, i: number) => {
    if (a.type === 'assign_tech' || a.type === 'escalate_manager') {
      return (
        <Select value={a.target} onValueChange={v => mudarAcao(i, { target: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Quem" /></SelectTrigger>
          <SelectContent>{equipe.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || 'Sem nome'}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (a.type === 'set_priority') {
      return (
        <Select value={a.target} onValueChange={v => mudarAcao(i, { target: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (a.type === 'auto_response') {
      return templatesDaEmpresa.length === 0 ? (
        <p className="h-9 flex items-center text-xs text-muted-foreground">Nenhum template nesta empresa. Crie na aba Templates.</p>
      ) : (
        <Select value={a.target} onValueChange={v => mudarAcao(i, { target: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Template" /></SelectTrigger>
          <SelectContent>{templatesDaEmpresa.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_96px] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nome-regra" className="text-xs">Nome da regra</Label>
          <Input id="nome-regra" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Impressora urgente vai para o N1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ordem-regra" className="text-xs">Ordem</Label>
          <Input id="ordem-regra" type="number" min={1} value={ordem} onChange={e => setOrdem(Number(e.target.value) || 1)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="descricao-regra" className="text-xs">Descrição (opcional)</Label>
          <Input id="descricao-regra" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Por que esta regra existe" />
        </div>
      </div>

      {/* Tela do fluxo, com fundo pontilhado. */}
      <div className="rounded-2xl border border-border/60 p-3 sm:p-5 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]">
        <div className="max-w-xl mx-auto">
          <No cor="bg-sky-500" icone={Zap} titulo="Quando" subtitulo="Um chamado é aberto">
            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
              <span className="text-xs text-muted-foreground">na empresa</span>
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>{empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </No>

          <Conector />

          <No cor="bg-violet-500" icone={Filter} titulo="Se" subtitulo="Todas as condições precisam valer">
            {condicoes.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 pl-1">E</p>}
                <div className="grid grid-cols-1 sm:grid-cols-[140px_130px_1fr_36px] gap-2 items-center">
                  <Select value={c.field} onValueChange={v => mudarCondicao(i, { field: v, value: '' })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={c.operator} onValueChange={v => mudarCondicao(i, { operator: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPERADORES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {valorDaCondicao(c, i)}
                  <Button
                    type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"
                    aria-label="Remover condição" disabled={condicoes.length === 1}
                    onClick={() => setCondicoes(l => l.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </React.Fragment>
            ))}
            <Botaozinho onClick={() => setCondicoes(l => [...l, { ...CONDICAO_NOVA }])}>Adicionar condição</Botaozinho>
          </No>

          <Conector rotulo="então" />

          <No cor="bg-emerald-500" icone={Sparkles} titulo="Então" subtitulo="As ações rodam em sequência">
            {acoes.map((a, i) => {
              const precisaAlvo = ACTION_TYPES.find(t => t.value === a.type)?.precisaAlvo;
              return (
                <div key={i} className="grid grid-cols-[24px_1fr_36px] sm:grid-cols-[24px_220px_1fr_36px] gap-2 items-center">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
                  <Select value={a.type} onValueChange={v => mudarAcao(i, { type: v, target: '' })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map(t => {
                        const IconeDoItem = iconeDaAcao(t.value);
                        return (
                          <SelectItem key={t.value} value={t.value}>
                            <span className="inline-flex items-center gap-2"><IconeDoItem className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />{t.label}</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <div className={cn('col-start-2 sm:col-start-auto', !precisaAlvo && 'hidden sm:block')}>
                    {precisaAlvo ? alvoDaAcao(a, i) : <span className="text-xs text-muted-foreground">sem configuração</span>}
                  </div>
                  <Button
                    type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto"
                    aria-label="Remover ação" disabled={acoes.length === 1}
                    onClick={() => setAcoes(l => l.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
            <Botaozinho onClick={() => setAcoes(l => [...l, { ...ACAO_NOVA }])}>Adicionar ação</Botaozinho>
          </No>
        </div>
      </div>

      <div className="rounded-xl bg-muted/40 border border-border/50 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground mb-0.5">Resumo</p>
        <p className="text-sm text-foreground">{resumo}</p>
      </div>

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm">
          <Switch checked={ativa} onCheckedChange={setAtiva} /> Regra ativa
        </label>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar regra
          </Button>
        </div>
      </div>
    </div>
  );
};
