import React from 'react';
import {
  Network,
  Search,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Layers,
  ZoomIn,
  ZoomOut,
  Zap,
  Maximize2,
  Box,
} from 'lucide-react';
import { ARCH_NODES, ARCH_EDGES } from '../architecture';
import type { NodeKind, TrafficIntensity } from '../types';
import type { LayoutMode } from './GraphCanvasView';

interface HUDHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedKind: NodeKind | 'all';
  onKindChange: (kind: NodeKind | 'all') => void;
  isSimulating: boolean;
  onToggleSimulate: () => void;
  trafficIntensity: TrafficIntensity;
  onIntensityChange: (intensity: TrafficIntensity) => void;
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function HUDHeader({
  searchQuery,
  onSearchChange,
  selectedKind,
  onKindChange,
  isSimulating,
  onToggleSimulate,
  trafficIntensity,
  onIntensityChange,
  layoutMode,
  onLayoutChange,
  onResetView,
  onZoomIn,
  onZoomOut,
}: HUDHeaderProps) {
  return (
    <header className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none flex-wrap gap-2">
      {/* Left: Brand & Stats */}
      <div className="flex items-center gap-3 bg-slate-900/85 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl pointer-events-auto">
        <div className="size-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Network className="size-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-wide uppercase">Orion System</h1>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm">
              Live 3D Architecture
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium flex items-center gap-2">
            <span>{ARCH_NODES.length} nós</span>
            <span>•</span>
            <span>{ARCH_EDGES.length} conexões</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">100% Interativo</span>
          </p>
        </div>
      </div>

      {/* Center: Search & Filter */}
      <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl pointer-events-auto">
        <div className="relative flex items-center">
          <Search className="size-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar nó, arquivo ou rota..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-64 bg-slate-800/80 border border-white/10 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all"
          />
        </div>

        <select
          value={selectedKind}
          onChange={e => onKindChange(e.target.value as NodeKind | 'all')}
          className="bg-slate-800/80 border border-white/10 px-3 py-1.5 text-xs text-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
        >
          <option value="all">Todas as Camadas ({ARCH_NODES.length})</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend (Go)</option>
          <option value="database">Database (Postgres)</option>
          <option value="service">Services & Edge</option>
          <option value="api">API Endpoints</option>
          <option value="ai">AI / Copilot</option>
        </select>
      </div>

      {/* Right: Simulation Controls & Layout Switcher */}
      <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl pointer-events-auto">
        {/* Layout Switcher */}
        <div className="flex items-center bg-slate-800/60 p-0.5 rounded-xl border border-white/5">
          <button
            onClick={() => onLayoutChange('forceDirected3d')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              layoutMode === 'forceDirected3d'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Visualização 3D Espacial"
          >
            3D Force
          </button>
          <button
            onClick={() => onLayoutChange('forceDirected2d')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              layoutMode === 'forceDirected2d'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Visualização 2D Plana"
          >
            2D Plano
          </button>
          <button
            onClick={() => onLayoutChange('radialOut2d')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              layoutMode === 'radialOut2d'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Visualização Radial"
          >
            Radial
          </button>
        </div>

        {/* Traffic Toggle */}
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
              <span>Simulação Ativa</span>
            </>
          ) : (
            <>
              <Play className="size-3.5 text-slate-400" />
              <span>Pausada</span>
            </>
          )}
        </button>

        {/* Traffic Speed Selector */}
        {isSimulating && (
          <select
            value={trafficIntensity}
            onChange={e => onIntensityChange(e.target.value as TrafficIntensity)}
            className="bg-slate-800/80 border border-white/10 px-2.5 py-1.5 text-xs text-sky-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-400 cursor-pointer font-mono"
            title="Velocidade e intensidade do tráfego"
          >
            <option value="low">Tráfego: Baixo</option>
            <option value="normal">Tráfego: Normal</option>
            <option value="high">Tráfego: Intenso</option>
            <option value="warp">Tráfego: Warp ⚡</option>
          </select>
        )}

        {/* Camera Zoom & Reset */}
        <div className="flex items-center gap-1 border-l border-white/10 pl-2">
          <button
            onClick={onZoomIn}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-xl transition-all"
            title="Aproximar Câmera"
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            onClick={onZoomOut}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-xl transition-all"
            title="Afastar Câmera"
          >
            <ZoomOut className="size-4" />
          </button>
          <button
            onClick={onResetView}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-xl transition-all"
            title="Centralizar Grafo"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
