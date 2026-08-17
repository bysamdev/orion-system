import React from 'react';
import { X, Code2, ArrowRightLeft, Layers, Cpu, ShieldCheck, Activity, Copy, Check } from 'lucide-react';
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
  const [copied, setCopied] = React.useState(false);

  if (!node) return null;

  // Find incoming & outgoing edges with protocols
  const outgoingEdges = ARCH_EDGES.filter(e => e.source === node.id);
  const incomingEdges = ARCH_EDGES.filter(e => e.target === node.id);

  const handleCopy = () => {
    navigator.clipboard.writeText(node.sourceRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = {
    idle: { label: 'Disponível / Idle', bg: 'bg-slate-800 text-slate-300 border-white/10' },
    processing: { label: 'Em Processamento...', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' },
    success: { label: 'Saudável (200 OK)', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    error: { label: 'Alerta / Falha', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  }[status];

  return (
    <div className="absolute top-20 right-6 z-40 w-[420px] max-h-[calc(100vh-120px)] bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto transition-all animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3 bg-slate-800/40">
        <div className="flex items-start gap-3">
          <span
            className="size-5 rounded-full mt-0.5 shrink-0 shadow-lg ring-4 ring-white/10"
            style={{ backgroundColor: KIND_COLORS[node.kind] }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white leading-tight">{node.label}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-slate-300">
                {KIND_LABELS[node.kind]}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${statusBadge.bg}`}>
                {statusBadge.label}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-all"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 overflow-y-auto space-y-4">
        {/* Layer & Tech Badge */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-slate-800/60 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="size-3 text-sky-400" />
              Camada
            </span>
            <p className="text-xs font-semibold text-white truncate">{node.layer || 'Core Layer'}</p>
          </div>
          <div className="p-3 bg-slate-800/60 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Cpu className="size-3 text-purple-400" />
              Tecnologia
            </span>
            <p className="text-xs font-semibold text-sky-300 truncate">{node.tech || 'Standard Stack'}</p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Descrição Funcional</h3>
          <p className="text-xs text-slate-200 leading-relaxed bg-slate-800/50 p-3.5 rounded-2xl border border-white/5">
            {node.description}
          </p>
        </div>

        {/* Source Reference with Copy */}
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="size-3.5 text-indigo-400" />
            Arquivo no Repositório
          </h3>
          <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-2xl border border-white/5 font-mono text-xs text-indigo-300">
            <span className="truncate mr-2 select-all">{node.sourceRef}</span>
            <button
              onClick={handleCopy}
              className="p-1.5 bg-slate-700/60 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all shrink-0"
              title="Copiar caminho"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Outgoing Connections */}
        {outgoingEdges.length > 0 && (
          <div className="space-y-2 pt-1">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Dispara Requisições ({outgoingEdges.length})</span>
            </h3>
            <div className="space-y-1.5">
              {outgoingEdges.map(edge => {
                const target = NODE_BY_ID.get(edge.target);
                if (!target) return null;
                return (
                  <button
                    key={edge.id}
                    onClick={() => onSelectNode(target)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-800/50 hover:bg-slate-800/90 border border-white/5 hover:border-white/15 rounded-xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: KIND_COLORS[target.kind] }}
                      />
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                        {target.label}
                      </span>
                    </div>
                    {edge.protocol && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-700/60 text-sky-300 border border-white/5 shrink-0">
                        {edge.protocol}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Incoming Connections */}
        {incomingEdges.length > 0 && (
          <div className="space-y-2 pt-1">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Recebe Chamadas De ({incomingEdges.length})</span>
            </h3>
            <div className="space-y-1.5">
              {incomingEdges.map(edge => {
                const source = NODE_BY_ID.get(edge.source);
                if (!source) return null;
                return (
                  <button
                    key={edge.id}
                    onClick={() => onSelectNode(source)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-800/50 hover:bg-slate-800/90 border border-white/5 hover:border-white/15 rounded-xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: KIND_COLORS[source.kind] }}
                      />
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                        {source.label}
                      </span>
                    </div>
                    {edge.protocol && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-700/60 text-purple-300 border border-white/5 shrink-0">
                        {edge.protocol}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
