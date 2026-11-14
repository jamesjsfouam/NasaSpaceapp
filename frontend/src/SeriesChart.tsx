import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { compact, type AnnualPoint, type Forecast } from './api'

const nf = (v: number) => v.toLocaleString('es', { maximumSignificantDigits: 4 })

/** Serie anual con, opcionalmente, una proyección oficial y nuestro escenario lineal. */
export function SeriesChart({ history, official, forecast, unit, officialLabel = 'Proyección oficial (ONU)' }: {
  history: AnnualPoint[]; official?: AnnualPoint[]; forecast?: Forecast | null; unit: string; officialLabel?: string
}) {
  const rows = new Map<number, Record<string, number | [number, number]>>()
  const at = (y: number) => rows.get(y) ?? rows.set(y, { year: y }).get(y)!
  history.forEach((p) => { at(p.year).history = p.mean })
  official?.forEach((p) => { at(p.year).official = p.mean })
  forecast?.points.forEach((p) => { at(p.year).scenario = p.value; at(p.year).band = [p.low, p.high] })
  const data = [...rows.values()].sort((a, b) => (a.year as number) - (b.year as number))
  const lastObserved = history.length ? history[history.length - 1].year : undefined

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} />
        <YAxis width={64} tickFormatter={compact}
          label={{ value: unit, angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: 12, fill: 'var(--muted)' } }} />
        <Tooltip formatter={(v) => (Array.isArray(v) ? `${nf(v[0])} a ${nf(v[1])}` : typeof v === 'number' ? nf(v) : v)} />
        <Legend />
        {lastObserved && forecast && <ReferenceLine x={lastObserved} stroke="var(--muted)" strokeDasharray="2 4" />}
        <Line name="Datos observados" dataKey="history" stroke="#3fd0e6" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        {official && official.length > 0 && (
          <Line name={officialLabel} dataKey="official" stroke="#34d399" strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
        )}
        {forecast && (
          <>
            <Area name="Escenario lineal: rango 95 %" dataKey="band" fill="#a78bfa" fillOpacity={0.18} stroke="none" isAnimationActive={false} connectNulls />
            <Line name="Escenario si el ritmo sigue igual" dataKey="scenario" stroke="#a78bfa" strokeWidth={2} strokeDasharray="2 3" dot={false} isAnimationActive={false} connectNulls />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
