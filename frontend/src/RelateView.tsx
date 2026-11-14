import { useEffect, useState } from 'react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, type Catalog, type RelateResponse } from './api'
import { ExplainPanel } from './Explain'
import {
  fmtNum, formatRelationText, pTextLang, tIndicator, translateWarning, tUnit, tVariable,
  type AudienceMode, type Lang,
} from './i18n'

export type RelateQuery = {
  variable: string
  lat: number
  lon: number
  start: number
  label: string
  country: string | null
}

const z = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1
  return xs.map((x) => (x - m) / sd)
}

export function RelateView({
  cat,
  query,
  lang,
  mode,
}: {
  cat: Catalog
  query: RelateQuery
  lang: Lang
  mode: AudienceMode
}) {
  const suggested = cat.indicators.find((i) => i.suggested_variable === query.variable) ?? cat.indicators[0]
  const [indicator, setIndicator] = useState(suggested.key)
  const [country, setCountry] = useState(query.country ?? 'NIC')
  const [data, setData] = useState<RelateResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(ind = indicator, cc = country) {
    setBusy(true)
    setError(null)
    setData(null)
    const place = query.label.split(',')[0]
    try {
      setData(
        await api<RelateResponse>(
          `/api/relate?variable=${query.variable}&indicator=${ind}&country=${cc}` +
          `&lat=${query.lat}&lon=${query.lon}&start=${query.start}&place=${encodeURIComponent(place)}`,
        ),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rawVar = cat.variables.find((v) => v.key === query.variable)
  const variable = rawVar ? tVariable(rawVar, lang) : undefined
  const rawInd = cat.indicators.find((i) => i.key === indicator)
  const current = rawInd ? tIndicator(rawInd, lang) : undefined
  const dataInd = data ? tIndicator(data.indicator, lang) : undefined
  const rel = data?.relation

  const series = rel
    ? (() => {
        const ze = z(rel.points.map((p) => p.earth))
        const zi = z(rel.points.map((p) => p.indicator))
        return rel.points.map((p, k) => ({ year: p.year, earth: ze[k], indicator: zi[k] }))
      })()
    : []

  const copy = lang === 'es'
    ? {
        intro1: '¿Se mueve',
        intro2: 'al mismo ritmo que la sociedad o agricultura del país? Separamos la coincidencia de largo plazo de la relación real año a año.',
        indLabel: 'Indicador (Banco Mundial)',
        countryLabel: 'País',
        btn: 'Comparar',
        busyBtn: 'Calculando…',
        loading: 'Consultando NASA POWER y Banco Mundial…',
        y2y: 'Relación Real (Año a año, sin tendencias)',
        apparent: 'Relación Aparente (Con tendencias)',
        years: 'Años en común',
        indTrend: 'Tendencia del indicador',
        sig: 'significativa',
        notSig: 'no significativa',
        trapYes: 'Engañosa: la explican solo las tendencias',
        trapNo: 'Coherente con la relación año a año',
        noEnough: 'Sin datos suficientes',
        chart1Title: 'Las dos series en la misma escala',
        chart1Sub: 'Valores centrados alrededor del promedio local para comparar forma.',
        chart2Title: '¿Cuando un año sube el otro también?',
        chart2Sub: 'Cada punto es un año sin tendencia. Una nube inclinada indica relación real.',
      }
    : {
        intro1: 'Does',
        intro2: 'co-vary with agriculture or society? VERDICT separates deceptive long-term trend coincidences from real year-to-year coupling.',
        indLabel: 'Indicator (World Bank)',
        countryLabel: 'Country',
        btn: 'Compare',
        busyBtn: 'Computing…',
        loading: 'Querying NASA POWER and World Bank…',
        y2y: 'Real Coupling (Detrended year-to-year)',
        apparent: 'Apparent Link (With trends)',
        years: 'Overlapping years',
        indTrend: 'Indicator trend',
        sig: 'significant',
        notSig: 'not significant',
        trapYes: 'Deceptive: driven merely by shared trends',
        trapNo: 'Consistent with year-to-year link',
        noEnough: 'Insufficient data',
        chart1Title: 'Both series on the same scale',
        chart1Sub: 'Standardized around each series mean so shapes align visually.',
        chart2Title: 'Year-to-year scatter (detrended)',
        chart2Sub: 'Each dot is one year minus its trend. A tilted cloud signals genuine coupling.',
      }

  const strengthText = (s: string) => {
    if (lang === 'es') return s
    return { débil: 'weak', moderada: 'moderate', fuerte: 'strong' }[s] ?? s
  }

  return (
    <div className="studio-block">
      <p style={{ marginTop: 0 }}>
        {copy.intro1} <strong>{variable?.label.toLowerCase()}</strong> ({query.label}) {copy.intro2}
      </p>

      <div className="relate-controls">
        <label>
          {copy.indLabel}
          <select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            {cat.indicators.map((raw) => {
              const i = tIndicator(raw, lang)
              return <option key={i.key} value={i.key}>{i.label} ({i.unit})</option>
            })}
          </select>
        </label>
        <label>
          {copy.countryLabel}
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {Object.entries(cat.countries).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={() => run()} disabled={busy}>
          {busy ? copy.busyBtn : copy.btn}
        </button>
      </div>

      {current && <p className="definition">{current.definition}</p>}
      {busy && <p className="muted">{copy.loading}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {data && rel && dataInd && (
        <>
          <div className={`verdict ${rel.significant ? 'yes' : 'no'}`}>
            <h2>{variable?.label} × {dataInd.label}</h2>
            <p className="lead">
              {formatRelationText(rel, variable?.label ?? '', dataInd.label, query.label.split(',')[0], data.country_label, lang, mode)}
            </p>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-kicker">{copy.y2y}</span>
              <strong className="num kpi-val">r = {fmtNum(rel.detrended_r, lang, 2)}</strong>
              <div className="meter-track" style={{ margin: '6px 0' }}>
                <div
                  className="meter-fill"
                  style={{
                    width: `${Math.min(100, Math.abs(rel.detrended_r) * 100)}%`,
                    background: rel.significant ? 'var(--accent)' : 'var(--no)',
                  }}
                />
              </div>
              <em className="muted small">
                {strengthText(rel.strength)}, {rel.significant ? copy.sig : copy.notSig} ({pTextLang(rel.detrended_p, lang)})
              </em>
            </div>

            <div className="kpi-card">
              <span className="kpi-kicker">{copy.apparent}</span>
              <strong className="num kpi-val" style={{ color: rel.trend_driven ? 'var(--amber)' : 'var(--ink)' }}>
                r = {fmtNum(rel.raw_r, lang, 2)}
              </strong>
              <em className="muted small">{rel.trend_driven ? copy.trapYes : copy.trapNo}</em>
            </div>

            <div className="kpi-card">
              <span className="kpi-kicker">{copy.years}</span>
              <strong className="num kpi-val">{rel.n_years}</strong>
              <em className="muted small">{rel.first_year}–{rel.last_year}</em>
            </div>

            <div className="kpi-card">
              <span className="kpi-kicker">{copy.indTrend}</span>
              {data.indicator_trend ? (
                <>
                  <strong className="num kpi-val">
                    {fmtNum(data.indicator_trend.slope_per_decade, lang)} {tUnit(dataInd.unit, lang)}
                  </strong>
                  <em className="muted small">
                    {data.indicator_trend.significant ? copy.sig : copy.notSig} ({pTextLang(data.indicator_trend.mk_p, lang)})
                  </em>
                </>
              ) : (
                <strong>{copy.noEnough}</strong>
              )}
            </div>
          </div>

          {rel.warnings.length > 0 && (
            <ul className="warnings">
              {rel.warnings.map((w) => <li key={w}>{translateWarning(w, lang, mode)}</li>)}
            </ul>
          )}

          <div className="charts">
            <div className="chart-card">
              <h3>{copy.chart1Title}</h3>
              <p className="muted small">{copy.chart1Sub}</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="year" />
                  <YAxis width={36} />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : v)} />
                  <Legend />
                  <Line name={variable?.label ?? ''} dataKey="earth" stroke="#3fd0e6" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line name={dataInd.label} dataKey="indicator" stroke="#f59e42" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>{copy.chart2Title}</h3>
              <p className="muted small">{copy.chart2Sub}</p>
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart margin={{ top: 8, right: 12, bottom: 16, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis
                    type="number"
                    dataKey="earth_detrended"
                    name={variable?.label}
                    tickFormatter={(v: number) => fmtNum(v, lang, 2)}
                    label={{
                      value: `${variable?.label} (${variable?.unit})`,
                      position: 'insideBottom',
                      offset: -8,
                      style: { fontSize: 11, fill: 'var(--muted)' },
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="indicator_detrended"
                    name={dataInd.label}
                    width={52}
                    tickFormatter={(v: number) => fmtNum(v, lang, 2)}
                  />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? fmtNum(v, lang) : v)} labelFormatter={() => ''} />
                  <Scatter data={rel.points} fill="#3fd0e6" isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <ExplainPanel
            request={{
              kind: 'relate',
              variable: query.variable,
              indicator,
              country,
              lat: query.lat,
              lon: query.lon,
              place: query.label.split(',')[0],
              start: query.start,
            }}
            lang={lang}
          />
        </>
      )}
    </div>
  )
}
