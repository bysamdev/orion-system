import React, { useMemo, useState } from 'react';
import { ArrowRight, Edit2, Filter, GitBranch, Loader2, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  listaDeAcoes, listaDeCondicoes, useDeleteRule, useRoutingRules, useSaveRule, useToggleRule,
  type CannedResponseRef, type Company, type RegraParaSalvar, type RoutingRule,
} from '@/hooks/useAutomation';
import type { MembroDaEquipe } from '@/hooks/useEquipeInterna';
import { EditorDeFluxo } from './EditorDeFluxo';
import { descreverAcao, descreverCondicao, iconeDaAcao, type Nomes } from './fluxo';

interface Props {
  filtroEmpresa: string;
  empresaPadrao: string;
  empresas: Company[];
  equipe: MembroDaEquipe[];
  templates: CannedResponseRef[];
  nomes: Nomes;
}

const Etapa: React.FC<{ cor: string; titulo: string; children: React.ReactNode }> = ({ cor, titulo, children }) => (
  <div className="min-w-0 flex-1">
    <p className={cn('text-[11px] font-semibold mb-1', cor)}>{titulo}</p>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const Pilula: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={cn('inline-flex items-center gap-1 max-w-full rounded-md border px-2 py-0.5 text-xs', className)}>
    {children}
  </span>
);

const Seta = () => <ArrowRight className="hidden md:block w-4 h-4 text-muted-foreground/60 shrink-0 mt-5" aria-hidden />;

export const RulesTab: React.FC<Props> = ({ filtroEmpresa, empresaPadrao, empresas, equipe, templates, nomes }) => {
  const { toast } = useToast();
  const { data: regras = [], isLoading } = useRoutingRules();
  const salvar = useSaveRule();
  const apagar = useDeleteRule();
  const alternar = useToggleRule();

  const [editando, setEditando] = useState<RoutingRule | null>(null);
  const [editorAberto, setEditorAberto] = useState(false);
  const [paraApagar, setParaApagar] = useState<RoutingRule | null>(null);

  const visiveis = useMemo(
    () => regras.filter(r => filtroEmpresa === 'all' || r.company_id === filtroEmpresa),
    [regras, filtroEmpresa]
  );

  const abrir = (r: RoutingRule | null) => { setEditando(r); setEditorAberto(true); };

  const aoSalvar = (regra: RegraParaSalvar) => {
    salvar.mutate(regra, {
      onSuccess: () => { toast({ title: 'Regra salva' }); setEditorAberto(false); setEditando(null); },
      onError: (e: Error) => toast({ title: 'Não foi possível salvar a regra', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Regras de automação</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rodam quando um chamado é aberto, na ordem de cada regra. Cada ação disparada aparece no Histórico.
          </p>
        </div>
        <Button onClick={() => abrir(null)} className="gap-1.5 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nova regra
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" /></div>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-14 text-center space-y-3">
          <GitBranch className="w-8 h-8 mx-auto text-muted-foreground/50" aria-hidden />
          <p className="text-sm font-medium">Nenhuma regra {filtroEmpresa === 'all' ? 'ainda' : 'nesta empresa'}</p>
          <Button variant="outline" size="sm" onClick={() => abrir(null)} className="gap-1.5"><Plus className="w-4 h-4" /> Criar a primeira</Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {visiveis.map(r => {
            const condicoes = listaDeCondicoes(r.conditions);
            const acoes = listaDeAcoes(r.actions);
            return (
              <li
                key={r.id}
                className={cn(
                  'rounded-xl border border-border/60 bg-card p-3.5 sm:p-4 transition-colors',
                  !r.is_active && 'opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-muted-foreground tabular-nums pt-0.5 w-6 shrink-0" title="Ordem">#{r.priority}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="text-sm font-semibold truncate">{r.name}</h3>
                      <span className="text-xs text-muted-foreground">{r.companies?.name ?? 'Todas as empresas'}</span>
                      {!r.is_active && <span className="text-[11px] font-medium rounded-full bg-muted px-2 py-0.5">Inativa</span>}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.description}</p>}

                    <div className="mt-3 flex flex-col md:flex-row gap-3 md:gap-2">
                      <Etapa cor="text-sky-600 dark:text-sky-400" titulo="Quando">
                        <Pilula className="border-sky-500/30 bg-sky-500/10"><Zap className="w-3 h-3 shrink-0" aria-hidden />chamado aberto</Pilula>
                      </Etapa>
                      <Seta />
                      <Etapa cor="text-violet-600 dark:text-violet-400" titulo="Se">
                        {condicoes.map((c, i) => {
                          const d = descreverCondicao(c, nomes);
                          return (
                            <Pilula key={i} className="border-violet-500/30 bg-violet-500/10">
                              <Filter className="w-3 h-3 shrink-0" aria-hidden />
                              <span className="truncate">{d.campo} {d.operador} <strong className="font-semibold">{d.valor}</strong></span>
                            </Pilula>
                          );
                        })}
                      </Etapa>
                      <Seta />
                      <Etapa cor="text-emerald-600 dark:text-emerald-400" titulo="Então">
                        {acoes.map((a, i) => {
                          const d = descreverAcao(a, nomes);
                          const Icone = iconeDaAcao(a.type);
                          return (
                            <Pilula key={i} className="border-emerald-500/30 bg-emerald-500/10">
                              <Icone className="w-3 h-3 shrink-0" aria-hidden />
                              <span className="truncate">{d.rotulo}{d.alvo && <>: <strong className="font-semibold">{d.alvo}</strong></>}</span>
                            </Pilula>
                          );
                        })}
                      </Etapa>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={r.is_active}
                      aria-label={r.is_active ? 'Desativar regra' : 'Ativar regra'}
                      onCheckedChange={v => alternar.mutate({ id: r.id, active: v })}
                    />
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Editar regra" onClick={() => abrir(r)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" aria-label="Apagar regra" onClick={() => setParaApagar(r)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editorAberto} onOpenChange={o => { setEditorAberto(o); if (!o) setEditando(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar regra' : 'Nova regra'}</DialogTitle>
            <DialogDescription>Monte o fluxo: quando um chamado é aberto, se as condições valerem, as ações rodam.</DialogDescription>
          </DialogHeader>
          {editorAberto && (
            <EditorDeFluxo
              regra={editando}
              empresaPadrao={filtroEmpresa !== 'all' ? filtroEmpresa : empresaPadrao}
              empresas={empresas}
              equipe={equipe}
              templates={templates}
              nomes={nomes}
              salvando={salvar.isPending}
              onSalvar={aoSalvar}
              onCancelar={() => { setEditorAberto(false); setEditando(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!paraApagar} onOpenChange={o => { if (!o) setParaApagar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a regra "{paraApagar?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Chamados novos deixam de passar por ela. O histórico do que ela já fez continua disponível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => paraApagar && apagar.mutate(paraApagar.id, {
                onSuccess: () => toast({ title: 'Regra apagada' }),
                onError: (e: Error) => toast({ title: 'Não foi possível apagar', description: e.message, variant: 'destructive' }),
              })}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
