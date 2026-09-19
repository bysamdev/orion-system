import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiltrosDoPainel } from './useFiltrosDoPainel';
import { CATEGORIAS } from './identidade';

// As opções saem das mesmas tabelas que os cartões usam (categorias e faixas
// de prazo), para o filtro nunca oferecer um valor que nenhum cartão tem.
const PRAZOS = [
  { valor: 'atrasado', rotulo: 'Atrasados' },
  { valor: 'atencao', rotulo: 'Precisam de atenção' },
  { valor: 'em_dia', rotulo: 'Em dia' },
  { valor: 'pausado', rotulo: 'SLA pausado (aguardando)' },
];

const STATUS = [
  { valor: 'open', rotulo: 'Aberto' },
  { valor: 'reopened', rotulo: 'Reaberto' },
  { valor: 'in-progress', rotulo: 'Em atendimento' },
  { valor: 'awaiting-customer', rotulo: 'Aguardando cliente' },
  { valor: 'awaiting-third-party', rotulo: 'Aguardando terceiro' },
];

const Campo: React.FC<{ rotulo: string; className?: string; children: React.ReactNode }> = ({ rotulo, className, children }) => (
  <label className={`space-y-1.5 text-left ${className ?? ''}`}>
    <span className="block text-xs font-medium text-muted-foreground ml-1">{rotulo}</span>
    {children}
  </label>
);

export const FiltrosAvancados: React.FC<{ filtros: FiltrosDoPainel }> = ({ filtros: f }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3 bg-muted/20 rounded-xl border border-border/40 animate-in fade-in slide-in-from-top-2">
    <Campo rotulo="Prioridade">
      <Select value={f.priorityFilter} onValueChange={f.setPriorityFilter}>
        <SelectTrigger className="h-9 bg-background/50 border-border/40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="urgent">Urgente</SelectItem>
          <SelectItem value="high">Alta</SelectItem>
          <SelectItem value="medium">Média</SelectItem>
          <SelectItem value="low">Baixa</SelectItem>
        </SelectContent>
      </Select>
    </Campo>

    <Campo rotulo="Status">
      <Select value={f.statusFilter} onValueChange={f.setStatusFilter}>
        <SelectTrigger className="h-9 bg-background/50 border-border/40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {STATUS.map(s => <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>)}
        </SelectContent>
      </Select>
    </Campo>

    <Campo rotulo="Categoria">
      <Select value={f.categoryFilter} onValueChange={f.setCategoryFilter}>
        <SelectTrigger className="h-9 bg-background/50 border-border/40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {Object.entries(CATEGORIAS).map(([valor, { rotulo, icone: Icone }]) => (
            <SelectItem key={valor} value={valor}>
              <span className="inline-flex items-center gap-2"><Icone className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />{rotulo}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>

    <Campo rotulo="Prazo (SLA)">
      <Select value={f.slaFilter} onValueChange={f.setSlaFilter}>
        <SelectTrigger className="h-9 bg-background/50 border-border/40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {PRAZOS.map(p => <SelectItem key={p.valor} value={p.valor}>{p.rotulo}</SelectItem>)}
        </SelectContent>
      </Select>
    </Campo>

    <Campo rotulo="Cliente / empresa">
      <Input
        placeholder="Nome da empresa"
        value={f.companyFilter === 'all' ? '' : f.companyFilter}
        onChange={(e) => f.setCompanyFilter(e.target.value || 'all')}
        className="h-9 bg-background/50 border-border/40"
      />
    </Campo>

    {f.temFiltro && (
      <div className="sm:col-span-2 lg:col-span-5 flex justify-end -mt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={f.limparFiltros}
          className="h-8 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          Limpar filtros
        </Button>
      </div>
    )}
  </div>
);
