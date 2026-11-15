import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api, apiPost, DIRECTION_ARROW,
  type AskResponse, type Catalog, type EarthForecastResponse, type Forecast,
  type Location, type Place, type RegionTrend, type ScanResponse,
  type TrendResponse, type Variable,
} from './api'
import { ComparePlaces } from './ComparePlaces'
import { DemographyView } from './DemographyView'
import { ExplainPanel } from './Explain'
import { Wordmark } from './Logo'
import { BrandPattern } from './BrandPattern'
import { GlobeSection, type SecondSpot, type Spot } from './GlobeSection'
import {
  certaintyInfo, CONCERNS_EN, fmtNum, fmtProb, formatForecastText, humanVerdictSummary,
  PLACE_TYPES_EN, translateWarning, tDemo, tRegion, tUnit, tVariable, UI,
  verdictLabel, type Lang, type Phase,
} from './i18n'
import { RelateView } from './RelateView'
import { SatelliteView } from './SatelliteView'
import { TrendChart } from './TrendChart'

type Tab = 'trend' | 'scan' | 'compare' | 'satellite' | 'population' | 'relate'
type Query = { variable: string; start: number; spot: Spot }

const TAB_ORDER: Tab[] = ['trend', 'scan', 'compare', 'satellite', 'population', 'relate']

const MONTE_CARLO_ROWS = [
  { phi: '0', naive: '4,8 %', naiveEn: '4.8%', verdict: '3,6 %', verdictEn: '3.6%', tagEs: 'Sin memoria', tagEn: 'No memory' },
  { phi: '0,4', phiEn: '0.4', naive: '19,3 %', naiveEn: '19.3%', verdict: '4,8 %', verdictEn: '4.8%', tagEs: '4× menos errores', tagEn: '4× fewer errors' },
  { phi: '0,8', phiEn: '0.8', naive: '49,0 %', naiveEn: '49.0%', verdict: '8,2 %', verdictEn: '8.2%', tagEs: '6× menos errores', tagEn: '6× fewer errors' },
]

export default function App() {
  const [phase, setPhase] = useState<Phase>('briefing')
  const [drawerWide, setDrawerWide] = useState(false)
  const [lang, setLang] = useState<Lang>('es')
  const [weatherNow, setWeatherNow] = useState<{ key: string; tempC: number; uv?: number } | null>(null)

  const [cat, setCat] = useState<Catalog | null>(null)
  const [spot, setSpot] = useState<Spot>({ lat: 12.13, lon: -86.25, label: 'Managua, Nicaragua', iso3: 'NIC', country: 'Nicaragua' })
  const [second, setSecond] = useState<SecondSpot | null>(null)
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
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    api<Catalog>('/api/catalog').then(setCat).catch((e: Error) => setError(e.message))
  }, [])

  // Insignia opcional de Meteomatics cuando el backend local está activo (silenciosa en estático)
  const queryCoordKey = query ? `${query.spot.lat},${query.spot.lon}` : null
  useEffect(() => {
    if (!queryCoordKey || (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io'))) {
      return
    }
    const ctrl = new AbortController()
    const [latStr, lonStr] = queryCoordKey.split(',')
    fetch(`/api/weather?lat=${latStr}&lon=${lonStr}&parameters=t_2m:C,uv:idx`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const series = payload?.data as { parameter: string; coordinates: { dates: { value: number }[] }[] }[] | undefined
        if (!Array.isArray(series)) return setWeatherNow(null)
        const getVal = (p: string) => series.find((s) => s.parameter === p)?.coordinates?.[0]?.dates?.[0]?.value
        const tempC = getVal('t_2m:C')
        const uv = getVal('uv:idx')
        setWeatherNow(tempC !== undefined ? { key: queryCoordKey, tempC, uv } : null)
      })
      .catch(() => setWeatherNow(null))
    return () => ctrl.abort()
  }, [queryCoordKey])

  // Rule-based variable recommender: concern + place type → up to 3 variables
  useEffect(() => {
    const qs = `concern=${concern}${placeType ? `&place_type=${placeType}` : ''}`
    api<{ variables: Variable[] }>(`/api/recommend?${qs}`)
      .then((r) => {
        setRecommended(r.variables)
        if (r.variables.length) setVariable(r.variables[0].key)
      })
      .catch(() => setRecommended([]))
  }, [concern, placeType])

  async function resolveSpot(p: { lat: number; lon: number }, label?: string): Promise<Spot> {
    try {
      const loc = await api<Location>(`/api/places/locate?lat=${p.lat}&lon=${p.lon}`)
      const openOcean = lang === 'es' ? 'mar abierto' : 'open ocean'
      return {
        ...p,
        iso3: loc.iso3,
        country: loc.country,
        label: label ?? (
          loc.nearest_place
            ? `${loc.nearest_place}${loc.country ? `, ${loc.country}` : ''}`
            : `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)} (${openOcean})`
        ),
      }
    } catch {
      return { ...p, iso3: null, country: null, label: label ?? `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}` }
    }
  }

  async function pickPoint(p: { lat: number; lon: number }, label?: string, fromGlobeClick = false) {
    if (pickSecond && fromGlobeClick) {
      const resolved = await resolveSpot(p, label)
      setSecond({ lat: resolved.lat, lon: resolved.lon, label: resolved.label })
      setPickSecond(false)
      return
    }
    setFound([])
    setSpot(await resolveSpot(p, label))
  }

  async function doSearch(text = search) {
    setError(null)
    try {
      setFound(await api<Place[]>(`/api/places/search?q=${encodeURIComponent(text)}`))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function ask() {
    setError(null)
    setAskInfo(lang === 'es' ? 'Interpretando…' : 'Interpreting…')
    try {
      const r = await apiPost<AskResponse>('/api/ask', { question })
      setConcern(r.interpretation.concern)
      setPlaceType(r.interpretation.place_type)
      if (r.places.length) {
        setFound(r.places)
        const top = r.places[0]
        await pickPoint({ lat: top.lat, lon: top.lon }, `${top.name}${top.country ? `, ${top.country}` : ''}`)
      }
      const concernText = lang === 'en'
        ? (CONCERNS_EN[r.interpretation.concern] ?? r.interpretation.concern)
        : (cat?.concerns[r.interpretation.concern] ?? r.interpretation.concern)
      const ptRaw = r.interpretation.place_type
      const ptText = ptRaw
        ? (lang === 'en' ? (PLACE_TYPES_EN[ptRaw] ?? ptRaw) : (cat?.place_types[ptRaw] ?? '')).toLowerCase()
        : ''
      if (lang === 'es') {
        const src = r.interpretation.source === 'claude' ? 'La IA detectó' : 'Las reglas detectaron'
        setAskInfo(`${src}: ${concernText}${ptText ? ` en ${ptText}` : ''}${r.places.length ? ` · lugar “${r.places[0].name}” centrado en el planeta.` : '.'}`)
      } else {
        const src = r.interpretation.source === 'claude' ? 'AI detected' : 'Rules matched'
        setAskInfo(`${src}: ${concernText}${ptText ? ` (${ptText})` : ''}${r.places.length ? ` · centered "${r.places[0].name}" on the globe.` : '.'}`)
      }
    } catch (e) {
      setAskInfo(null)
      setError((e as Error).message)
    }
  }

  const investigate = useCallback(async (q: Query, targetTab: Tab = 'trend') => {
    const id = ++run.current
    setQuery(q)
    setTab(targetTab)
    setPhase('studio')
    setBusy(true)
    setError(null)
    setTrend(null)
    setScenario(null)
    setScan(null)
    setRegions(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const t = await api<TrendResponse>(
        `/api/trend?variable=${q.variable}&lat=${q.spot.lat}&lon=${q.spot.lon}&start=${q.start}`,
      )
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
      if (next === 'scan' && (!scan || !regions)) {
        setBusy(true)
        const [s, c] = await Promise.all([
          scan ? Promise.resolve(scan) : api<ScanResponse>(`/api/scan?lat=${query.spot.lat}&lon=${query.spot.lon}&start=${query.start}`),
          regions ? Promise.resolve(regions) : api<RegionTrend[]>(`/api/compare?variable=${query.variable}&start=${query.start}`),
        ])
        if (id === run.current) {
          setScan(s)
          setRegions(c)
        }
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
      const r = await api<EarthForecastResponse>(
        `/api/forecast?variable=${query.variable}&lat=${query.spot.lat}&lon=${query.spot.lon}&start=${query.start}&to_year=${toYear}`,
      )
      setScenario(r.forecast)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function openDemo(d: Catalog['demos'][number], goPlanet = false) {
    const rawR = cat?.regions.find((x) => x.id === d.region)
    if (!rawR) return
    const r = tRegion(rawR, lang)
    const s: Spot = {
      lat: r.lat,
      lon: r.lon,
      label: r.label,
      iso3: r.country,
      country: r.country ? cat?.countries[r.country] ?? null : null,
    }
    setSpot(s)
    setVariable(d.variable)
    setStart(1990)
    if (goPlanet) {
      setPhase('planet')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      investigate({ variable: d.variable, start: 1990, spot: s })
    }
  }

  function switchPhase(next: Phase) {
    if (next === 'studio' && !query) {
      investigate({ variable, start, spot })
      return
    }
    setPhase(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openVariableInStudio(key: string) {
    if (!query) return
    setVariable(key)
    investigate({ ...query, variable: key })
  }

  const years = useMemo(
    () => (cat ? Array.from({ length: cat.last_year - 15 - cat.first_year + 2 }, (_, i) => cat.first_year + i) : []),
    [cat],
  )

  const relateQuery = query
    ? {
        variable: query.variable,
        lat: query.spot.lat,
        lon: query.spot.lon,
        start: query.start,
        label: query.spot.label,
        country: query.spot.iso3,
      }
    : null

  const t = UI[lang]
  const activeVarRaw = cat?.variables.find((v) => v.key === (query?.variable ?? variable))
  const activeVar = activeVarRaw ? tVariable(activeVarRaw, lang) : null

  return (
    <div className="app-shell" data-phase={phase}>
      <a className="skip-link" href="#contenido">{lang === 'es' ? 'Saltar al contenido' : 'Skip to content'}</a>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand-btn" onClick={() => switchPhase('briefing')} aria-label={`DATEX · ${t.brandSub}`}>
            <Wordmark height={26} />
          </button>

          <nav className="phase-nav" aria-label={lang === 'es' ? 'Fases' : 'Phases'}>
            {(['briefing', 'planet', 'studio'] as Phase[]).map((p) => {
              const item = t.phases[p]
              const active = phase === p
              return (
                <button
                  key={p}
                  type="button"
                  className={`phase-pill ${active ? 'on' : ''}`}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => switchPhase(p)}
                >
                  <span className="phase-num">{item.num}</span>
                  <span>{item.label}</span>
                  {p === 'studio' && query && <span className="phase-dot" title={query.spot.label} />}
                </button>
              )
            })}
          </nav>

          <div className="topbar-controls">
            <div className="segmented" role="group" aria-label={lang === 'es' ? 'Idioma' : 'Language'}>
              <button type="button" className={lang === 'es' ? 'on' : ''} aria-pressed={lang === 'es'} onClick={() => setLang('es')}>ES</button>
              <button type="button" className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            </div>
          </div>
        </div>
      </header>

      <main id="contenido" className={phase === 'briefing' ? 'main-page' : `main-full has-map${phase === 'studio' ? ' has-drawer' : ''}${drawerWide ? ' drawer-wide' : ''}`}>
        {error && <p className="error" role="alert">{error}</p>}
        {!cat && !error && <p className="muted">{lang === 'es' ? 'Cargando catálogo NASA…' : 'Loading NASA catalog…'}</p>}

        {/* ===================================================================== */}
        {/* PHASE 1: BRIEFING & METHOD                                            */}
        {/* ===================================================================== */}
        {phase === 'briefing' && (
          <div className="lp">
            <section className="lp-hero">
              <BrandPattern className="lp-hero-art" cols={7} rows={6} seed={11} />
              <div className="lp-wrap">
                <p className="eyebrow">{t.phase1.kicker}</p>
                <h1 className="lp-title">{t.phase1.headline}</h1>
                <div className="lp-ctas">
                  <button type="button" className="pill-cta" onClick={() => switchPhase('planet')}>
                    {t.phase1.ctaPlanet}
                  </button>
                  <button
                    type="button"
                    className="pill-cta ghost"
                    onClick={() => document.getElementById('briefing-demos')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    {t.phase1.ctaCases}
                  </button>
                </div>
              </div>
            </section>

            <section className="lp-lead">
              <div className="lp-wrap lp-lead-grid">
                <p className="lp-serif">{t.phase1.sub}</p>
                <dl className="lp-stats">
                  <div>
                    <dt>{t.phase1.stats.vars}</dt>
                    <dd className="num">{cat ? cat.variables.length : 17}</dd>
                    <dd className="sub">{t.phase1.stats.varsSub}</dd>
                  </div>
                  <div>
                    <dt>{t.phase1.stats.years}</dt>
                    <dd className="num">{cat ? cat.last_year - cat.first_year + 1 : 45}</dd>
                    <dd className="sub">{t.phase1.stats.yearsSub}</dd>
                  </div>
                  <div>
                    <dt>{t.phase1.stats.cells}</dt>
                    <dd className="num">2,592</dd>
                    <dd className="sub">{t.phase1.stats.cellsSub}</dd>
                  </div>
                  <div>
                    <dt>{t.phase1.stats.countries}</dt>
                    <dd className="num">{cat ? Object.keys(cat.countries).length : 249}</dd>
                    <dd className="sub">{t.phase1.stats.countriesSub}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="lp-section">
              <div className="lp-wrap">
                <h2 className="lp-h2">{t.phase1.qTitle}</h2>
                <div className="lp-cols">
                  {t.phase1.questions.map((item, i) => (
                    <article key={item.q}>
                      <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
                      <h3>{item.q}</h3>
                      <p>{item.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="lp-band">
              <div className="lp-wrap">
                <h2 className="lp-h2 lp-h2-xl">{t.phase1.trapTitle}</h2>
                <div className="lp-band-grid">
                  <div>
                    <p className="lp-serif">{t.phase1.trapDesc}</p>
                    <p className="lp-note">{t.phase1.trapNote}</p>
                  </div>
                  <div>
                    <p className="eyebrow">{t.phase1.trapTableTitle}</p>
                    <div className="scroll">
                      <table className="bench-table">
                        <thead>
                          <tr>
                            {t.phase1.trapCols.map((col) => <th key={col}>{col}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {MONTE_CARLO_ROWS.map((row) => (
                            <tr key={row.phi}>
                              <td className="num">φ = {lang === 'en' ? (row.phiEn ?? row.phi) : row.phi}</td>
                              <td className="num bad-val">{lang === 'en' ? row.naiveEn : row.naive}</td>
                              <td className="num good-val">{lang === 'en' ? row.verdictEn : row.verdict}</td>
                              <td><span className="badge significant">{lang === 'en' ? row.tagEn : row.tagEs}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="lp-section">
              <div className="lp-wrap">
                <h2 className="lp-h2">{t.phase1.semaforoTitle}</h2>
                <div className="lp-cols lp-cols-3">
                  {t.phase1.semaforo.map((item) => (
                    <article key={item.tone} className={`lp-verdict ${item.tone}`}>
                      <span className={`badge ${item.tone}`}>{item.badge}</span>
                      <h3>{item.title}</h3>
                      <p>{item.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            {cat && (
              <section id="briefing-demos" className="lp-section lp-cases">
                <div className="lp-wrap">
                  <h2 className="lp-h2">{t.phase1.demosTitle}</h2>
                  <p className="lp-sub">{t.phase1.demosSub}</p>
                  <div className="lp-case-grid">
                    {cat.demos.map((rawD) => {
                      const d = tDemo(rawD, lang)
                      return (
                        <article key={rawD.region + rawD.variable} className="lp-case">
                          <span className="eyebrow num">{d.variable}</span>
                          <h3>{d.title}</h3>
                          <p>{d.why}</p>
                          <div className="lp-case-actions">
                            <button type="button" className="pill-cta sm" onClick={() => openDemo(rawD, false)}>
                              {t.phase1.demoBtn}
                            </button>
                            <button type="button" className="link" onClick={() => openDemo(rawD, true)}>
                              {t.phase1.demoGlobeBtn}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* PHASE 2: UNIFIED 3D PLANET EXPLORER                                   */}
        {/* ===================================================================== */}
        {(phase === 'planet' || phase === 'studio') && (
          <GlobeSection
            cat={cat}
            lang={lang}
            spot={spot}
            second={second}
            pickSecond={pickSecond}
            onPickSecondChange={setPickSecond}
            search={search}
            onSearchChange={setSearch}
            found={found}
            onSearch={doSearch}
            onPickPlace={pickPoint}
            question={question}
            onQuestionChange={setQuestion}
            askInfo={askInfo}
            onAsk={ask}
            concern={concern}
            onConcernChange={setConcern}
            placeType={placeType}
            onPlaceTypeChange={setPlaceType}
            recommended={recommended}
            variable={variable}
            onVariableChange={setVariable}
            start={start}
            onStartChange={setStart}
            years={years}
            busy={busy}
            onLaunchStudio={() => investigate({ variable, start, spot })}
          />
        )}

        {/* ===================================================================== */}
        {/* PHASE 3: DATEX & ANALYTICS STUDIO                                   */}
        {/* ===================================================================== */}
        {phase === 'studio' && query && cat && (
          <aside className="studio-drawer" aria-label={lang === 'es' ? 'Análisis estadístico del lugar' : 'Statistical analysis of the place'}>
          <div className="phase-stack" aria-live="polite">
            {/* Sticky Zone Context Header */}
            <section className="studio-context-bar">
              <div className="studio-context-left">
                <span className="zone-tag">{t.phase2.selectedBadge}</span>
                <div className="studio-place-row">
                  <h2>{query.spot.label}</h2>
                  <span className="num muted small">
                    {query.spot.lat.toFixed(2)}°, {query.spot.lon.toFixed(2)}°
                  </span>
                  {weatherNow && weatherNow.key === queryCoordKey && (
                    <span className="badge not_yet" title="Meteomatics live">
                      {fmtNum(weatherNow.tempC, lang, 3)} °C
                      {weatherNow.uv !== undefined ? ` · UV ${fmtNum(weatherNow.uv, lang, 2)}` : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="studio-quick-controls">
                <select
                  aria-label="Variable"
                  value={query.variable}
                  onChange={(e) => openVariableInStudio(e.target.value)}
                >
                  {cat.variables.map((rawV) => {
                    const v = tVariable(rawV, lang)
                    return <option key={v.key} value={v.key}>{v.label}</option>
                  })}
                </select>
                <select
                  aria-label="Start Year"
                  value={query.start}
                  onChange={(e) => {
                    const y = Number(e.target.value)
                    setStart(y)
                    investigate({ ...query, start: y })
                  }}
                >
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button type="button" className="secondary" onClick={() => switchPhase('planet')}>
                  {t.phase3.backToPlanet}
                </button>
                <button type="button" className="secondary drawer-size" aria-pressed={drawerWide} onClick={() => setDrawerWide((v) => !v)}>
                  {drawerWide ? (lang === 'es' ? 'Reducir panel' : 'Narrow panel') : (lang === 'es' ? 'Ampliar panel' : 'Widen panel')}
                </button>
                <button type="button" className="secondary" onClick={() => openTab('compare')}>
                  {t.phase3.compareShortcut}
                </button>
              </div>
            </section>

            {/* Studio Tabs */}
            <div className="tabs" role="tablist">
              {TAB_ORDER.map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => openTab(k)}
                >
                  {t.phase3.tabs[k]}
                </button>
              ))}
            </div>

            {busy && !['relate', 'population', 'satellite', 'compare'].includes(tab) && (
              <p className="muted">
                {lang === 'es' ? 'Procesando datos satelitales y pruebas estadísticas…' : 'Analyzing NASA records & statistical tests…'}
              </p>
            )}

            {tab === 'trend' && trend && (
              <TrendView
                data={trend}
                where={query.spot.label}
                varLabel={activeVar?.label ?? trend.result.label}
                reliability={activeVar?.reliability ?? ''}
                scenario={scenario}
                onScenario={loadScenario}
                start={query.start}
                lang={lang}
              />
            )}

            {tab === 'scan' && scan && regions && (
              <ScanAndRegionsView
                scan={scan}
                regions={regions}
                where={query.spot.label}
                varLabel={activeVar?.label ?? query.variable}
                cat={cat}
                lang={lang}
                onOpen={openVariableInStudio}
              />
            )}

            {tab === 'compare' && (
              <ComparePlaces
                variable={query.variable}
                start={query.start}
                a={query.spot}
                second={second}
                onSecond={(s) => setSecond(s)}
                regions={cat.regions}
                lang={lang}
                onPickOnGlobe={() => {
                  setPickSecond(true)
                  switchPhase('planet')
                }}
              />
            )}

            {tab === 'satellite' && (
              <SatelliteView
                lat={query.spot.lat}
                lon={query.spot.lon}
                label={query.spot.label}
                lang={lang}
              />
            )}

            {tab === 'population' && (
              <DemographyView
                key={query.spot.iso3 ?? 'NIC'}
                cat={cat}
                country={query.spot.iso3}
                start={query.start}
                lang={lang}
              />
            )}

            {tab === 'relate' && relateQuery && (
              <RelateView
                key={`${query.variable}-${query.spot.lat}-${query.spot.lon}-${query.start}`}
                cat={cat}
                query={relateQuery}
                lang={lang}
              />
            )}
          </div>
          </aside>
        )}

        {cat && phase === 'briefing' && (
          <footer className="site-footer">
            {lang === 'es'
              ? cat.data_note
              : 'Data source: NASA POWER (MERRA-2 reanalysis & CERES satellite observations), Microsoft Planetary Computer (Landsat/Sentinel-2), UN World Population Prospects (OWID), and World Bank. Each POWER point represents a ~50 × 60 km grid cell — confirm local findings with independent station or satellite sensors.'}
          </footer>
        )}
      </main>
    </div>
  )
}

function TrendView({
  data,
  where,
  varLabel,
  reliability,
  scenario,
  onScenario,
  start,
  lang,
}: {
  data: TrendResponse
  where: string
  varLabel: string
  reliability: string
  scenario: Forecast | null
  onScenario: (y: number) => void
  start: number
  lang: Lang
}) {
  const t = data.result
  const unit = tUnit(t.unit, lang)
  const kpi = UI[lang].phase3.kpi
  const scCopy = UI[lang].phase3.scenario
  const rig = UI[lang].phase3.rigor

  const [toYear, setToYear] = useState(2050)
  const [rigorOpen, setRigorOpen] = useState(false)

  const cert = certaintyInfo(t.mk_p, t.verdict, lang)
  const sign = t.slope_per_decade > 0 ? '+' : ''
  const totSign = t.total_change > 0 ? '+' : ''
  const rangeJoin = lang === 'es' ? 'a' : 'to'

  // Progress ratio for Data Sufficiency bar
  const needed = t.years_needed ?? t.n_years
  const ratioPct = t.verdict === 'significant'
    ? 100
    : Math.max(12, Math.min(96, Math.round((t.n_years / Math.max(1, needed)) * 100)))
  const missingYears = t.years_needed && t.years_needed > t.n_years ? t.years_needed - t.n_years : 0

  function pickScenarioYear(y: number) {
    setToYear(y)
    onScenario(y)
  }

  return (
    <div className="studio-block">
      {/* Traffic-Light Verdict Banner */}
      <div className={`verdict hero-verdict ${t.verdict}`}>
        <div className="row">
          <div>
            <span className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.first_year}–{t.last_year} · {where}
            </span>
            <h2 style={{ fontSize: '1.35rem', marginTop: 2 }}>{varLabel}</h2>
          </div>
          <span className={`badge lg ${t.verdict}`}>{verdictLabel(t.verdict, lang)}</span>
        </div>
        <p className="lead">{humanVerdictSummary(t, where, varLabel, lang)}</p>
      </div>

      {/* 4 Visual KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-kicker">{kpi.what}</span>
          <strong className="kpi-val">{DIRECTION_ARROW[t.direction]} {varLabel}</strong>
          <em className="muted small">{t.first_year}–{t.last_year} ({t.n_years} {kpi.yearsWord})</em>
        </div>

        <div className="kpi-card">
          <span className="kpi-kicker">{kpi.pace}</span>
          <strong className="num kpi-val">
            {sign}{fmtNum(t.slope_per_decade, lang)} {unit} {kpi.perDecade}
          </strong>
          <em className="muted small">
            {totSign}{fmtNum(t.total_change, lang)} {unit} {kpi.totalOver} {t.n_years} {kpi.yearsWord}
            {t.percent_change !== null ? ` (${totSign}${t.percent_change.toFixed(1)}%)` : ''}
          </em>
          <span className="muted small">
            {kpi.plausibleRange} {fmtNum(t.ci_low_per_decade, lang)} {rangeJoin} {fmtNum(t.ci_high_per_decade, lang)}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-kicker">{kpi.certainty}</span>
          <strong className="kpi-val" style={{ color: cert.tone === 'high' ? 'var(--accent)' : cert.tone === 'mid' ? 'var(--amber)' : 'var(--no)' }}>
            {cert.headline}
          </strong>
          <div className="meter-track">
            <div className={`meter-fill ${cert.tone}`} style={{ width: `${cert.pct}%` }} />
          </div>
          <em className="muted small">
            {cert.detail}
          </em>
        </div>

        <div className="kpi-card">
          <span className="kpi-kicker">{kpi.data}</span>
          <strong className="num kpi-val">
            {t.n_years} {t.verdict !== 'significant' && t.years_needed ? `/ ~${t.years_needed}` : ''} {kpi.yearsWord}
          </strong>
          <div className="meter-track">
            <div
              className={`meter-fill ${t.verdict === 'significant' ? 'high' : 'mid'}`}
              style={{ width: `${ratioPct}%` }}
            />
          </div>
          <em className="muted small">
            {t.verdict === 'significant'
              ? kpi.enoughData
              : missingYears > 0
                ? `${kpi.missingYearsPrefix} ~${missingYears} ${kpi.missingYearsSuffix}`
                : kpi.enoughData}
          </em>
        </div>
      </div>

      {/* Warnings & Reliability */}
      {t.warnings.length > 0 && (
        <ul className="warnings">
          {t.warnings.map((w) => (
            <li key={w}>{translateWarning(w, lang)}</li>
          ))}
        </ul>
      )}
      {reliability && (
        <p className="muted small" style={{ margin: '6px 0 14px' }}>
          ℹ {reliability}
        </p>
      )}

      {/* Clean Interactive Chart */}
      <TrendChart trend={t} forecast={scenario} lang={lang} />

      {/* Future Scenario Card */}
      <div className="scenario-card">
        <div className="row">
          <div>
            <strong>{scCopy.title}</strong>
            <p className="muted small" style={{ margin: '2px 0 0' }}>{scCopy.note}</p>
          </div>
          <div className="scenario-pills">
            {[2030, 2040, 2050, 2075, 2100].map((y) => (
              <button
                key={y}
                type="button"
                className={`chip ${scenario && toYear === y ? 'on' : ''}`}
                onClick={() => pickScenarioYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        {scenario && (
          <div className="scenario-result">
            <p style={{ margin: '8px 0 4px' }}>{formatForecastText(scenario, varLabel, t.unit, lang)}</p>
            {scenario.warnings.map((w) => (
              <p key={w} className="muted small" style={{ margin: '2px 0' }}>{translateWarning(w, lang)}</p>
            ))}
          </div>
        )}
      </div>

      {/* Grounded AI / Template Explainer */}
      <ExplainPanel
        request={{
          kind: 'trend',
          variable: t.variable,
          lat: data.lat,
          lon: data.lon,
          place: where,
          start,
          to_year: toYear,
        }}
        lang={lang}
      />

      {/* Collapsible Statistical Details & Methodology */}
      <div className="rigor-card">
        <button
          type="button"
          className="rigor-toggle"
          aria-expanded={rigorOpen}
          onClick={() => setRigorOpen(!rigorOpen)}
        >
          <span>{rig.summaryStudent}</span>
          <span>{rigorOpen ? '▲' : '▼'}</span>
        </button>

        {rigorOpen && (
          <div className="rigor-body">
            <p className="small muted" style={{ marginTop: 0 }}>
              {rig.methodTitle} · n = {t.n_years}, n_eff = {fmtNum(t.n_effective, lang, 3)}, lag-1 r = {fmtNum(t.autocorrelation, lang, 2)}
            </p>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    {rig.cols.map((col) => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{rig.row1}</td>
                    <td className="num">{fmtNum(t.slope_per_decade, lang)}</td>
                    <td className="num">{fmtNum(t.ci_low_per_decade, lang)} {rangeJoin} {fmtNum(t.ci_high_per_decade, lang)}</td>
                    <td className="num">{fmtProb(t.mk_p, lang)} (τ = {fmtNum(t.mk_tau, lang, 2)})</td>
                  </tr>
                  <tr>
                    <td>{rig.row2}</td>
                    <td className="num">{fmtNum(t.ols_slope_per_decade, lang)}</td>
                    <td className="num">{fmtNum(t.ols_ci_low_per_decade, lang)} {rangeJoin} {fmtNum(t.ols_ci_high_per_decade, lang)}</td>
                    <td className="num">{fmtProb(t.ols_p, lang)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {t.methods_agree ? rig.agreeYes : rig.agreeNo}{' '}
              {data.source === 'nasa-power' ? rig.sourceLive : rig.sourceLocal}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ScanAndRegionsView({
  scan,
  regions,
  where,
  varLabel,
  cat,
  lang,
  onOpen,
}: {
  scan: ScanResponse
  regions: RegionTrend[]
  where: string
  varLabel: string
  cat: Catalog
  lang: Lang
  onOpen: (key: string) => void
}) {
  const sCopy = UI[lang].phase3.scan
  const ok = regions.filter((r) => r.result)
  const ups = ok.filter((r) => r.result!.significant && r.result!.direction === 'up').length
  const downs = ok.filter((r) => r.result!.significant && r.result!.direction === 'down').length

  return (
    <div className="studio-block">
      <div className="chart-card">
        <h3 style={{ marginTop: 0 }}>{sCopy.title} {where}</h3>
        <p className="muted small">{sCopy.sub}</p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {sCopy.colsScan.map((c) => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {scan.results.map((r) => {
                const rawV = cat.variables.find((v) => v.key === r.variable)
                const vName = rawV ? tVariable(rawV, lang).label : r.label
                const unit = tUnit(r.unit, lang)
                const cert = certaintyInfo(r.mk_p, r.verdict, lang)
                return (
                  <tr key={r.variable}>
                    <td>
                      <button className="link" onClick={() => onOpen(r.variable)}>{vName}</button>
                    </td>
                    <td className="num">{DIRECTION_ARROW[r.direction]}</td>
                    <td className="num">{r.slope_per_decade > 0 ? '+' : ''}{fmtNum(r.slope_per_decade, lang)} {unit}</td>
                    <td className="num">
                      {cert.headline}
                      {r.p_adjusted !== null && (
                        <span className="muted small" style={{ display: 'block' }}>
                          p_adj {fmtProb(r.p_adjusted, lang)}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${r.verdict}`}>{verdictLabel(r.verdict, lang)}</span>
                      {r.step_year && (
                        <span className="badge not_yet" style={{ marginLeft: 6 }}>
                          {lang === 'es' ? `salto ${r.step_year}` : `jump ${r.step_year}`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>{sCopy.bonferroniNote}</p>
      </div>

      <div className="chart-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>{sCopy.regionsTitle} ({varLabel})</h3>
        <p className="muted small">
          {sCopy.regionsSub}{' '}
          {lang === 'es'
            ? `(${ups} suben y ${downs} bajan significativamente.)`
            : `(${ups} rising and ${downs} falling significantly.)`}
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {sCopy.colsReg.map((c) => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {regions.map((row) => {
                const reg = tRegion(row.region, lang)
                if (!row.result) {
                  return (
                    <tr key={reg.id}>
                      <td>{reg.label}</td>
                      <td colSpan={4} className="muted">{row.error}</td>
                    </tr>
                  )
                }
                const r = row.result
                const unit = tUnit(r.unit, lang)
                const cert = certaintyInfo(r.mk_p, r.verdict, lang)
                return (
                  <tr key={reg.id}>
                    <td>
                      <strong>{reg.label}</strong>
                      <br />
                      <span className="muted small">{reg.biome}</span>
                    </td>
                    <td className="num">{DIRECTION_ARROW[r.direction]}</td>
                    <td className="num">{r.slope_per_decade > 0 ? '+' : ''}{fmtNum(r.slope_per_decade, lang)} {unit}</td>
                    <td className="num">{cert.headline}</td>
                    <td>
                      <span className={`badge ${r.verdict}`}>{verdictLabel(r.verdict, lang)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
