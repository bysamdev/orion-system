import React from 'react';
import { Layers, Cpu, Code2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { KIND_COLORS, KIND_LABELS, ARCH_EDGES } from '../architecture';
import type { ArchNode } from '../types';

interface NodeHoverCardProps {
  node: ArchNode | null;
}

export function NodeHoverCard({ node }: NodeHoverCardProps) {
  if (!node) return null;

  const outgoing = ARCH_EDGES.filter(e => e.source === node.id);
  const incoming = ARCH_EDGES.filter(e => e.target === node.id);

  return (
    <div className="absolute top-20 left-6 z-40 w-80 bg-slate-900/95 backdrop-blur-2xl border border-sky-500/30 rounded-2xl shadow-2xl p-4 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <span
          className="size-4 rounded-full shrink-0 shadow-lg ring-4 ring-white/10"
          style={{ backgroundColor: KIND_COLORS[node.kind] }}
        />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{node.label}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-semibold text-slate-300">
              {KIND_LABELS[node.kind]}
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {node.tech}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed line-clamp-3">
        {node.description}
      </p>

      {/* Source File */}
      <div className="mt-3 flex items-center gap-1.5 p-2 rounded-xl bg-slate-800/70 border border-white/5 font-mono text-[10px] text-sky-300 truncate">
        <Code2 className="size-3.5 text-slate-400 shrink-0" />
        <span className="truncate">{node.sourceRef}</span>
      </div>

      {/* Connections Count */}
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10px] font-medium">
        <div className="flex items-center gap-1.5 text-purple-300 bg-slate-800/40 px-2 py-1 rounded-lg">
          <ArrowDownLeft className="size-3 text-purple-400" />
          <span>{incoming.length} entradas</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-300 bg-slate-800/40 px-2 py-1 rounded-lg">
          <ArrowUpRight className="size-3 text-emerald-400" />
          <span>{outgoing.length} saídas</span>
        </div>
      </div>
    </div>
  );
}
