import React from 'react';
import { X, Code2, ArrowRightLeft, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { KIND_COLORS, KIND_LABELS, ARCH_EDGES, NODE_BY_ID } from '../architecture';
import type { ArchNode, NodeStatus } from '../types';

interface NodeInspectorSheetProps {
  node: ArchNode | null;
  status?: NodeStatus;
  onClose: () => void;
  onSelectNode: (node: ArchNode) => void;
}

export function NodeInspectorSheet({
  node,
  status = 'idle',
  onClose,
  onSelectNode,
}: NodeInspectorSheetProps) {
  if (!node) return null;

  // Find incoming & outgoing edges
  const outgoing = ARCH_EDGES.filter(e => e.source === node.id).map(e => NODE_BY_ID.get(e.target)).filter(Boolean) as ArchNode[];
  const incoming = ARCH_EDGES.filter(e => e.target === node.id).map(e => NODE_BY_ID.get(e.source)).filter(Boolean) as ArchNode[];

  return (
    <div className="absolute top-20 right-6 z-40 w-96 max-h-[calc(100vh-120px)] bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto transition-all animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="size-4 rounded-full mt-1 shrink-0 shadow-md"
            style={{ backgroundColor: KIND_COLORS[node.kind] }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white leading-tight">{node.label}</h2>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {KIND_LABELS[node.kind]}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-xl transition-all"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 overflow-y-auto space-y-4">
        {/* Description */}
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Descrição</h3>
          <p className="text-xs text-slate-200 leading-relaxed bg-slate-800/40 p-3 rounded-2xl border border-white/5">
            {node.description}
          </p>
        </div>

        {/* Source Reference */}
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="size-3.5 text-indigo-400" />
            Arquivo no Repositório
          </h3>
          <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-2xl border border-white/5 font-mono text-[11px] text-indigo-300">
            <span className="truncate">{node.sourceRef}</span>
          </div>
        </div>

        {/* Connections */}
        <div className="space-y-3 pt-2">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowRightLeft className="size-3.5 text-sky-400" />
            Conexões ({outgoing.length + incoming.length})
          </h3>

          {outgoing.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Chama ({outgoing.length})</span>
              <div className="flex flex-wrap gap-1.5">
                {outgoing.map(target => (
                  <button
                    key={target.id}
                    onClick={() => onSelectNode(target)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/60 hover:bg-slate-700/80 border border-white/5 rounded-xl text-xs text-slate-200 transition-all hover:scale-[1.02]"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: KIND_COLORS[target.kind] }}
                    />
                    <span>{target.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {incoming.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Chamado por ({incoming.length})</span>
              <div className="flex flex-wrap gap-1.5">
                {incoming.map(source => (
                  <button
                    key={source.id}
                    onClick={() => onSelectNode(source)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/60 hover:bg-slate-700/80 border border-white/5 rounded-xl text-xs text-slate-200 transition-all hover:scale-[1.02]"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: KIND_COLORS[source.kind] }}
                    />
                    <span>{source.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
