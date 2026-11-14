import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, DIRECTION_ARROW, fmt, pText, VERDICT_LABEL, type Place, type TrendResponse } from './api'

type Spot = { lat: number; lon: number; label: string }

/** Misma variable en dos lugares, lado a lado: la función que muestra tendencias opuestas. */
export function ComparePlaces({ variable, start, a, second, onSecond }: {
  variable: string; start: number; a: Spot; second: Spot | null; onSecond: (s: Spot | null) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [pair, setPair] = useState<[TrendResponse, TrendResponse] | null>(null)
  const [b, setB] = useState<Spot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    setError(null)
    try { setResults(await api<Place[]>(`/api/places/search?q=${encodeURIComponent(q)}`)) } catch (e) { setError((e as Error).message) }
  }

  // El segundo lugar llega del buscador o de un clic en el mapa (modo comparar).
  useEffect(() => {
    if (second) compareWith(second)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [second?.lat, second?.lon, variable, start])

  async function compareWith(spot: Spot) {
    setB(spot); setBusy(true); setError(null); setResults([])
    try {
      const [ra, rb] = await Promise.all([a, spot].map((s) =>
        api<TrendResponse>(`/api/trend?variable=${variable}&lat=${s.lat}&lon=${s.lon}&start=${start}`)))
      setPair([ra, rb])
    } catch (e) {
      setError((e as Error).message); setPair(null)
    } finally {
      setBusy(false)
    }
  }

  const series = pair ? (() => {
    const z = (pts: { year: number; mean: number }[]) => {
      const m = pts.reduce((s, p) => s + p.mean, 0) / pts.length
      const sd = Math.sqrt(pts.reduce((s, p) => s + (p.mean - m) ** 2, 0) / pts.length) || 1
      return new Map(pts.map((p) => [p.year, (p.mean - m) / sd]))
    }
    const za = z(pair[0].result.series?.annual ?? []), zb = z(pair[1].result.series?.annual ?? [])
    return [...new Set([...za.keys(), ...zb.keys()])].sort().map((y) => ({ year: y, a: za.get(y), b: zb.get(y) }))
  })() : []

  return (
    <div>
      <p>Compara <strong>{a.label}</strong> con otro lugar del mundo para la misma variable. Busca el lugar o haz clic en el mapa de arriba con “comparar” activado.</p>
      <div className="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: Tegucigalpa, Sahel, Lima…"
          onKeyDown={(e) => e.key === 'Enter' && q.length > 1 && search()} />
        <button className="secondary" onClick={search} disabled={q.length < 2}>Buscar</button>
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
      {busy && <p className="muted">Calculando las dos tendencias…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {pair && b && (
        <>
          <div className="pair">
            {pair.map((r, i) => (
              <div key={i} className={`verdict ${r.result.verdict} ${i === 0 ? 'side-a' : 'side-b'}`}>
                <h3>{i === 0 ? a.label : b.label}</h3>
                <span className={`badge ${r.result.verdict}`}>{VERDICT_LABEL[r.result.verdict]}</span>
                <p><strong>{DIRECTION_ARROW[r.result.direction]} {fmt(r.result.slope_per_decade)} {r.result.unit} / década</strong></p>
                <p className="small">IC 95 %: {fmt(r.result.ci_low_per_decade)} a {fmt(r.result.ci_high_per_decade)} · Mann-Kendall {pText(r.result.mk_p)}</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="year" />
              <YAxis width={36} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : v)} />
              <Legend />
              <Line name={a.label} dataKey="a" stroke="#1f5fbf" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line name={b.label} dataKey="b" stroke="#c2570a" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="muted small">Promedios anuales estandarizados (desviaciones respecto al promedio de cada lugar) para comparar la forma de las dos series. Misma variable, dos historias.</p>
        </>
      )}
    </div>
  )
}
