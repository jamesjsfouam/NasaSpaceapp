import { useEffect, useState } from 'react'
import { COLOR } from './theme'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, type Catalog, type RelateResponse } from './api'
import { ExplainPanel } from './Explain'
import { DataTable, SectionHead, type Column } from './DataTable'
import {
  fmtNum, fmtProb, formatRelationText, pTextLang, TBL, tIndicator, translateWarning, tUnit, tVariable,
  type Lang,
} from './i18n'
import type { RelationPoint } from './api'

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
}: {
  cat: Catalog
  query: RelateQuery
  lang: Lang
}) {
  const suggested = cat.indicators.find((i) => i.suggested_variable === query.variable) ?? cat.indicators[0]
  const [indicator, setIndicator] = useState(suggested.key)
  const [country, setCountry] = useState(query.country ?? 'NIC')
  const [lag, setLag] = useState(0)
  const [excludeShock, setExcludeShock] = useState(false)
  const [data, setData] = useState<RelateResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(ind = indicator, cc = country, l = lag, ex = excludeShock) {
    setBusy(true)
    setError(null)
    setData(null)
    const place = query.label.split(',')[0]
    try {
      setData(
        await api<RelateResponse>(
          `/api/relate?variable=${query.variable}&indicator=${ind}&country=${cc}` +
          `&lat=${query.lat}&lon=${query.lon}&start=${query.start}&place=${encodeURIComponent(place)}` +
          `&lag=${l}&exclude_2020_2021=${ex}`,
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
        lagLabel: 'Rezago temporal',
        shockLabel: 'Excluir choque 2020–2021',
        spatialBadge: 'Validez espacial: 1 punto (~50 km) vs agregado nacional',
      }
    : {
        intro1: 'Does',
        intro2: 'co-vary with agriculture or society? DATEX separates deceptive long-term trend coincidences from real year-to-year coupling.',
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
        lagLabel: 'Time lag',
        shockLabel: 'Exclude 2020–2021 shock',
        spatialBadge: 'Spatial validity: 1 point (~50 km) vs national aggregate',
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
        <label>
          {copy.lagLabel}
          <select value={lag} onChange={(e) => setLag(Number(e.target.value))}>
            <option value={0}>Lag 0</option>
            <option value={1}>Lag 1 ({lang === 'es' ? '1 año' : '1 yr'})</option>
            <option value={2}>Lag 2 ({lang === 'es' ? '2 años' : '2 yrs'})</option>
          </select>
        </label>
        <label className="check-inline" style={{ alignSelf: 'end', paddingBottom: 6 }}>
          <input type="checkbox" checked={excludeShock} onChange={(e) => setExcludeShock(e.target.checked)} />
          <span>{copy.shockLabel}</span>
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
            <div className="row">
              <h2 style={{ margin: 0 }}>{variable?.label} × {dataInd.label}</h2>
              <span className="badge not_yet">{rel.spatial_note || copy.spatialBadge}</span>
            </div>
            <p className="lead">
              {formatRelationText(rel, variable?.label ?? '', dataInd.label, query.label.split(',')[0], data.country_label, lang)}
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
              {rel.warnings.map((w) => <li key={w}>{translateWarning(w, lang)}</li>)}
            </ul>
          )}

          {(() => {
            const tb = TBL[lang]
            const tr = tb.rel
            const vr = VIEW[lang].rel
            const rr = (id: string, label: string, r: number, p: number): VRow => ({
              id, label, value: r, tone: id === 'raw' ? 'none' : 'sig',
              text: `r = ${r > 0 ? '+' : ''}${fmtNum(r, lang, 2)}`, sub: `p ${fmtProb(p, lang)}`,
            })
            return (
              <SectionView
                id="rel-main" lang={lang} title={vr.title}
                chart={
                  <div className="view-stack">
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
                            <Line name={variable?.label ?? ''} dataKey="earth" stroke={COLOR.observed} strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line name={dataInd.label} dataKey="indicator" stroke={COLOR.trend} strokeWidth={2} dot={false} isAnimationActive={false} />
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
                            <Scatter data={rel.points} fill={COLOR.observed} isAnimationActive={false} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="view-stack" style={{ gap: 10 }}>
                      <p className="view-subtitle">{vr.corrTitle}</p>
                      <ValueRows
                        lang={lang} ariaLabel={vr.corrTitle} domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]}
                        rows={[rr('raw', tr.raw, rel.raw_r, rel.raw_p), rr('det', tr.detr, rel.detrended_r, rel.detrended_p)]}
                      />
                      <p className="view-note">{vr.corrNote}</p>
                    </div>
                  </div>
                }
                table={<RelTables rel={rel} variable={variable} dataInd={dataInd} lang={lang} />}
              />
            )
          })()}

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

/** Tablas de la relación: correlaciones, parámetros y pares por año. */
function RelTables({ rel, variable, dataInd, lang }: {
  rel: Relation
  variable: { label: string; unit: string } | undefined
  dataInd: { label: string; unit: string } | undefined
  lang: Lang
}) {
    const tb = TBL[lang]
    const tr = tb.rel
    type CorrRow = { id: string; measure: string; r: number; p: number; rho: number | null; rhoP: number | null }
    const corr: CorrRow[] = [
      { id: 'raw', measure: tr.raw, r: rel.raw_r, p: rel.raw_p, rho: null, rhoP: null },
      { id: 'det', measure: tr.detr, r: rel.detrended_r, p: rel.detrended_p, rho: rel.detrended_rho, rhoP: rel.detrended_rho_p },
    ]
    const num = (x: number | null, d = 2) => (x === null || !Number.isFinite(x) ? tb.na : fmtNum(x, lang, d))
    const prob = (x: number | null) => (x === null || !Number.isFinite(x) ? tb.na : fmtProb(x, lang))
    const corrCols: Column<CorrRow>[] = [
      { id: 'm', header: tr.cols[0], cell: (r) => r.measure, csv: (r) => r.measure },
      { id: 'r', header: tr.cols[1], align: 'right', cell: (r) => num(r.r), csv: (r) => r.r },
      { id: 'p', header: tr.cols[2], align: 'right', cell: (r) => prob(r.p), csv: (r) => r.p },
      { id: 'rho', header: tr.cols[3], align: 'right', cell: (r) => num(r.rho), csv: (r) => r.rho },
      { id: 'rp', header: tr.cols[4], align: 'right', cell: (r) => prob(r.rhoP), csv: (r) => r.rhoP },
    ]
    type PRow = { id: string; name: string; value: string }
    const excluded = rel.excluded_years ?? []
    const params: PRow[] = [
      { id: 'lag', name: tr.lag, value: String(rel.lag_years ?? 0) },
      { id: 'n', name: tr.nYears, value: `${rel.n_years} (${rel.first_year}–${rel.last_year})` },
      { id: 'ex', name: tr.excluded, value: excluded.length ? excluded.join(', ') : tb.none },
    ]
    const paramCols: Column<PRow>[] = [
      { id: 'n', header: tr.paramsCols[0], cell: (r) => r.name },
      { id: 'v', header: tr.paramsCols[1], align: 'right', cell: (r) => r.value },
    ]
    const pairCols: Column<RelationPoint>[] = [
      { id: 'y', header: tr.pairsCols[0], cell: (r) => r.year, csv: (r) => r.year },
      { id: 'e', header: `${tr.pairsCols[1]} (${variable?.unit ?? ''})`, align: 'right', cell: (r) => fmtNum(r.earth, lang, 4), csv: (r) => r.earth },
      { id: 'i', header: `${tr.pairsCols[2]} (${dataInd.unit})`, align: 'right', cell: (r) => fmtNum(r.indicator, lang, 4), csv: (r) => r.indicator },
      { id: 'ed', header: tr.pairsCols[3], align: 'right', cell: (r) => fmtNum(r.earth_detrended, lang, 3), csv: (r) => r.earth_detrended },
      { id: 'id', header: tr.pairsCols[4], align: 'right', cell: (r) => fmtNum(r.indicator_detrended, lang, 3), csv: (r) => r.indicator_detrended },
    ]
    return (
      <section className="stat-stack" aria-label={tr.title}>
        <DataTable columns={corrCols} rows={corr} rowKey={(r) => r.id} ariaLabel={tr.title} csvName={tr.fileCorr} csvLabel={tb.csv} />
        <div className="stat-sub">
          <h4 className="stat-sub-title">{tr.paramsTitle}</h4>
          <DataTable columns={paramCols} rows={params} rowKey={(r) => r.id} ariaLabel={tr.paramsTitle} />
        </div>
        {rel.interpretation && (
          <p className="small" style={{ margin: 0 }}><strong>{tr.interp}: </strong>{rel.interpretation}</p>
        )}
        <div className="stat-sub">
          <h4 className="stat-sub-title">{tr.pairsTitle}</h4>
          <DataTable
            columns={pairCols} rows={rel.points} rowKey={(r) => String(r.year)} ariaLabel={tr.pairsTitle}
            sticky maxHeight={320} csvName={tr.filePairs} csvLabel={tb.csv}
          />
        </div>
      </section>
    )
}
