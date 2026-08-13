import React from 'react';

// Gauge de KPI único em destaque (% de SLA cumprido).
//
// Arco em SVG puro: o RadialBarChart do Recharts resolveria, mas exige um
// domínio artificial e não desenha o marcador de meta, que é justamente o ponto
// do gráfico aqui. SVG direto também exporta melhor para vetor no PDF.

interface Props {
  /** Valor medido, 0-100. */
  value: number;
  /** Meta, 0-100. */
  target: number;
  label: string;
  /** Nº de itens que compõem a medição — exibido para honestidade estatística. */
  sampleSize: number;
}

const R = 70;
const CX = 90;
const CY = 82;
const ANG_INICIO = 180;
const ANG_FIM = 0;

function pontoNoArco(angGraus: number, raio: number) {
  const rad = (angGraus * Math.PI) / 180;
  return { x: CX + raio * Math.cos(rad), y: CY - raio * Math.sin(rad) };
}

/** Caminho de arco entre dois ângulos (semicírculo, sentido horário). */
function arco(de: number, ate: number, raio: number) {
  const p1 = pontoNoArco(de, raio);
  const p2 = pontoNoArco(ate, raio);
  const grande = Math.abs(ate - de) > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${raio} ${raio} 0 ${grande} 1 ${p2.x} ${p2.y}`;
}

const anguloPara = (pct: number) =>
  ANG_INICIO - (Math.max(0, Math.min(100, pct)) / 100) * (ANG_INICIO - ANG_FIM);

export const GaugeChart: React.FC<Props> = ({ value, target, label, sampleSize }) => {
  const atingiu = value >= target;
  const cor = atingiu ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  const semDados = sampleSize === 0;

  const descricao = semDados
    ? `${label}: sem chamados com SLA definido no período.`
    : `${label}: ${value}%, meta ${target}%. ${atingiu ? 'Meta atingida' : 'Abaixo da meta'}. Base de ${sampleSize} chamados.`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 108" className="w-full max-w-[220px]" role="img" aria-label={descricao}>
        <title>{descricao}</title>

        {/* Trilho */}
        <path
          d={arco(ANG_INICIO, ANG_FIM, R)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={16}
          strokeLinecap="round"
        />

        {/* Valor medido */}
        {!semDados && value > 0 && (
          <path
            d={arco(ANG_INICIO, anguloPara(value), R)}
            fill="none"
            stroke={cor}
            strokeWidth={16}
            strokeLinecap="round"
          />
        )}

        {/* Marcador da meta */}
        {!semDados && (
          <line
            x1={pontoNoArco(anguloPara(target), R - 11).x}
            y1={pontoNoArco(anguloPara(target), R - 11).y}
            x2={pontoNoArco(anguloPara(target), R + 11).x}
            y2={pontoNoArco(anguloPara(target), R + 11).y}
            stroke="hsl(var(--foreground))"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {/* Valor numérico sempre visível — não depende da cor do arco */}
        <text
          x={CX}
          y={CY - 12}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 30, fontWeight: 700 }}
        >
          {semDados ? '—' : `${value}%`}
        </text>
        <text
          x={CX}
          y={CY + 8}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 11 }}
        >
          {semDados ? 'sem dados' : `meta ${target}%`}
        </text>
      </svg>

      <p className="mt-1 text-xs font-semibold text-foreground text-center">{label}</p>
      <p className="text-[10px] text-muted-foreground text-center">
        {semDados
          ? 'nenhum chamado com SLA definido'
          : `${atingiu ? '✓ meta atingida' : '✕ abaixo da meta'} · base ${sampleSize} chamados`}
      </p>
    </div>
  );
};

export default GaugeChart;
