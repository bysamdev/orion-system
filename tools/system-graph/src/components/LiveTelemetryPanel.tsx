import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Radio, Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { LiveTelemetryEvent } from '../types';
import { KIND_COLORS } from '../architecture';

interface LiveTelemetryPanelProps {
  events: LiveTelemetryEvent[];
  rps: number;
  activeCount: number;
}

export function LiveTelemetryPanel({ events, rps, activeCount }: LiveTelemetryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="absolute bottom-6 right-6 z-40 w-96 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto transition-all">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-white tracking-wide uppercase">Telemetria ao Vivo</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-white/5">
            {rps} req/s
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium">
            {activeCount} ativas
          </span>
          <button className="text-slate-400 hover:text-white transition-colors">
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 max-h-56 overflow-y-auto space-y-2 font-mono text-[11px]">
          {events.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs font-sans italic">
              Aguardando pacotes de rede...
            </div>
          ) : (
            events.slice(0, 20).map(evt => (
              <div
                key={evt.id}
                className="flex items-center justify-between gap-2 p-2 bg-slate-800/50 hover:bg-slate-800/80 rounded-xl border border-white/5 transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: KIND_COLORS[evt.sourceKind] }}
                  />
                  <div className="truncate text-slate-200">
                    <span className="font-semibold text-white">{evt.sourceLabel}</span>
                    <span className="text-slate-500 mx-1">➔</span>
                    <span className="text-sky-300">{evt.targetLabel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-white/5">
                    {evt.protocol.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {evt.latencyMs}ms
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
