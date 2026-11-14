import { useState } from 'react'
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Forecast, Trend } from './api'
import { fmtNum, tUnit, UI, type AudienceMode, type Lang } from './i18n'

type Row = { x: number; monthly?: number; annual?: number; trend?: number; scenario?: number; band?: [number, number] }

/** Time-series chart with Simple (Annual + Trend) vs Full (+ Monthly anomalies) toggle. */
export function TrendChart({
  trend,
  forecast,
  lang,
  mode,
}: {
  trend: Trend
  forecast?: Forecast | null
  lang: Lang
  mode: AudienceMode
}) {
  const [userPref, setUserPref] = useState<'simple' | 'full' | null>(null)
  const viewMode = userPref ?? (mode === 'student' ? 'simple' : 'full')
  const showMonthly = viewMode === 'full'

  const s = trend.series
  if (!s) return null

  const c = UI[lang].phase3.chart
  const unitLabel = tUnit(trend.unit, lang)
  const offset = s.annual.reduce((a, p) => a + p.mean, 0) / s.annual.length

  const rows: Row[] = [
    ...(showMonthly
      ? s.monthly.map((p) => {
          const [y, m] = p.date.split('-').map(Number)
          return { x: y + (m - 0.5) / 12, monthly: p.anomaly }
        })
      : []),
    ...s.annual.map((p) => ({ x: p.year + 0.5, annual: p.mean - offset })),
    ...s.trend_line.map((p) => ({ x: p.year + 0.5, trend: p.mean - offset })),
    ...(forecast?.points ?? []).map((p) => ({
      x: p.year + 0.5,
      scenario: p.value - offset,
      band: [p.low - offset, p.high - offset] as [number, number],
    })),
  ].sort((a, b) => a.x - b.x)

  const last = forecast ? forecast.to_year + 1 : trend.last_year + 1
  const rangeJoin = lang === 'es' ? 'a' : 'to'

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title">{c.title}</h3>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {showMonthly ? c.guideFull : c.guideSimple}
          </p>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={viewMode === 'simple' ? 'on' : ''}
            onClick={() => setUserPref('simple')}
          >
            {c.simpleBtn}
          </button>
          <button
            type="button"
            className={viewMode === 'full' ? 'on' : ''}
            onClick={() => setUserPref('full')}
          >
            {c.fullBtn}
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={330}>
        <ComposedChart data={rows} margin={{ top: 10, right: 14, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[trend.first_year, last]}
            tickFormatter={(v: number) => String(Math.floor(v))}
            allowDecimals={false}
          />
          <YAxis
            width={58}
            tickFormatter={(v: number) => fmtNum(v, lang)}
            label={{
              value: `${c.yAxis} (${unitLabel})`,
              angle: -90,
              position: 'insideLeft',
              offset: 12,
              style: { fontSize: 12, fill: 'var(--muted)' },
            }}
          />
          <Tooltip
            formatter={(v) =>
              Array.isArray(v)
                ? `${fmtNum(Number(v[0]), lang)} ${rangeJoin} ${fmtNum(Number(v[1]), lang)}`
                : typeof v === 'number'
                  ? fmtNum(v, lang)
                  : v
            }
            labelFormatter={(x) => String(Math.floor(Number(x)))}
          />
          <Legend />
          {forecast && (
            <ReferenceLine
              x={trend.last_year + 1}
              stroke="var(--muted)"
              strokeDasharray="2 4"
              label={{ value: c.todayLabel, fontSize: 11, fill: 'var(--muted)' }}
            />
          )}
          {showMonthly && (
            <Line
              name={c.monthlyName}
              dataKey="monthly"
              stroke="#3b4a63"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Line
            name={c.annualName}
            dataKey="annual"
            stroke="#3fd0e6"
            strokeWidth={2.2}
            dot={{ r: 3.5 }}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            name={c.trendName}
            dataKey="trend"
            stroke="#f59e42"
            strokeWidth={2.8}
            dot={false}
            strokeDasharray="6 4"
            isAnimationActive={false}
            connectNulls
          />
          {forecast && (
            <>
              <Area
                name={c.bandName}
                dataKey="band"
                fill="#a78bfa"
                fillOpacity={0.2}
                stroke="none"
                isAnimationActive={false}
                connectNulls
              />
              <Line
                name={c.scenarioName}
                dataKey="scenario"
                stroke="#a78bfa"
                strokeWidth={2.5}
                strokeDasharray="2 3"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
