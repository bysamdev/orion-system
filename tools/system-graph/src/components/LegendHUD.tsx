import React from 'react';
import { KIND_COLORS, KIND_LABELS } from '../architecture';
import type { NodeKind } from '../types';

interface LegendHUDProps {
  selectedKind: NodeKind | 'all';
  onSelectKind: (kind: NodeKind | 'all') => void;
}

const KINDS: NodeKind[] = ['frontend', 'backend', 'database', 'service', 'api', 'ai'];

export function LegendHUD({ selectedKind, onSelectKind }: LegendHUDProps) {
  return (
    <div className="absolute bottom-6 left-6 z-40 bg-slate-900/85 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl pointer-events-auto flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Camadas</span>
        {selectedKind !== 'all' && (
          <button
            onClick={() => onSelectKind('all')}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Limpar filtro
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 min-w-[240px]">
        {KINDS.map(kind => {
          const isSelected = selectedKind === kind;
          return (
            <button
              key={kind}
              onClick={() => onSelectKind(isSelected ? 'all' : kind)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left transition-all border ${
                isSelected
                  ? 'bg-white/10 border-white/20 shadow-sm'
                  : 'bg-slate-800/40 border-transparent hover:bg-slate-800/80 hover:border-white/5'
              }`}
            >
              <span
                className="size-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: KIND_COLORS[kind] }}
              />
              <span className="text-[11px] font-medium text-slate-300 truncate">
                {KIND_LABELS[kind].split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
