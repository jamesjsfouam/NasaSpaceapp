import { COLOR } from './theme'
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AnnualPoint, Forecast } from './api'
import { compactNum, fmtNum, tUnit, type Lang } from './i18n'

/** Annual series chart with optional UN official projection and linear scenario band. */
export function SeriesChart({
  history,
  official,
  forecast,
  unit,
  lang,
  officialLabel,
}: {
  history: AnnualPoint[]
  official?: AnnualPoint[]
  forecast?: Forecast | null
  unit: string
  lang: Lang
  officialLabel?: string
}) {
  const rows = new Map<number, Record<string, number | [number, number]>>()
  const at = (y: number) => rows.get(y) ?? rows.set(y, { year: y }).get(y)!
  history.forEach((p) => { at(p.year).history = p.mean })
  official?.forEach((p) => { at(p.year).official = p.mean })
  forecast?.points.forEach((p) => {
    at(p.year).scenario = p.value
    at(p.year).band = [p.low, p.high]
  })
  const data = [...rows.values()].sort((a, b) => (a.year as number) - (b.year as number))
  const lastObserved = history.length ? history[history.length - 1].year : undefined
  const u = tUnit(unit, lang)
  const rangeJoin = lang === 'es' ? 'a' : 'to'

  const labels = lang === 'es'
    ? {
        obs: 'Datos observados',
        off: officialLabel ?? 'Proyección oficial (ONU)',
        band: 'Escenario lineal: rango 95 %',
        scen: 'Escenario si el ritmo sigue igual',
      }
    : {
        obs: 'Observed data',
        off: officialLabel ?? 'Official UN projection',
        band: 'Linear scenario: 95% range',
        scen: 'Scenario if pace continues',
      }

  return (
    <ResponsiveContainer width="100%" height={310}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} />
        <YAxis
          width={68}
          tickFormatter={(v: number) => compactNum(v, lang)}
          label={{ value: u, angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: 12, fill: 'var(--muted)' } }}
        />
        <Tooltip
          formatter={(v) =>
            Array.isArray(v)
              ? `${fmtNum(Number(v[0]), lang, 4)} ${rangeJoin} ${fmtNum(Number(v[1]), lang, 4)}`
              : typeof v === 'number'
                ? fmtNum(v, lang, 4)
                : v
          }
        />
        <Legend />
        {lastObserved && forecast && <ReferenceLine x={lastObserved} stroke="var(--muted)" strokeDasharray="2 4" />}
        <Line name={labels.obs} dataKey="history" stroke={COLOR.observed} strokeWidth={2.2} dot={false} isAnimationActive={false} connectNulls />
        {official && official.length > 0 && (
          <Line name={labels.off} dataKey="official" stroke={COLOR.official} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
        )}
        {forecast && (
          <>
            <Area name={labels.band} dataKey="band" fill={COLOR.scenario} fillOpacity={0.18} stroke="none" isAnimationActive={false} connectNulls />
            <Line name={labels.scen} dataKey="scenario" stroke={COLOR.scenario} strokeWidth={2} strokeDasharray="2 3" dot={false} isAnimationActive={false} connectNulls />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
