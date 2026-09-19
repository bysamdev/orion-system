import React from 'react';
import { BarChart3, Columns3, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModoDoPainel } from './useModoDoPainel';

const OPCOES: { modo: ModoDoPainel; rotulo: string; icone: React.ElementType }[] = [
  { modo: 'lista', rotulo: 'Lista', icone: List },
  { modo: 'padrao', rotulo: 'Quadro', icone: Columns3 },
  { modo: 'graficos', rotulo: 'Gráficos', icone: BarChart3 },
];

export const SeletorDeModo: React.FC<{ modo: ModoDoPainel; onEscolher: (modo: ModoDoPainel) => void }> = ({ modo, onEscolher }) => (
  <div role="radiogroup" aria-label="Modo de exibição" className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/50">
    {OPCOES.map(({ modo: opcao, rotulo, icone: Icone }) => (
      <button
        key={opcao}
        type="button"
        role="radio"
        aria-checked={modo === opcao}
        onClick={() => onEscolher(opcao)}
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
          modo === opcao
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icone className="w-3.5 h-3.5" />
        {rotulo}
      </button>
    ))}
  </div>
);
