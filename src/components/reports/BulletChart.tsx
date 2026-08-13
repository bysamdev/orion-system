import React from 'react';
import type { BulletKpi } from '@/lib/reports/types';

// Bullet Chart (Stephen Few): barra da medição sobre faixas qualitativas, com a
// meta marcada por um traço vertical.
//
// Feito em SVG puro em vez de Recharts porque a biblioteca não tem primitiva de
// bullet — montá-lo com ComposedChart exigiria empilhar eixos falsos, e trazer
// D3 só para isso não se paga. SVG direto ainda mantém a exportação vetorial do
// PDF funcionando igual aos demais gráficos.

interface Props {
  kpi: BulletKpi;
}

const ALTURA = 46;
const ALTURA_BARRA = 14;
const PAD_X = 4;

export const BulletChart: React.FC<Props> = ({ kpi }) => {
  const { label, value, target, unit, betterWhen, sampleSize } = kpi;

  // Escala: acomoda medição e meta com folga, para a barra nunca encostar na
  // borda e a meta ficar sempre visível dentro do desenho.
  const max = Math.max(value, target) * 1.25 || 1;
  const larguraPct = (n: number) => Math.max(0, Math.min(100, (n / max) * 100));

  const dentroDaMeta = betterWhen === 'lower' ? value <= target : value >= target;

  // Faixas qualitativas em torno da meta: bom / aceitável / ruim.
  const faixaBoa = betterWhen === 'lower' ? larguraPct(target) : 100;
  const faixaAceitavel = betterWhen === 'lower' ? larguraPct(target * 1.5) : 100;

  const corBarra = dentroDaMeta ? 'hsl(var(--success))' : 'hsl(var(--destructive))';

  const descricao = `${label}: ${value}${unit}, meta ${target}${unit}. ${
    dentroDaMeta ? 'Dentro da meta' : 'Fora da meta'
  }. Base de ${sampleSize} chamado${sampleSize === 1 ? '' : 's'}.`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground truncate">{label}</span>
        {/* Valor sempre como texto: a cor da barra nunca é o único portador da
            informação (WCAG 1.4.1). */}
        <span className="text-xs font-bold tabular-nums text-foreground shrink-0">
          {value}
          {unit}
          <span className="ml-1 font-normal text-muted-foreground">
            / meta {target}
            {unit}
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 100 ${ALTURA}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: ALTURA }}
        role="img"
        aria-label={descricao}
      >
        <title>{descricao}</title>

        {/* Faixas qualitativas (fundo) */}
        <rect x={0} y={PAD_X} width={100} height={ALTURA_BARRA + 8} rx={2} fill="hsl(var(--muted))" />
        {betterWhen === 'lower' && (
          <>
            <rect
              x={0}
              y={PAD_X}
              width={faixaAceitavel}
              height={ALTURA_BARRA + 8}
              rx={2}
              fill="hsl(var(--warning))"
              opacity={0.18}
            />
            <rect
              x={0}
              y={PAD_X}
              width={faixaBoa}
              height={ALTURA_BARRA + 8}
              rx={2}
              fill="hsl(var(--success))"
              opacity={0.18}
            />
          </>
        )}

        {/* Medição */}
        <rect
          x={0}
          y={PAD_X + 4}
          width={larguraPct(value)}
          height={ALTURA_BARRA}
          rx={2}
          fill={corBarra}
        />

        {/* Marcador da meta */}
        <line
          x1={larguraPct(target)}
          x2={larguraPct(target)}
          y1={PAD_X - 2}
          y2={PAD_X + ALTURA_BARRA + 14}
          stroke="hsl(var(--foreground))"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <p className="text-[10px] text-muted-foreground">
        {/* Símbolo textual + palavra: legível também em impressão P&B. */}
        {dentroDaMeta ? '✓ dentro da meta' : '✕ fora da meta'} · base {sampleSize} chamado
        {sampleSize === 1 ? '' : 's'}
      </p>
    </div>
  );
};

export default BulletChart;
