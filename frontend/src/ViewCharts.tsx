import type { ReactNode } from 'react'
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fmtNum, VIEW, type Lang } from './i18n'
import { COLOR } from './theme'

export type VRow = {
  id: string
  label: ReactNode
  value: number
  /** Si hay límites, se dibuja un intervalo (bosque) con un punto; si no, una barra desde 0. */
  lo?: number
  hi?: number
  tone?: 'sig' | 'watch' | 'none' | 'plain'
  color?: string
  /** Texto a la derecha de la fila. */
  text?: ReactNode
  sub?: string
}

/** Filas de valores con eje común: gráfico de bosque (con IC 95 %) o barras divergentes desde 0. */
export function ValueRows({
  rows, lang, ariaLabel, domain, ticks,
}: {
  rows: VRow[]
  lang: Lang
  ariaLabel: string
  domain?: [number, number]
  ticks?: number[]
}) {
  const all = rows.flatMap((r) => [r.value, r.lo ?? r.value, r.hi ?? r.value, 0]).filter((x) => Number.isFinite(x))
  let [min, max] = domain ?? [Math.min(...all), Math.max(...all)]
  if (!domain) {
    const pad = (max - min || 1) * 0.08
    min -= pad
    max += pad
  }
  const span = max - min || 1
  const pos = (x: number) => Math.max(0, Math.min(100, ((x - min) / span) * 100))
  const zero = pos(0)
  const tk = ticks ?? [min, 0, max]
  return (
    <div className="vr" role="group" aria-label={ariaLabel}>
      {rows.map((r) => {
        const hasCI = r.lo !== undefined && r.hi !== undefined
        const left = Math.min(zero, pos(r.value))
        const width = Math.abs(pos(r.value) - zero)
        return (
          <div className="vr-row" key={r.id}>
            <div className="vr-label">{r.label}</div>
            <div className="vr-track">
              <span className="vr-zero" style={{ left: `${zero}%` }} aria-hidden="true" />
              {hasCI ? (
                <>
                  <span className="vr-ci" style={{ left: `${pos(r.lo!)}%`, width: `${Math.max(0.5, pos(r.hi!) - pos(r.lo!))}%`, background: r.color }} />
                  <span className="vr-dot" style={{ left: `${pos(r.value)}%`, background: r.color }} />
                </>
              ) : (
                <span
                  className={`vr-bar ${r.value >= 0 ? 'pos' : 'neg'} ${r.tone ?? 'plain'}`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%`, ...(r.color ? { background: r.color } : {}) }}
                />
              )}
            </div>
            <div className="vr-val num">
              {r.text}
              {r.sub && <small>{r.sub}</small>}
            </div>
          </div>
        )
      })}
      <div className="vr-axis" aria-hidden="true">
        <span />
        <div className="vr-axis-track">
          {tk.map((t, i) => (
            <span key={i} style={{ left: `${pos(t)}%` }}>{t === 0 ? VIEW[lang].axisZero : fmtNum(t, lang, 2)}</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  )
}

/** Leyenda de los tres estados del veredicto en barras. */
export function ToneLegend({ lang }: { lang: Lang }) {
  const v = VIEW[lang]
  return (
    <div className="vr-legend" aria-hidden="true">
      <span><i className="sig" />{v.sigLegend}</span>
      <span><i className="watch" />{v.watchLegend}</span>
      <span><i className="none" />{v.noneLegend}</span>
    </div>
  )
}

/** Fichas compactas (etiqueta + valor) con regla cian arriba, sin recuadro. */
export function StatCards({ items }: { items: { id: string; label: string; value: string }[] }) {
  return (
    <div className="kpi-grid stat-cards">
      {items.map((c) => (
        <div className="kpi-card" key={c.id}>
          <span className="kpi-kicker">{c.label}</span>
          <strong className="num kpi-val">{c.value}</strong>
        </div>
      ))}
    </div>
  )
}

const axisTick = { fontSize: 12, fill: 'var(--muted)' }

/** Residuo anual respecto a la tendencia ajustada. */
export function ResidualBars({ data, unit, lang }: { data: { year: number; resid: number }[]; unit: string; lang: Lang }) {
  const v = VIEW[lang].trend
  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="year" tick={axisTick} minTickGap={18} />
          <YAxis width={52} tick={axisTick} tickFormatter={(x: number) => fmtNum(x, lang, 2)} />
          <ReferenceLine y={0} stroke={COLOR.ink} />
          <Tooltip
            formatter={(x) => (typeof x === 'number' ? `${x > 0 ? '+' : ''}${fmtNum(x, lang, 3)} ${unit}` : x)}
            labelFormatter={(y) => String(y)}
          />
          <Bar dataKey="resid" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.year} fill={d.resid >= 0 ? COLOR.ink : COLOR.sage} stroke={COLOR.ink} strokeWidth={1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="vr-legend" aria-hidden="true">
        <span><i style={{ background: COLOR.ink }} />{v.residAbove}</span>
        <span><i style={{ background: COLOR.sage }} />{v.residBelow}</span>
      </div>
    </div>
  )
}

/** Valor del escenario lineal por año con su rango del 95 %. */
export function ScenarioBand({
  points, unit, lang,
}: { points: { year: number; value: number; low: number; high: number }[]; unit: string; lang: Lang }) {
  const v = VIEW[lang].trend
  const data = points.map((p) => ({ year: p.year, value: p.value, band: [p.low, p.high] as [number, number] }))
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="year" tick={axisTick} type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} />
        <YAxis width={56} tick={axisTick} tickFormatter={(x: number) => fmtNum(x, lang, 3)} />
        <Tooltip
          formatter={(x) =>
            Array.isArray(x)
              ? `${fmtNum(Number(x[0]), lang, 3)} – ${fmtNum(Number(x[1]), lang, 3)} ${unit}`
              : typeof x === 'number' ? `${fmtNum(x, lang, 3)} ${unit}` : x}
          labelFormatter={(y) => String(y)}
        />
        <Area name={v.scenBand} dataKey="band" fill={COLOR.scenario} fillOpacity={0.2} stroke="none" isAnimationActive={false} />
        <Line name={v.scenValue} dataKey="value" stroke={COLOR.scenario} strokeWidth={2.6} dot={{ r: 3.5 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Nubosidad de cada escena satelital. */
export function CloudBars({ data, label, lang }: { data: { year: number; cloud: number }[]; label: string; lang: Lang }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="year" tick={axisTick} minTickGap={14} />
        <YAxis width={40} tick={axisTick} unit="%" />
        <Tooltip formatter={(x) => (typeof x === 'number' ? `${fmtNum(x, lang, 3)} %` : x)} labelFormatter={(y) => `${label}: ${y}`} />
        <Bar dataKey="cloud" fill={COLOR.sage} stroke={COLOR.ink} strokeWidth={1} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
