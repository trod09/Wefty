// lib/chartTheme.js
// Tema único para todos los gráficos de Recharts (Wefty).
// Serie principal = acento verde petróleo. Cero azul. Todo en strings
// var(--…) para que los gráficos se adapten solos a claro/oscuro.

export const chartColors = {
  // Series categóricas: petróleo + familia verde + acentos puntuales.
  series: [
    'var(--accent)',
    'var(--green-2)',
    'var(--green-3)',
    'var(--amber)',
    'var(--violet)',
  ],
  // Para áreas/barras con relleno suave.
  fill: 'var(--accent)',
  fillOpacity: 0.12,
  // Escala secuencial (heatmaps, densidad): de claro a petróleo.
  scale: ['var(--green-4)', 'var(--green-3)', 'var(--green-2)', 'var(--green-1)'],
};

// Props reutilizables — se hacen spread en los componentes de Recharts.
export const axisProps = {
  tick: { fill: 'var(--text-tertiary)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--divider)' },
  style: { fontVariantNumeric: 'tabular-nums' },
};

export const gridProps = {
  stroke: 'var(--divider)',
  strokeDasharray: '0',
  vertical: false,
};

export const tooltipStyle = {
  contentStyle: {
    background: 'var(--tooltip-bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  labelStyle: { color: 'var(--text-secondary)', fontSize: 12 },
  cursor: { fill: 'var(--fill-chart-cursor)' },
};

// Helper: color de serie por índice (cicla por la paleta).
export const seriesColor = (i) => chartColors.series[i % chartColors.series.length];
