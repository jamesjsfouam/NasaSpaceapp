import { useEffect, useState } from 'react'
import { COLOR } from './theme'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, DIRECTION_ARROW, type Place, type Region, type TrendResponse } from './api'
import { DataTable, type Column } from './DataTable'
import { SectionView } from './ViewSwitch'
import { ValueRows, type VRow } from './ViewCharts'
import {
  certaintyInfo, fmtNum, fmtProb, TBL, tRegion, tUnit, VIEW, verdictLabel, type Lang,
} from './i18n'
import { commonYears, diffs, pearson, pFromPearson, pFromZ, seFromCI } from './stats'

type Spot = { lat: number; lon: number; label: string }

/** Side-by-side comparison of the same variable across two places on Earth. */
export function ComparePlaces({
  variable,
  start,
  a,
  second,
  onSecond,
  regions,
  lang,
  onPickOnGlobe,
}: {
  variable: string
  start: number
  a: Spot
  second: Spot | null
  onSecond: (s: Spot | null) => void
  regions: Region[]
  lang: Lang
  onPickOnGlobe: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [pair, setPair] = useState<[TrendResponse, TrendResponse] | null>(null)
  const [b, setB] = useState<Spot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    setError(null)
    try {
      setResults(await api<Place[]>(`/api/places/search?q=${encodeURIComponent(q)}`))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    if (second) compareWith(second)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [second?.lat, second?.lon, variable, start])

  async function compareWith(spot: Spot) {
    setB(spot)
    setBusy(true)
    setError(null)
    setResults([])
    try {
      const [ra, rb] = await Promise.all(
        [a, spot].map((s) =>
          api<TrendResponse>(`/api/trend?variable=${variable}&lat=${s.lat}&lon=${s.lon}&start=${start}`),
        ),
      )
      setPair([ra, rb])
    } catch (e) {
      setError((e as Error).message)
      setPair(null)
    } finally {
      setBusy(false)
    }
  }

  const series = pair
    ? (() => {
        const z = (pts: { year: number; mean: number }[]) => {
          const m = pts.reduce((s, p) => s + p.mean, 0) / pts.length
          const sd = Math.sqrt(pts.reduce((s, p) => s + (p.mean - m) ** 2, 0) / pts.length) || 1
          return new Map(pts.map((p) => [p.year, (p.mean - m) / sd]))
        }
        const za = z(pair[0].result.series?.annual ?? [])
        const zb = z(pair[1].result.series?.annual ?? [])
        return [...new Set([...za.keys(), ...zb.keys()])]
          .sort()
          .map((y) => ({ year: y, a: za.get(y), b: zb.get(y) }))
      })()
    : []

  const copy = lang === 'es'
    ? {
        intro: 'Compara',
        intro2: 'con cualquier otro lugar del mundo para ver cómo la misma variable puede comportarse de manera opuesta.',
        placeholder: 'Buscar 2.ª ciudad o región (ej.: Svalbard, Lima, Nairobi…)',
        searchBtn: 'Buscar',
        globeBtn: 'Elegir en el Planeta 3D',
        quickTitle: 'O prueba comparando con una región clave:',
        busy: 'Calculando ambas tendencias…',
        perDec: '/ década',
        chartNote: 'Series estandarizadas (desviaciones respecto a la media local) para comparar la forma y dirección de ambos lugares en la misma gráfica.',
      }
    : {
        intro: 'Compare',
        intro2: 'with any other place on Earth to see how the exact same variable can move in opposite directions.',
        placeholder: 'Search 2nd city or region (e.g., Svalbard, Lima, Nairobi…)',
        searchBtn: 'Search',
        globeBtn: 'Pick on 3D Planet',
        quickTitle: 'Or compare quickly with a reference biome:',
        busy: 'Computing both trends…',
        perDec: '/ decade',
        chartNote: 'Standardized annual averages (z-scores around each location mean) so both trajectories can be compared cleanly side by side.',
      }

  // ---- tablas numéricas (todo se calcula en el cliente con lo que ya devuelve la API)
  const tb = TBL[lang]
  const tc = tb.compare
  type MRow = { id: string; measure: string; a: string; b: string; ra: string | number | null; rb: string | number | null }
  const measureRows: MRow[] = pair
    ? (() => {
        const [ta, tbb] = [pair[0].result, pair[1].result]
        const sg = (x: number) => `${x > 0 ? '+' : ''}${fmtNum(x, lang)}`
        const ci = (t: typeof ta) => `${fmtNum(t.ci_low_per_decade, lang)} ${tb.to} ${fmtNum(t.ci_high_per_decade, lang)}`
        const pc = (t: typeof ta) => (t.percent_change === null ? tb.na : `${t.percent_change > 0 ? '+' : ''}${fmtNum(t.percent_change, lang, 3)} %`)
        const cert = (t: typeof ta) => certaintyInfo(t.mk_p, t.verdict, lang).headline
        const u = (t: typeof ta) => tUnit(t.unit, lang)
        const mk = (id: string, measure: string, f: (t: typeof ta) => string, raw?: (t: typeof ta) => string | number | null): MRow => ({
          id, measure, a: f(ta), b: f(tbb), ra: raw ? raw(ta) : f(ta), rb: raw ? raw(tbb) : f(tbb),
        })
        return [
          mk('slope', tc.slope, (t) => `${sg(t.slope_per_decade)} ${u(t)}`, (t) => t.slope_per_decade),
          mk('ci', tc.ci, ci),
          mk('p', tc.p, (t) => fmtProb(t.mk_p, lang), (t) => t.mk_p),
          mk('total', tc.total, (t) => `${sg(t.total_change)} ${u(t)}`, (t) => t.total_change),
          mk('pct', tc.pct, pc, (t) => t.percent_change),
          mk('years', tc.years, (t) => String(t.n_years), (t) => t.n_years),
          mk('cert', tc.cert, cert),
          mk('verdict', tc.verdict, (t) => verdictLabel(t.verdict, lang)),
        ]
      })()
    : []
  const measureCols: Column<MRow>[] = [
    { id: 'm', header: tc.cols[0], cell: (r) => r.measure, csv: (r) => r.measure },
    { id: 'a', header: a.label, align: 'right', cell: (r) => r.a, csv: (r) => r.ra },
    { id: 'b', header: b?.label ?? tc.cols[2], align: 'right', cell: (r) => r.b, csv: (r) => r.rb },
  ]

  type RRow = { id: string; measure: string; value: string; raw: number | null; p: string; praw: number | null; read: string }
  const relRows: RRow[] = pair
    ? (() => {
        const [ta, tbb] = [pair[0].result, pair[1].result]
        const out: RRow[] = []
        const sA = seFromCI(ta.ci_low_per_decade, ta.ci_high_per_decade)
        const sB = seFromCI(tbb.ci_low_per_decade, tbb.ci_high_per_decade)
        const dSlope = ta.slope_per_decade - tbb.slope_per_decade
        const se = Math.hypot(sA, sB)
        const pDiff = se > 0 ? pFromZ(dSlope / se) : NaN
        out.push({
          id: 'diff', measure: tc.diff, value: `${dSlope > 0 ? '+' : ''}${fmtNum(dSlope, lang)} ${tUnit(ta.unit, lang)}`,
          raw: dSlope, p: Number.isFinite(pDiff) ? fmtProb(pDiff, lang) : tb.na, praw: Number.isFinite(pDiff) ? pDiff : null, read: tc.diffRead,
        })
        const cy = commonYears(ta.series?.annual ?? [], tbb.series?.annual ?? [])
        const rRaw = pearson(cy.xs, cy.ys)
        const pRaw = pFromPearson(rRaw, cy.xs.length)
        const dx = diffs(cy.xs)
        const dy = diffs(cy.ys)
        const rD = pearson(dx, dy)
        const pD = pFromPearson(rD, dx.length)
        const rowOf = (id: string, measure: string, r: number, p: number, n: number, read: string): RRow => ({
          id, measure, value: Number.isFinite(r) ? `r = ${fmtNum(r, lang, 2)} (n = ${n} ${tc.common})` : tb.na,
          raw: Number.isFinite(r) ? r : null, p: Number.isFinite(p) ? fmtProb(p, lang) : tb.na, praw: Number.isFinite(p) ? p : null, read,
        })
        out.push(rowOf('raw', tc.pearsonRaw, rRaw, pRaw, cy.xs.length, tc.rawRead))
        out.push(rowOf('d', tc.pearsonDiff, rD, pD, dx.length, tc.diffsRead))
        return out
      })()
    : []
  const relCols: Column<RRow>[] = [
    { id: 'm', header: tc.relCols[0], cell: (r) => r.measure, csv: (r) => r.measure },
    { id: 'v', header: tc.relCols[1], align: 'right', cell: (r) => r.value, csv: (r) => r.raw },
    { id: 'p', header: tc.relCols[2], align: 'right', cell: (r) => r.p, csv: (r) => r.praw },
    { id: 'r', header: tc.relCols[3], cellClass: 'read', cell: (r) => <span className="muted">{r.read}</span>, csv: (r) => r.read },
  ]

  return (
    <div className="studio-block">
      <div className="studio-intro-row">
        <p style={{ margin: 0 }}>
          {copy.intro} <strong>{a.label}</strong> {copy.intro2}
        </p>
        <button type="button" className="secondary" onClick={onPickOnGlobe}>
          {copy.globeBtn}
        </button>
      </div>

      <div className="search" style={{ marginTop: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={copy.placeholder}
          onKeyDown={(e) => e.key === 'Enter' && q.length > 1 && search()}
        />
        <button className="secondary" onClick={search} disabled={q.length < 2}>
          {copy.searchBtn}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="results">
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button className="link" onClick={() => onSecond({ lat: p.lat, lon: p.lon, label: p.name })}>
                {p.name}{p.admin1 ? `, ${p.admin1}` : ''}{p.country ? ` (${p.country})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="quick-compare">
        <span className="muted small">{copy.quickTitle}</span>
        <div className="chips">
          {regions.map((raw) => {
            const r = tRegion(raw, lang)
            return (
              <button
                key={r.id}
                className={`chip ${b && Math.abs(b.lat - r.lat) < 0.05 ? 'on' : ''}`}
                onClick={() => onSecond({ lat: r.lat, lon: r.lon, label: r.label })}
              >
                {r.label.split(',')[0]}
              </button>
            )
          })}
        </div>
      </div>

      {busy && <p className="muted">{copy.busy}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {pair && b && (
        <>
          <div className="pair">
            {pair.map((r, i) => {
              const t = r.result
              const cert = certaintyInfo(t.mk_p, t.verdict, lang)
              const unit = tUnit(t.unit, lang)
              return (
                <div key={i} className={`verdict ${t.verdict} ${i === 0 ? 'side-a' : 'side-b'}`}>
                  <div className="row">
                    <h3>{i === 0 ? a.label : b.label}</h3>
                    <span className={`badge ${t.verdict}`}>{verdictLabel(t.verdict, lang)}</span>
                  </div>
                  <p className="compare-rate num">
                    {DIRECTION_ARROW[t.direction]} {t.slope_per_decade > 0 ? '+' : ''}
                    {fmtNum(t.slope_per_decade, lang)} {unit} {copy.perDec}
                  </p>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    {cert.headline} · {cert.detail}
                  </p>
                </div>
              )
            })}
          </div>

          <SectionView
            id="compare-main" lang={lang} title={VIEW[lang].compare.title}
            chart={
              <div className="view-stack">
                <div>
                  <ResponsiveContainer width="100%" height={270}>
                    <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis dataKey="year" />
                      <YAxis width={38} />
                      <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : v)} />
                      <Legend />
                      <Line name={a.label} dataKey="a" stroke={COLOR.spotA} strokeWidth={2.4} dot={false} isAnimationActive={false} />
                      <Line name={b.label} dataKey="b" stroke={COLOR.spotB} strokeWidth={2.4} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="muted small" style={{ margin: '8px 0 0' }}>{copy.chartNote}</p>
                </div>
                <div className="view-stack" style={{ gap: 10 }}>
                  <p className="view-subtitle">{VIEW[lang].compare.slopeTitle}</p>
                  <ValueRows
                    lang={lang} ariaLabel={VIEW[lang].compare.slopeTitle}
                    rows={pair.map((r, i): VRow => ({
                      id: i === 0 ? 'a' : 'b',
                      label: i === 0 ? a.label : b.label,
                      value: r.result.slope_per_decade,
                      lo: r.result.ci_low_per_decade,
                      hi: r.result.ci_high_per_decade,
                      color: i === 0 ? COLOR.spotA : COLOR.spotB,
                      text: `${r.result.slope_per_decade > 0 ? '+' : ''}${fmtNum(r.result.slope_per_decade, lang)} ${tUnit(r.result.unit, lang)}`,
                      sub: `p ${fmtProb(r.result.mk_p, lang)}`,
                    }))}
                  />
                  <p className="view-note">{VIEW[lang].compare.slopeNote}</p>
                </div>
              </div>
            }
            table={
              <section className="stat-stack" aria-label={tc.title}>
                <div className="stat-sub">
                  <h4 className="stat-sub-title">{tc.title}</h4>
                  <DataTable
                    columns={measureCols} rows={measureRows} rowKey={(r) => r.id} ariaLabel={tc.title}
                    csvName={`${tc.file}-${variable}`} csvLabel={tb.csv}
                  />
                </div>
                <div className="stat-sub">
                  <h4 className="stat-sub-title">{tc.relTitle}</h4>
                  <DataTable
                    columns={relCols} rows={relRows} rowKey={(r) => r.id} ariaLabel={tc.relTitle}
                    csvName={`${tc.file}-relacion-${variable}`} csvLabel={tb.csv}
                  />
                  <p className="table-note">{tc.note}</p>
                </div>
              </section>
            }
          />
        </>
      )}
    </div>
  )
}
