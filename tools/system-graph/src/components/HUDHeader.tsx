import React from 'react';
import { Network, Search, Play, Pause, RotateCcw, Activity } from 'lucide-react';
import { ARCH_NODES, ARCH_EDGES } from '../architecture';
import type { NodeKind } from '../types';

interface HUDHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedKind: NodeKind | 'all';
  onKindChange: (kind: NodeKind | 'all') => void;
  isSimulating: boolean;
  onToggleSimulate: () => void;
  onResetView: () => void;
}

export function HUDHeader({
  searchQuery,
  onSearchChange,
  selectedKind,
  onKindChange,
  isSimulating,
  onToggleSimulate,
  onResetView,
}: HUDHeaderProps) {
  return (
    <header className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
      {/* Title & Brand */}
      <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl pointer-events-auto">
        <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Network className="size-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-wide uppercase">Orion System</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Live Architecture
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {ARCH_NODES.length} nós • {ARCH_EDGES.length} conexões mapeadas
          </p>
        </div>
      </div>

      {/* Center Search & Filter */}
      <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl pointer-events-auto">
        <div className="relative flex items-center">
          <Search className="size-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar nó ou serviço..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-64 bg-slate-800/60 border border-white/5 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        <select
          value={selectedKind}
          onChange={e => onKindChange(e.target.value as NodeKind | 'all')}
          className="bg-slate-800/60 border border-white/5 px-3 py-1.5 text-xs text-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="all">Todas as Camadas</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="database">Database</option>
          <option value="service">Service</option>
          <option value="api">API</option>
          <option value="ai">AI / Copilot</option>
        </select>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl pointer-events-auto">
        <button
          onClick={onToggleSimulate}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
            isSimulating
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          title={isSimulating ? 'Pausar simulação de tráfego' : 'Iniciar simulação de tráfego'}
        >
          {isSimulating ? (
            <>
              <Activity className="size-3.5 animate-pulse text-emerald-400" />
              <span>Tráfego Ativo</span>
            </>
          ) : (
            <>
              <Play className="size-3.5 text-slate-400" />
              <span>Simular</span>
            </>
          )}
        </button>

        <button
          onClick={onResetView}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-xl transition-all"
          title="Resetar Câmera e Seleções"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>
    </header>
  );
}
