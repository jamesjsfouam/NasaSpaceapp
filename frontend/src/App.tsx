import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api, apiPost, DIRECTION_ARROW, fmt, fmtP, pText, VERDICT_LABEL,
  type AskResponse, type Catalog, type EarthForecastResponse, type Forecast, type Location, type Place,
  type RegionTrend, type ScanResponse, type Trend, type TrendResponse, type Variable,
} from './api'
import { ComparePlaces } from './ComparePlaces'
import { DemographyView } from './DemographyView'
import { ExplainPanel } from './Explain'
import { MapPicker } from './MapPicker'
import { RelateView } from './RelateView'
import { SatelliteView } from './SatelliteView'
import { TrendChart } from './TrendChart'

type Tab = 'trend' | 'compare' | 'scan' | 'regions' | 'population' | 'satellite' | 'relate'
type Spot = { lat: number; lon: number; label: string; iso3: string | null; country: string | null }
type Query = { variable: string; start: number; spot: Spot }

const TABS: [Tab, string][] = [
  ['trend', 'Veredicto'], ['compare', 'Comparar lugares'], ['satellite', 'Satélite'], ['population', 'Población'],
  ['relate', 'Clima y sociedad'], ['scan', 'Escanear el lugar'], ['regions', 'Regiones de ejemplo'],
]

export default function App() {
  const [cat, setCat] = useState<Catalog | null>(null)
  const [spot, setSpot] = useState<Spot>({ lat: 12.13, lon: -86.25, label: 'Managua', iso3: 'NIC', country: 'Nicaragua' })
  const [second, setSecond] = useState<{ lat: number; lon: number; label: string } | null>(null)
  const [pickSecond, setPickSecond] = useState(false)
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<Place[]>([])
  const [question, setQuestion] = useState('')
  const [askInfo, setAskInfo] = useState<string | null>(null)
  const [concern, setConcern] = useState('heat')
  const [placeType, setPlaceType] = useState<string | null>('city')
  const [recommended, setRecommended] = useState<Variable[]>([])
  const [variable, setVariable] = useState('T2M_MIN')
  const [start, setStart] = useState(1990)

  const [query, setQuery] = useState<Query | null>(null)
  const [tab, setTab] = useState<Tab>('trend')
  const [trend, setTrend] = useState<TrendResponse | null>(null)
  const [scenario, setScenario] = useState<Forecast | null>(null)
  const [scan, setScan] = useState<ScanResponse | null>(null)
  const [regions, setRegions] = useState<RegionTrend[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useRef(0)

  useEffect(() => {
    api<Catalog>('/api/catalog').then(setCat).catch((e: Error) => setError(e.message))
  }, [])

  // Recomendador por reglas: preocupación + tipo de lugar → 3 variables como máximo.
  useEffect(() => {
    const qs = `concern=${concern}${placeType ? `&place_type=${placeType}` : ''}`
    api<{ variables: Variable[] }>(`/api/recommend?${qs}`).then((r) => {
      setRecommended(r.variables)
      if (r.variables.length) setVariable(r.variables[0].key)
    }).catch(() => setRecommended([]))
  }, [concern, placeType])

  const current = cat?.variables.find((v) => v.key === variable)

  async function pickPoint(p: { lat: number; lon: number }, label?: string) {
    if (pickSecond) {
      setSecond({ ...p, label: label ?? `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}` })
      setTab('compare')
      return
    }
    setFound([])
    try {
      const loc = await api<Location>(`/api/places/locate?lat=${p.lat}&lon=${p.lon}`)
      setSpot({
        ...p, iso3: loc.iso3, country: loc.country,
        label: label ?? (loc.nearest_place ? `${loc.nearest_place}${loc.country ? `, ${loc.country}` : ''}` : `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)} (mar abierto)`),
      })
    } catch {
      setSpot({ ...p, iso3: null, country: null, label: label ?? `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}` })
    }
  }

  async function doSearch(text = search) {
    setError(null)
    try { setFound(await api<Place[]>(`/api/places/search?q=${encodeURIComponent(text)}`)) } catch (e) { setError((e as Error).message) }
  }

  async function ask() {
    setError(null); setAskInfo('Interpretando…')
    try {
      const r = await apiPost<AskResponse>('/api/ask', { question })
      setConcern(r.interpretation.concern)
      setPlaceType(r.interpretation.place_type)
      if (r.places.length) setFound(r.places)
      setAskInfo(`${r.interpretation.source === 'claude' ? 'La IA' : 'Las reglas'} entendieron: ${cat?.concerns[r.interpretation.concern] ?? r.interpretation.concern}` +
        `${r.interpretation.place_type ? ` en ${(cat?.place_types[r.interpretation.place_type] ?? '').toLowerCase()}` : ''}` +
        `${r.places.length ? `. Elige el lugar “${r.interpretation.place_query}” abajo.` : '.'}`)
    } catch (e) {
      setAskInfo(null); setError((e as Error).message)
    }
  }

  const investigate = useCallback(async (q: Query) => {
    const id = ++run.current
    setQuery(q); setTab('trend'); setBusy(true); setError(null)
    setTrend(null); setScenario(null); setScan(null); setRegions(null); setSecond(null)
    try {
      const t = await api<TrendResponse>(`/api/trend?variable=${q.variable}&lat=${q.spot.lat}&lon=${q.spot.lon}&start=${q.start}`)
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
        const s = await api<ScanResponse>(`/api/scan?lat=${query.spot.lat}&lon=${query.spot.lon}&start=${query.start}`)
        if (id === run.current) setScan(s)
      }
      if (next === 'regions' && !regions) {
        setBusy(true)
        const c = await api<RegionTrend[]>(`/api/compare?variable=${query.variable}&start=${query.start}`)
        if (id === run.current) setRegions(c)
      }
    } catch (e) {
      if (id === run.current) setError((e as Error).message)
    } finally {
      if (id === run.current) setBusy(false)
    }
  }

  async function loadScenario(toYear: number) {
    if (!query) return
    try {
      const r = await api<EarthForecastResponse>(`/api/forecast?variable=${query.variable}&lat=${query.spot.lat}&lon=${query.spot.lon}&start=${query.start}&to_year=${toYear}`)
      setScenario(r.forecast)
    } catch (e) { setError((e as Error).message) }
  }

  function openDemo(d: Catalog['demos'][number]) {
    const r = cat?.regions.find((x) => x.id === d.region)
    if (!r) return
    const s: Spot = { lat: r.lat, lon: r.lon, label: r.label, iso3: r.country, country: r.country ? cat?.countries[r.country] ?? null : null }
    setSpot(s); setVariable(d.variable); setStart(1990)
    investigate({ variable: d.variable, start: 1990, spot: s })
  }

  function openVariable(key: string) {
    if (!query) return
    setVariable(key)
    investigate({ ...query, variable: key })
  }

  const years = useMemo(() => cat ? Array.from({ length: cat.last_year - 15 - cat.first_year + 2 }, (_, i) => cat.first_year + i) : [], [cat])
  const relateQuery = query ? { variable: query.variable, lat: query.spot.lat, lon: query.spot.lon, start: query.start, label: query.spot.label, country: query.spot.iso3 } : null

  return (
    <main>
      <header>
        <h1>Detective de tendencias del sistema Tierra</h1>
        <p>
          Elige cualquier lugar del mundo y una pregunta. La herramienta te dice <strong>qué</strong> cambia,
          <strong> dónde</strong>, <strong>cuánto</strong> y si es <strong>significativo</strong>, con datos de la NASA,
          satélite y la ONU. Laboratorio Boreal · NASA Space Apps 2026.
        </p>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {!cat && !error && <p className="muted">Cargando…</p>}

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
            <h2>1 · Preguntar</h2>
            <div className="ask">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500}
                placeholder="Escribe tu duda, p. ej.: ¿se está secando el suelo en Estelí?"
                onKeyDown={(e) => e.key === 'Enter' && question.length > 2 && ask()} />
              <button className="secondary" onClick={ask} disabled={question.length < 3}>Interpretar</button>
            </div>
            {askInfo && <p className="muted small">{askInfo}</p>}

            <div className="steps">
              <div>
                <h3>¿Dónde? Cualquier lugar del mundo</h3>
                <div className="search">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Busca una ciudad, pueblo o región"
                    onKeyDown={(e) => e.key === 'Enter' && search.length > 1 && doSearch()} />
                  <button className="secondary" onClick={() => doSearch()} disabled={search.length < 2}>Buscar</button>
                </div>
                {found.length > 0 && (
                  <ul className="results">
                    {found.map((p) => (
                      <li key={`${p.lat},${p.lon}`}>
                        <button className="link" onClick={() => pickPoint({ lat: p.lat, lon: p.lon }, `${p.name}${p.country ? `, ${p.country}` : ''}`)}>
                          {p.name}{p.admin1 ? `, ${p.admin1}` : ''}{p.country ? ` (${p.country})` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <MapPicker point={spot} second={second} onPick={(p) => pickPoint(p)} />
                <div className="row small">
                  <span>📍 <strong>{spot.label}</strong> · {spot.lat.toFixed(2)}, {spot.lon.toFixed(2)}</span>
                  <label className="inline">
                    <input type="checkbox" checked={pickSecond} onChange={(e) => setPickSecond(e.target.checked)} />
                    El próximo clic elige un 2.º lugar para comparar
                  </label>
                </div>
                <div className="chips">
                  {cat.regions.map((r) => (
                    <button key={r.id} className="chip" onClick={() => pickPoint({ lat: r.lat, lon: r.lon }, r.label)}>{r.label.split(',')[0]}</button>
                  ))}
                </div>
              </div>

              <div>
                <h3>¿Qué te preocupa?</h3>
                <div className="chips">
                  {Object.entries(cat.concerns).map(([k, label]) => (
                    <button key={k} className={`chip ${k === concern ? 'on' : ''}`} aria-pressed={k === concern} onClick={() => setConcern(k)}>{label}</button>
                  ))}
                </div>
                <h3>¿Qué tipo de lugar es?</h3>
                <div className="chips">
                  {Object.entries(cat.place_types).map(([k, label]) => (
                    <button key={k} className={`chip ${k === placeType ? 'on' : ''}`} aria-pressed={k === placeType}
                      onClick={() => setPlaceType(k === placeType ? null : k)}>{label}</button>
                  ))}
                </div>
                <h3>Variables recomendadas</h3>
                <div className="recs-list">
                  {recommended.map((v) => (
                    <button key={v.key} className={`rec ${v.key === variable ? 'on' : ''}`} onClick={() => setVariable(v.key)}>
                      <strong>{v.label}</strong> <span className="muted small">({v.unit})</span>
                      <span className="small">{v.definition}</span>
                      <span className="muted small">{v.source}</span>
                    </button>
                  ))}
                </div>
                <label>O cualquier otra variable
                  <select value={variable} onChange={(e) => setVariable(e.target.value)}>
                    {cat.variables.map((v) => <option key={v.key} value={v.key}>{v.label} ({v.unit})</option>)}
                  </select>
                </label>
                {current && <p className="definition">⚠ {current.reliability}</p>}
                <label>Desde el año
                  <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <button className="primary" onClick={() => investigate({ variable, start, spot })} disabled={busy}>
                  {busy && tab === 'trend' ? 'Investigando…' : 'Ver el veredicto'}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {query && cat && (
        <section aria-live="polite">
          <div className="tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => openTab(k)}>{label}</button>
            ))}
          </div>
          {busy && !['relate', 'population', 'satellite'].includes(tab) && <p className="muted">Consultando datos…</p>}

          {tab === 'trend' && trend && (
            <TrendView data={trend} where={query.spot.label} scenario={scenario} onScenario={loadScenario}
              start={query.start} reliability={cat.variables.find((v) => v.key === query.variable)?.reliability ?? ''} />
          )}
          {tab === 'compare' && (
            <ComparePlaces variable={query.variable} start={query.start} a={query.spot} second={second}
              onSecond={(s) => setSecond(s)} />
          )}
          {tab === 'scan' && scan && <ScanView data={scan} onOpen={openVariable} />}
          {tab === 'regions' && regions && (
            <RegionsView rows={regions} variable={cat.variables.find((v) => v.key === query.variable)?.label ?? ''} />
          )}
          {tab === 'population' && <DemographyView cat={cat} country={query.spot.iso3} start={query.start} />}
          {tab === 'satellite' && <SatelliteView lat={query.spot.lat} lon={query.spot.lon} label={query.spot.label} />}
          {tab === 'relate' && relateQuery && (
            <RelateView key={`${query.variable}-${query.spot.lat}-${query.spot.lon}-${query.start}`} cat={cat} query={relateQuery} />
          )}
        </section>
      )}

      {cat && <footer className="muted small">{cat.data_note}</footer>}
    </main>
  )
}

function TrendView({ data, where, scenario, onScenario, start, reliability }: {
  data: TrendResponse; where: string; scenario: Forecast | null; onScenario: (y: number) => void; start: number; reliability: string
}) {
  const t = data.result
  const sign = t.total_change > 0 ? '+' : ''
  const [toYear, setToYear] = useState(2050)
  return (
    <div>
      <div className={`verdict ${t.verdict}`}>
        <div className="row">
          <h2>{t.label} · {where}</h2>
          <span className={`badge ${t.verdict}`}>{VERDICT_LABEL[t.verdict]}</span>
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
          <strong>{t.significant ? 'Sí' : 'Todavía no'} ({pText(t.mk_p)})</strong>
          <em>{t.significant ? 'Muy improbable que sea azar' : t.years_needed ? `Harían falta ~${t.years_needed} años de datos` : 'Compatible con que no haya cambio'}</em>
        </div>
      </div>

      {t.warnings.length > 0 && <ul className="warnings">{t.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      <p className="muted small">Fuente y fiabilidad: {reliability}</p>

      <TrendChart trend={t} forecast={scenario} />

      <div className="scenario">
        <label className="inline">Escenario hasta
          <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}>
            {[2030, 2040, 2050, 2075, 2100].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button className="secondary" onClick={() => onScenario(toYear)}>Ver cómo se vería si el ritmo continúa</button>
      </div>
      {scenario && (
        <>
          <p className="small">{scenario.text}</p>
          {scenario.warnings.map((w) => <p key={w} className="muted small">⚠ {w}</p>)}
        </>
      )}

      <ExplainPanel request={{ kind: 'trend', variable: t.variable, lat: data.lat, lon: data.lon, place: where, start, to_year: toYear }} />

      <details>
        <summary>¿Cómo se calculó?</summary>
        <ol className="how">
          <li>A cada mes se le resta el promedio de ese mes: así se quita el ciclo de las estaciones.</li>
          <li>Se promedia cada año ({t.first_year}–{t.last_year}, años con al menos 10 meses) y sobre esos promedios se traza la recta.</li>
          <li><strong>Theil–Sen</strong> estima la pendiente sin dejarse engañar por años extremos; su intervalo del 95 % es el rango razonable.</li>
          <li>Los datos del clima tienen memoria: un año cálido suele seguir a otro. Eso engaña a las pruebas normales, así que se usan dos que lo corrigen:
            <strong> Mann-Kendall con preblanqueo</strong> y <strong>regresión con tamaño de muestra efectivo</strong> (aquí {t.n_years} años valen como {fmt(t.n_effective, 2)} independientes).</li>
          <li>Veredicto: <em>significativa</em> si p &lt; 0,05 y el intervalo no incluye el cero; <em>todavía no</em> si p está entre 0,05 y 0,20 o las pruebas no coinciden; <em>sin tendencia clara</em> si p ≥ 0,20.</li>
          <li>Si no es significativa, se estima cuántos años de datos harían falta para detectar ese ritmo (Weatherhead y colaboradores, 1998).</li>
        </ol>
        <table>
          <thead><tr><th>Método</th><th>Pendiente / década</th><th>IC 95 %</th><th>p</th></tr></thead>
          <tbody>
            <tr><td>Theil–Sen + Mann-Kendall (preblanqueo)</td><td>{fmt(t.slope_per_decade)}</td>
              <td>{fmt(t.ci_low_per_decade)} a {fmt(t.ci_high_per_decade)}</td><td>{fmtP(t.mk_p)} (τ = {fmt(t.mk_tau, 2)})</td></tr>
            <tr><td>Regresión (n efectivo) + t-test</td><td>{fmt(t.ols_slope_per_decade)}</td>
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
          <td><span className={`badge ${r.verdict}`}>{VERDICT_LABEL[r.verdict]}</span>
            {r.step_year && <span className="badge not_yet" title="Posible salto brusco en los datos"> salto {r.step_year}</span>}</td>
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

function RegionsView({ rows, variable }: { rows: RegionTrend[]; variable: string }) {
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
                <td><span className={`badge ${r.result.verdict}`}>{VERDICT_LABEL[r.result.verdict]}</span>
                  {r.result.step_year && <span className="badge not_yet"> salto {r.result.step_year}</span>}</td>
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
