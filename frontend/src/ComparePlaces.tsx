import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, DIRECTION_ARROW, type Place, type Region, type TrendResponse } from './api'
import {
  certaintyInfo, fmtNum, pTextLang, tRegion, tUnit, verdictLabel, type AudienceMode, type Lang,
} from './i18n'

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
  mode,
  onPickOnGlobe,
}: {
  variable: string
  start: number
  a: Spot
  second: Spot | null
  onSecond: (s: Spot | null) => void
  regions: Region[]
  lang: Lang
  mode: AudienceMode
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
        globeBtn: '🌍 Elegir en el Planeta 3D',
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
        globeBtn: '🌍 Pick on 3D Planet',
        quickTitle: 'Or compare quickly with a reference biome:',
        busy: 'Computing both trends…',
        perDec: '/ decade',
        chartNote: 'Standardized annual averages (z-scores around each location mean) so both trajectories can be compared cleanly side by side.',
      }

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
                    <span className={`badge ${t.verdict}`}>{verdictLabel(t.verdict, lang, mode)}</span>
                  </div>
                  <p className="compare-rate num">
                    {DIRECTION_ARROW[t.direction]} {t.slope_per_decade > 0 ? '+' : ''}
                    {fmtNum(t.slope_per_decade, lang)} {unit} {copy.perDec}
                  </p>
                  {mode === 'student' ? (
                    <p className="muted small" style={{ margin: '4px 0 0' }}>
                      {cert.headline} · {cert.detail}
                    </p>
                  ) : (
                    <p className="small muted" style={{ margin: '4px 0 0' }}>
                      95% CI: {fmtNum(t.ci_low_per_decade, lang)} – {fmtNum(t.ci_high_per_decade, lang)} ·{' '}
                      {pTextLang(t.mk_p, lang)} · n_eff = {fmtNum(t.n_effective, lang, 3)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="chart-card">
            <ResponsiveContainer width="100%" height={270}>
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="year" />
                <YAxis width={38} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : v)} />
                <Legend />
                <Line name={a.label} dataKey="a" stroke="#3fd0e6" strokeWidth={2.4} dot={false} isAnimationActive={false} />
                <Line name={b.label} dataKey="b" stroke="#f59e42" strokeWidth={2.4} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="muted small" style={{ margin: '8px 0 0' }}>{copy.chartNote}</p>
          </div>
        </>
      )}
    </div>
  )
}
