import { useEffect, useState } from 'react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, fmt, pText, type Catalog, type RelateResponse } from './api'
import { ExplainPanel } from './Explain'

export type RelateQuery = {
  variable: string; lat: number; lon: number; start: number; label: string; country: string | null
}

const z = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1
  return xs.map((x) => (x - m) / sd)
}

export function RelateView({ cat, query }: { cat: Catalog; query: RelateQuery }) {
  const suggested = cat.indicators.find((i) => i.suggested_variable === query.variable) ?? cat.indicators[0]
  const [indicator, setIndicator] = useState(suggested.key)
  const [country, setCountry] = useState(query.country ?? 'NIC')
  const [data, setData] = useState<RelateResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(ind = indicator, cc = country) {
    setBusy(true); setError(null); setData(null)
    const place = query.label.split(',')[0]
    try {
      setData(await api<RelateResponse>(
        `/api/relate?variable=${query.variable}&indicator=${ind}&country=${cc}` +
        `&lat=${query.lat}&lon=${query.lon}&start=${query.start}&place=${encodeURIComponent(place)}`,
      ))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    run()
    // Solo al abrir la pestaña: después se recalcula con el botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const variable = cat.variables.find((v) => v.key === query.variable)
  const current = cat.indicators.find((i) => i.key === indicator)
  const rel = data?.relation

  const series = rel ? (() => {
    const ze = z(rel.points.map((p) => p.earth))
    const zi = z(rel.points.map((p) => p.indicator))
    return rel.points.map((p, k) => ({ year: p.year, earth: ze[k], indicator: zi[k] }))
  })() : []

  return (
    <div>
      <p>
        ¿Se relaciona <strong>{variable?.label.toLowerCase()}</strong> en {query.label} con lo que pasa en
        la sociedad o la economía del país? Elige un indicador del Banco Mundial.
      </p>
      <div className="relate-controls">
        <label>
          Indicador
          <select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            {cat.indicators.map((i) => <option key={i.key} value={i.key}>{i.label} ({i.unit})</option>)}
          </select>
        </label>
        <label>
          País
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {Object.entries(cat.countries).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button className="primary" onClick={() => run()} disabled={busy}>{busy ? 'Calculando…' : 'Comparar'}</button>
      </div>
      {current && <p className="definition">{current.definition}</p>}
      {busy && <p className="muted">Consultando NASA y el Banco Mundial (puede tardar)…</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {data && rel && (
        <>
          <div className={`verdict ${rel.significant ? 'yes' : 'no'}`}>
            <h2>{variable?.label} y {data.indicator.label.toLowerCase()}</h2>
            <p className="lead">{rel.interpretation}</p>
          </div>

          <div className="facts">
            <div>
              <span>Año a año (sin tendencias)</span>
              <strong>r = {fmt(rel.detrended_r, 2)} · {pText(rel.detrended_p)}</strong>
              <em>Relación {rel.strength}{rel.significant ? ', significativa' : ', no significativa'}</em>
            </div>
            <div>
              <span>Aparente (con tendencias)</span>
              <strong>r = {fmt(rel.raw_r, 2)} · {pText(rel.raw_p)}</strong>
              <em>{rel.trend_driven ? 'Engañosa: la explican las tendencias' : 'Similar a la de año a año'}</em>
            </div>
            <div>
              <span>Años comparados</span>
              <strong>{rel.n_years}</strong>
              <em>{rel.first_year}–{rel.last_year}</em>
            </div>
            <div>
              <span>Tendencia del indicador</span>
              {data.indicator_trend ? (
                <>
                  <strong>{fmt(data.indicator_trend.slope_per_decade)} {data.indicator.unit} / década</strong>
                  <em>{data.indicator_trend.significant ? 'Significativa' : 'No significativa'} ({pText(data.indicator_trend.mk_p)})</em>
                </>
              ) : <strong>Sin datos suficientes</strong>}
            </div>
          </div>

          {rel.warnings.length > 0 && <ul className="warnings">{rel.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

          <div className="charts">
            <div>
              <h3>Las dos series en la misma escala</h3>
              <p className="muted small">Cada serie se expresa en desviaciones respecto a su promedio para poder compararlas.</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="year" />
                  <YAxis width={36} />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : v)} />
                  <Legend />
                  <Line name={variable?.label ?? ''} dataKey="earth" stroke="#1f5fbf" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line name={data.indicator.label} dataKey="indicator" stroke="#c2570a" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3>Año a año, sin tendencias</h3>
              <p className="muted small">Cada punto es un año. Si forman una línea inclinada, hay relación.</p>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 8, right: 12, bottom: 16, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis type="number" dataKey="earth_detrended" name={variable?.label}
                    tickFormatter={(v: number) => fmt(v, 2)}
                    label={{ value: `${variable?.label} (${variable?.unit})`, position: 'insideBottom', offset: -8, style: { fontSize: 11, fill: 'var(--muted)' } }} />
                  <YAxis type="number" dataKey="indicator_detrended" name={data.indicator.label} width={52}
                    tickFormatter={(v: number) => fmt(v, 2)} />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? fmt(v) : v)}
                    labelFormatter={() => ''} />
                  <Scatter data={rel.points} fill="#1f5fbf" isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
          <ExplainPanel request={{ kind: 'relate', variable: query.variable, indicator, country, lat: query.lat, lon: query.lon, place: query.label.split(',')[0], start: query.start }} />
          <p className="muted small">
            Fuentes: NASA POWER{data.earth_source === 'muestra-local' ? ' (muestra local)' : ''} y Banco
            Mundial{data.indicator_source === 'muestra-local' ? ' (muestra local)' : ''}. Spearman año a año:
            ρ = {fmt(rel.detrended_rho, 2)} ({pText(rel.detrended_rho_p)}).
          </p>
        </>
      )}
    </div>
  )
}
