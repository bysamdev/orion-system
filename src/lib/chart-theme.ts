// Estilo único das dicas (tooltips) dos gráficos.
//
// O Recharts pinta o texto da dica com um cinza-escuro fixo (#333) quando
// ninguém manda cor: no tema escuro dava texto escuro sobre fundo escuro, e a
// dica ficava ilegível. Definir a cor junto do fundo, em um lugar só, evita
// que o próximo gráfico repita o problema.

export const ESTILO_DA_DICA = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'hsl(var(--foreground))',
  },
  itemStyle: { color: 'hsl(var(--foreground))' },
  labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
} as const;

// Texto escrito por cima de fatias e barras coloridas: o contorno escuro
// garante leitura tanto sobre cor clara quanto sobre cor forte.
export const TEXTO_SOBRE_COR = {
  fill: '#ffffff',
  stroke: 'rgba(0, 0, 0, 0.65)',
  strokeWidth: 3,
  paintOrder: 'stroke',
} as const;
