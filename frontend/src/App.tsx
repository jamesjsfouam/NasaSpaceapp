import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api, DIRECTION_ARROW, fmt, fmtP, pText, SIGNIFICANCE_LABEL,
  type Catalog, type RegionTrend, type ScanResponse, type Trend, type TrendResponse,
} from './api'
import { TrendChart } from './TrendChart'

type Tab = 'trend' | 'scan' | 'compare'
type Query = { variable: string; lat: number; lon: number; start: number; label: string }

const qs = (q: Query) => `lat=${q.lat}&lon=${q.lon}&start=${q.start}`

export default function App() {
  const [cat, setCat] = useState<Catalog | null>(null)
  const [theme, setTheme] = useState('temperature')
  const [variable, setVariable] = useState('T2M')
  const [regionId, setRegionId] = useState('managua')
  const [coords, setCoords] = useState({ lat: 12.13, lon: -86.25 })
  const [start, setStart] = useState(1990)

  const [query, setQuery] = useState<Query | null>(null)
  const [tab, setTab] = useState<Tab>('trend')
  const [trend, setTrend] = useState<TrendResponse | null>(null)
  const [scan, setScan] = useState<ScanResponse | null>(null)
  const [compare, setCompare] = useState<RegionTrend[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useRef(0)

  useEffect(() => {
    api<Catalog>('/api/catalog').then(setCat).catch((e: Error) => setError(e.message))
  }, [])

  const variables = useMemo(() => cat?.variables.filter((v) => v.theme === theme) ?? [], [cat, theme])
  const current = cat?.variables.find((v) => v.key === variable)

  const investigate = useCallback(async (q: Query) => {
    const id = ++run.current
    setQuery(q); setTab('trend'); setBusy(true); setError(null)
    setTrend(null); setScan(null); setCompare(null)
    try {
      const t = await api<TrendResponse>(`/api/trend?variable=${q.variable}&${qs(q)}`)
      if (id === run.current) setTrend(t)
    } catch (e) {
      if (id === run.current) setError((e as Error).message)
    } finally {
      if (id === run.current) setBusy(false)
    }
  }, [])

  async function openTab(next: Tab) {
    setTab(next)
    if (!query) return
    const id = run.current
    setError(null)
    try {
      if (next === 'scan' && !scan) {
        setBusy(true)
        const s = await api<ScanResponse>(`/api/scan?${qs(query)}`)
        if (id === run.current) setScan(s)
      }
      if (next === 'compare' && !compare) {
        setBusy(true)
        const c = await api<RegionTrend[]>(`/api/compare?variable=${query.variable}&start=${query.start}`)
        if (id === run.current) setCompare(c)
      }
    } catch (e) {
      if (id === run.current) setError((e as Error).message)
    } finally {
      if (id === run.current) setBusy(false)
    }
  }

  function pickRegion(id: string) {
    setRegionId(id)
    const r = cat?.regions.find((x) => x.id === id)
    if (r) setCoords({ lat: r.lat, lon: r.lon })
  }

  function pickTheme(t: string) {
    setTheme(t)
    const first = cat?.variables.find((v) => v.theme === t)
    if (first) setVariable(first.key)
  }

  function submit() {
    const region = cat?.regions.find((r) => r.id === regionId)
    investigate({
      variable, start, lat: coords.lat, lon: coords.lon,
      label: region?.label ?? `${coords.lat}, ${coords.lon}`,
    })
  }

  function openDemo(d: Catalog['demos'][number]) {
    const v = cat?.variables.find((x) => x.key === d.variable)
    const r = cat?.regions.find((x) => x.id === d.region)
    if (!v || !r) return
    setTheme(v.theme); setVariable(v.key); setRegionId(r.id); setCoords({ lat: r.lat, lon: r.lon }); setStart(1990)
    investigate({ variable: v.key, start: 1990, lat: r.lat, lon: r.lon, label: r.label })
  }

  function openVariable(key: string) {
    if (!query) return
    const v = cat?.variables.find((x) => x.key === key)
    if (v) { setTheme(v.theme); setVariable(key) }
    investigate({ ...query, variable: key })
  }

  const years = cat ? Array.from({ length: cat.last_year - 10 - cat.first_year + 1 }, (_, i) => cat.first_year + i) : []

  return (
    <main>
      <header>
        <h1>Detective de tendencias del sistema Tierra</h1>
        <p>
          Elige una variable y un lugar. La herramienta te dirá <strong>qué</strong> está cambiando,
          <strong> dónde</strong>, <strong>cuánto</strong> y si el cambio es <strong>significativo</strong>{' '}
          o podría ser casualidad. Laboratorio Boreal · NASA Space Apps 2026.
        </p>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {!cat && !error && <p className="muted">Cargando catálogo…</p>}

      {cat && (
        <>
          <section>
            <h2>Empieza con un ejemplo</h2>
            <div className="demos">
              {cat.demos.map((d) => (
                <button key={d.title} className="demo" onClick={() => openDemo(d)}>
                  <strong>{d.title}</strong>
                  <span>{d.why}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>O investiga lo tuyo</h2>
            <div className="steps">
              <div>
                <h3>1 · ¿Qué te interesa?</h3>
                <div className="chips">
                  {Object.entries(cat.themes).map(([k, label]) => (
                    <button key={k} className={`chip ${k === theme ? 'on' : ''}`} onClick={() => pickTheme(k)}
                      aria-pressed={k === theme}>{label}</button>
                  ))}
                </div>
                <label>
                  Variable
                  <select value={variable} onChange={(e) => setVariable(e.target.value)}>
                    {variables.map((v) => <option key={v.key} value={v.key}>{v.label} ({v.unit})</option>)}
                  </select>
                </label>
                {current && <p className="definition">{current.definition}</p>}
              </div>

              <div>
                <h3>2 · ¿Dónde?</h3>
                <label>
                  Región
                  <select value={regionId} onChange={(e) => pickRegion(e.target.value)}>
                    {cat.regions.map((r) => <option key={r.id} value={r.id}>{r.label} · {r.biome}</option>)}
                    <option value="custom">Otra ubicación (coordenadas)</option>
                  </select>
                </label>
                <div className="coords">
                  <label>Latitud
                    <input type="number" step="0.01" min={-90} max={90} value={coords.lat}
                      onChange={(e) => { setRegionId('custom'); setCoords({ ...coords, lat: e.target.valueAsNumber }) }} />
                  </label>
                  <label>Longitud
                    <input type="number" step="0.01" min={-180} max={180} value={coords.lon}
                      onChange={(e) => { setRegionId('custom'); setCoords({ ...coords, lon: e.target.valueAsNumber }) }} />
                  </label>
                </div>
              </div>

              <div>
                <h3>3 · ¿Desde cuándo?</h3>
                <label>
                  Año de inicio (hasta {cat.last_year})
                  <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <p className="muted small">Más años dan más confianza estadística.</p>
                <button className="primary" onClick={submit} disabled={busy || Number.isNaN(coords.lat + coords.lon)}>
                  {busy && tab === 'trend' ? 'Investigando…' : 'Investigar tendencia'}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {query && (
        <section aria-live="polite">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'trend'} onClick={() => openTab('trend')}>Tendencia</button>
            <button role="tab" aria-selected={tab === 'scan'} onClick={() => openTab('scan')}>
              Escanear {query.label.split(',')[0]}
            </button>
            <button role="tab" aria-selected={tab === 'compare'} onClick={() => openTab('compare')}>
              Comparar regiones
            </button>
          </div>
          {busy && <p className="muted">Consultando datos de NASA…</p>}

          {tab === 'trend' && trend && <TrendView data={trend} where={query.label} />}
          {tab === 'scan' && scan && <ScanView data={scan} onOpen={openVariable} />}
          {tab === 'compare' && compare && cat && (
            <CompareView rows={compare} variable={cat.variables.find((v) => v.key === query.variable)?.label ?? ''} />
          )}
        </section>
      )}

      {cat && <footer className="muted small">{cat.data_note}</footer>}
    </main>
  )
}

function TrendView({ data, where }: { data: TrendResponse; where: string }) {
  const t = data.result
  const sign = t.total_change > 0 ? '+' : ''
  return (
    <div>
      <div className={`verdict ${t.significance}`}>
        <div className="row">
          <h2>{t.label} · {where}</h2>
          <span className={`badge ${t.significance}`}>{SIGNIFICANCE_LABEL[t.significance]}</span>
        </div>
        <p className="lead">{t.interpretation}</p>
      </div>

      <div className="facts">
        <div><span>¿Qué cambia?</span><strong>{DIRECTION_ARROW[t.direction]} {t.label}</strong></div>
        <div><span>¿Dónde?</span><strong>{where}</strong><em>{data.lat.toFixed(2)}, {data.lon.toFixed(2)}</em></div>
        <div>
          <span>¿Cuánto?</span>
          <strong>{fmt(t.slope_per_decade)} {t.unit} / década</strong>
          <em>{sign}{fmt(t.total_change)} {t.unit} en {t.n_years} años{t.percent_change !== null ? ` (${sign}${t.percent_change.toFixed(1)} %)` : ''}</em>
        </div>
        <div>
          <span>¿Significativo?</span>
          <strong>{t.significant ? 'Sí' : 'No'} ({pText(t.mk_p)})</strong>
          <em>{t.significant ? 'Poco probable que sea casualidad' : 'Podría ser variación natural'}</em>
        </div>
      </div>

      {t.warnings.length > 0 && (
        <ul className="warnings">{t.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}

      <TrendChart trend={t} />

      <details>
        <summary>¿Cómo se calculó?</summary>
        <ol className="how">
          <li>Se usan solo años completos ({t.first_year}–{t.last_year}) y se quita el ciclo de las estaciones.</li>
          <li>Se promedia cada año, y sobre esos promedios se traza la recta de tendencia.</li>
          <li><strong>Theil–Sen</strong> estima la pendiente sin dejarse engañar por años extremos. El intervalo de confianza del 95 % indica el rango razonable de esa pendiente.</li>
          <li><strong>Mann-Kendall</strong> responde: ¿sería normal ver un orden así por pura casualidad? Un p menor a 0,05 dice que es poco probable.</li>
          <li>Como contraste, la <strong>regresión lineal con t-test</strong> hace lo mismo con otro método.</li>
        </ol>
        <table>
          <thead><tr><th>Método</th><th>Pendiente / década</th><th>IC 95 %</th><th>p</th></tr></thead>
          <tbody>
            <tr><td>Theil–Sen + Mann-Kendall</td><td>{fmt(t.slope_per_decade)}</td>
              <td>{fmt(t.ci_low_per_decade)} a {fmt(t.ci_high_per_decade)}</td><td>{fmtP(t.mk_p)} (τ = {fmt(t.mk_tau, 2)})</td></tr>
            <tr><td>Regresión lineal + t-test</td><td>{fmt(t.ols_slope_per_decade)}</td>
              <td>{fmt(t.ols_ci_low_per_decade)} a {fmt(t.ols_ci_high_per_decade)}</td><td>{fmtP(t.ols_p)}</td></tr>
          </tbody>
        </table>
        <p className="muted small">
          {t.methods_agree ? 'Ambos métodos coinciden en la conclusión.' : 'Los métodos no coinciden: toma el resultado con cautela.'}{' '}
          Solo se detectan tendencias lineales. Fuente: {data.source === 'nasa-power' ? 'NASA POWER (en vivo)' : 'muestra local de NASA POWER (sin conexión)'}.
        </p>
      </details>
    </div>
  )
}

function Rows({ items, onOpen }: { items: Trend[]; onOpen?: (key: string) => void }) {
  return (
    <tbody>
      {items.map((r) => (
        <tr key={r.variable}>
          <td>{onOpen ? <button className="link" onClick={() => onOpen(r.variable)}>{r.label}</button> : r.label}</td>
          <td>{DIRECTION_ARROW[r.direction]}</td>
          <td>{fmt(r.slope_per_decade)} {r.unit}</td>
          <td>{fmtP(r.mk_p)}{r.p_adjusted !== null ? ` · ${fmtP(r.p_adjusted)}` : ''}</td>
          <td><span className={`badge ${r.significance}`}>{SIGNIFICANCE_LABEL[r.significance]}</span>
            {r.step_year && <span className="badge weak" title="Posible salto brusco en los datos"> salto {r.step_year}</span>}</td>
        </tr>
      ))}
    </tbody>
  )
}

function ScanView({ data, onOpen }: { data: ScanResponse; onOpen: (key: string) => void }) {
  return (
    <div>
      <p>Todas las variables de este lugar, de la evidencia más fuerte a la más débil. Haz clic en una para verla.</p>
      <div className="scroll">
        <table>
          <thead><tr><th>Variable</th><th></th><th>Cambio / década</th><th>p · p ajustado</th><th>Veredicto</th></tr></thead>
          <Rows items={data.results} onOpen={onOpen} />
        </table>
      </div>
      <p className="muted small">
        Al probar {data.results.length} variables a la vez, alguna saldrá significativa por azar. El
        <em> p ajustado</em> (Bonferroni) corrige eso: fíate más de las que siguen siendo significativas con él.
      </p>
    </div>
  )
}

function CompareView({ rows, variable }: { rows: RegionTrend[]; variable: string }) {
  const ok = rows.filter((r) => r.result)
  const ups = ok.filter((r) => r.result!.significant && r.result!.direction === 'up').length
  const downs = ok.filter((r) => r.result!.significant && r.result!.direction === 'down').length
  return (
    <div>
      <p>
        <strong>{variable}</strong> en cada región de ejemplo. Una misma variable puede subir en un sitio y
        bajar en otro: aquí {ups} regiones suben y {downs} bajan de forma significativa.
      </p>
      <div className="scroll">
        <table>
          <thead><tr><th>Región</th><th></th><th>Cambio / década</th><th>p</th><th>Veredicto</th></tr></thead>
          <tbody>
            {rows.map((r) => r.result ? (
              <tr key={r.region.id}>
                <td>{r.region.label}<br /><span className="muted small">{r.region.biome}</span></td>
                <td>{DIRECTION_ARROW[r.result.direction]}</td>
                <td>{fmt(r.result.slope_per_decade)} {r.result.unit}</td>
                <td>{fmtP(r.result.mk_p)}</td>
                <td><span className={`badge ${r.result.significance}`}>{SIGNIFICANCE_LABEL[r.result.significance]}</span>
                  {r.result.step_year && <span className="badge weak"> salto {r.result.step_year}</span>}</td>
              </tr>
            ) : (
              <tr key={r.region.id}><td>{r.region.label}</td><td colSpan={4} className="muted">{r.error}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
