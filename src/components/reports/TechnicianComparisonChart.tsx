import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TechnicianComparison } from '@/lib/reports/types';

// Comparativo multidimensional de técnicos.
//
// Grouped Bar em vez de Radar: com eixos de naturezas diferentes (contagem e
// percentuais), o radar dificulta a leitura precisa de valor — que é o objetivo
// aqui. Duplo eixo Y separa a escala de volume da escala percentual.

interface Props {
  data: TechnicianComparison[];
}

/** Rótulo de valor no topo da barra: valor legível sem depender da cor. */
const rotulo = { position: 'top' as const, fontSize: 9, fill: 'hsl(var(--foreground))' };

export const TechnicianComparisonChart: React.FC<Props> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Nenhum chamado atribuído no período
      </div>
    );
  }

  // Se ninguém tem avaliação, a dimensão inteira sai do gráfico em vez de virar
  // uma fileira de zeros — zero leria como "satisfação péssima", não "sem dado".
  const temCsat = data.some((d) => d.csatPct !== null);

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: -12, bottom: 4 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
          <YAxis yAxisId="vol" tick={{ fontSize: 9 }} allowDecimals={false} />
          <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 9 }} />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '8px' }}
            formatter={(valor: number, nome: string, props: { payload?: TechnicianComparison }) => {
              if (nome === 'Satisfação') {
                const n = props.payload?.csatAmostra ?? 0;
                return [`${valor}% (${n} avaliaç${n === 1 ? 'ão' : 'ões'})`, nome];
              }
              if (nome === 'SLA cumprido') return [`${valor}%`, nome];
              return [valor, nome];
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />

          <Bar yAxisId="vol" dataKey="volume" name="Volume" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]}>
            <LabelList dataKey="volume" {...rotulo} />
          </Bar>
          <Bar yAxisId="pct" dataKey="slaPct" name="SLA cumprido" fill="hsl(var(--success))" radius={[3, 3, 0, 0]}>
            <LabelList dataKey="slaPct" formatter={(v: number) => `${v}%`} {...rotulo} />
          </Bar>
          {temCsat && (
            <Bar yAxisId="pct" dataKey="csatPct" name="Satisfação" fill="hsl(var(--warning))" radius={[3, 3, 0, 0]}>
              <LabelList
                dataKey="csatPct"
                formatter={(v: number | null) => (v === null ? '' : `${v}%`)}
                {...rotulo}
              />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      {!temCsat && (
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          Sem avaliações de satisfação no período — dimensão omitida.
        </p>
      )}
    </>
  );
};

export default TechnicianComparisonChart;
