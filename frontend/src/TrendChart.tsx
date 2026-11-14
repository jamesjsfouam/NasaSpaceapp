import {
  CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Trend } from './api'

type Row = { x: number; monthly?: number; annual?: number; trend?: number }

// Todo se dibuja como anomalía (valor menos el promedio del periodo) para que el ciclo
// estacional no tape la tendencia y las tres series compartan eje.
export function TrendChart({ trend }: { trend: Trend }) {
  const s = trend.series
  if (!s) return null
  const offset = s.annual.reduce((a, p) => a + p.mean, 0) / s.annual.length
  const rows: Row[] = [
    ...s.monthly.map((p) => {
      const [y, m] = p.date.split('-').map(Number)
      return { x: y + (m - 0.5) / 12, monthly: p.anomaly }
    }),
    ...s.annual.map((p) => ({ x: p.year + 0.5, annual: p.mean - offset })),
    ...s.trend_line.map((p) => ({ x: p.year + 0.5, trend: p.mean - offset })),
  ].sort((a, b) => a.x - b.x)

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="x" type="number" domain={[trend.first_year, trend.last_year + 1]}
          tickFormatter={(v: number) => String(Math.floor(v))} allowDecimals={false} />
        <YAxis width={52} tickFormatter={(v: number) => v.toLocaleString('es', { maximumSignificantDigits: 3 })}
          label={{ value: `Anomalía (${trend.unit})`, angle: -90, position: 'insideLeft', offset: 14, style: { fontSize: 12, fill: 'var(--muted)' } }} />
        <Tooltip formatter={(v) => (typeof v === 'number' ? v.toLocaleString('es', { maximumSignificantDigits: 3 }) : v)}
          labelFormatter={(x) => Number(x).toFixed(2)} />
        <Legend />
        <Line name="Meses (sin estación)" dataKey="monthly" stroke="#9aa5b8" strokeWidth={1} dot={false}
          isAnimationActive={false} connectNulls />
        <Line name="Promedio anual" dataKey="annual" stroke="#1f5fbf" strokeWidth={2} dot={{ r: 3 }}
          isAnimationActive={false} connectNulls />
        <Line name="Tendencia (Theil–Sen)" dataKey="trend" stroke="#c2570a" strokeWidth={2.5} dot={false}
          strokeDasharray="6 4" isAnimationActive={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
