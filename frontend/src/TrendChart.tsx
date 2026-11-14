import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Forecast, Trend } from './api'

type Row = { x: number; monthly?: number; annual?: number; trend?: number; scenario?: number; band?: [number, number] }

const nf = (v: number) => v.toLocaleString('es', { maximumSignificantDigits: 3 })

// Todo se dibuja como anomalía (valor menos el promedio del periodo) para que el ciclo
// estacional no tape la tendencia y las series compartan eje.
export function TrendChart({ trend, forecast }: { trend: Trend; forecast?: Forecast | null }) {
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
    ...(forecast?.points ?? []).map((p) => ({
      x: p.year + 0.5, scenario: p.value - offset, band: [p.low - offset, p.high - offset] as [number, number],
    })),
  ].sort((a, b) => a.x - b.x)
  const last = forecast ? forecast.to_year + 1 : trend.last_year + 1

  return (
    <ResponsiveContainer width="100%" height={330}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="x" type="number" domain={[trend.first_year, last]}
          tickFormatter={(v: number) => String(Math.floor(v))} allowDecimals={false} />
        <YAxis width={52} tickFormatter={nf}
          label={{ value: `Anomalía (${trend.unit})`, angle: -90, position: 'insideLeft', offset: 14, style: { fontSize: 12, fill: 'var(--muted)' } }} />
        <Tooltip formatter={(v) => (Array.isArray(v) ? `${nf(v[0])} a ${nf(v[1])}` : typeof v === 'number' ? nf(v) : v)}
          labelFormatter={(x) => String(Math.floor(Number(x)))} />
        <Legend />
        {forecast && <ReferenceLine x={trend.last_year + 1} stroke="var(--muted)" strokeDasharray="2 4" label={{ value: 'hoy', fontSize: 11, fill: 'var(--muted)' }} />}
        <Line name="Meses (sin estación)" dataKey="monthly" stroke="#9aa5b8" strokeWidth={1} dot={false}
          isAnimationActive={false} connectNulls />
        <Line name="Promedio anual" dataKey="annual" stroke="#1f5fbf" strokeWidth={2} dot={{ r: 3 }}
          isAnimationActive={false} connectNulls />
        <Line name="Tendencia (Theil–Sen)" dataKey="trend" stroke="#c2570a" strokeWidth={2.5} dot={false}
          strokeDasharray="6 4" isAnimationActive={false} connectNulls />
        {forecast && (
          <>
            <Area name="Escenario: rango del 95 %" dataKey="band" fill="#7b4fc4" fillOpacity={0.15} stroke="none"
              isAnimationActive={false} connectNulls />
            <Line name="Escenario si el ritmo sigue" dataKey="scenario" stroke="#7b4fc4" strokeWidth={2.5}
              strokeDasharray="2 3" dot={false} isAnimationActive={false} connectNulls />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
