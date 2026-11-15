import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type Catalog, type Place, type Variable } from './api'
import type { Basemap, CameraCmd, GlobeData } from './Globe3D'
import { legendClasses } from './globeColors'
import {
  CONCERNS_EN, fmtNum, PLACE_TYPES_EN, shortVarName, tRegion, tUnit, tVariable, UI,
  type Lang,
} from './i18n'

const Globe3D = lazy(() => import('./Globe3D').then((m) => ({ default: m.Globe3D })))

export type Spot = { lat: number; lon: number; label: string; iso3: string | null; country: string | null }
export type SecondSpot = { lat: number; lon: number; label: string }

type Props = {
  cat: Catalog | null
  lang: Lang
  spot: Spot
  second: SecondSpot | null
  pickSecond: boolean
  onPickSecondChange: (v: boolean) => void
  search: string
  onSearchChange: (v: string) => void
  found: Place[]
  onSearch: (q?: string) => void
  onPickPlace: (p: { lat: number; lon: number }, label?: string, fromGlobeClick?: boolean) => void
  question: string
  onQuestionChange: (v: string) => void
  askInfo: string | null
  onAsk: () => void
  concern: string
  onConcernChange: (k: string) => void
  placeType: string | null
  onPlaceTypeChange: (k: string | null) => void
  recommended: Variable[]
  variable: string
  onVariableChange: (k: string) => void
  start: number
  onStartChange: (y: number) => void
  years: number[]
  busy: boolean
  onLaunchStudio: () => void
  cityAvailable?: boolean
  onOpenCity?: () => void
}

// ---- iconos mínimos (sin librería) ---------------------------------------------------------
const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const IPlus = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>
const IMinus = () => <Svg><path d="M5 12h14" /></Svg>
const ITarget = () => <Svg><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Svg>
const IGlobe = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></Svg>
const IFlat = () => <Svg><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 12h18M9 5v14M15 5v14" /></Svg>
const ILayers = () => <Svg><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5" /></Svg>
const ICheck = () => <Svg><path d="m5 12 4.5 4.5L19 7" /></Svg>
const ILink = () => <Svg><circle cx="5" cy="17" r="2" /><circle cx="19" cy="7" r="2" /><path d="M7 16c4-1 6-5 10-8" strokeDasharray="2 3" /></Svg>
const ISearch = () => <Svg><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></Svg>
const IPin = () => <Svg><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21Z" /><circle cx="12" cy="9.500" r="2.500" /></Svg>
const ILocate = () => <Svg><path d="M3 11 21 3l-8 18-2-8-8-2Z" /></Svg>
const IChevron = ({ up }: { up?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: up ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6" /></svg>
)

const BASEMAPS: Basemap[] = ['light', 'streets', 'satellite', 'night']

/** Fase 2: el planeta a pantalla completa. Paneles flotantes sobre un mapa que ocupa toda la pantalla. */
export function GlobeSection(props: Props) {
  const {
    cat, lang, spot, second, pickSecond, onPickSecondChange,
    search, onSearchChange, found, onSearch, onPickPlace,
    question, onQuestionChange, askInfo, onAsk,
    concern, onConcernChange, placeType, onPlaceTypeChange,
    recommended, variable, onVariableChange,
    start, onStartChange, years, busy, onLaunchStudio, cityAvailable, onOpenCity,
  } = props

  const t = UI[lang].phase2
  const es = lang === 'es'
  const [data, setData] = useState<GlobeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [layerVar, setLayerVar] = useState('T2M')
  const [layerOpen, setLayerOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)
  const [onlySig, setOnlySig] = useState(false)
  const [basemap, setBasemap] = useState<Basemap>('light')
  const [flat, setFlat] = useState(true)
  const [teleconnections, setTeleconnections] = useState(false)
  const [spin, setSpin] = useState(false)
  const [camSeq, setCamSeq] = useState(0)
  const [camCmd, setCamCmd] = useState<CameraCmd | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api<GlobeData>('/api/globe').then(setData).catch((e: Error) => setError(e.message))
  }, [])

  // El menú de capas se cierra al hacer clic fuera o con Escape
  useEffect(() => {
    if (!layerOpen) return
    const onDown = (e: MouseEvent) => { if (!layerRef.current?.contains(e.target as Node)) setLayerOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLayerOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [layerOpen])

  function fly(kind: CameraCmd['kind']) {
    const seq = camSeq + 1
    setCamSeq(seq)
    setCamCmd({ kind, seq })
    setSpin(kind === 'global')
  }

  function selectLayer(k: string) {
    setLayerVar(k)
    onVariableChange(k)
    setLayerOpen(false)
  }

  function pickFromSearch(p: { lat: number; lon: number }, label?: string) {
    onPickPlace(p, label, false)
    setTimeout(() => fly('zone'), 40)
  }

  // "Usar mi ubicación": geolocalización del navegador (solo al pulsar) + nombre del lugar con Nominatim (OSM).
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)
  function locateMe() {
    if (!('geolocation' in navigator)) {
      setGeoMsg(es ? 'Tu navegador no ofrece geolocalización.' : 'Your browser does not support geolocation.')
      return
    }
    setGeoBusy(true)
    setGeoMsg(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        let label = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lon}&accept-language=${lang}`,
          )
          if (r.ok) {
            const j = (await r.json()) as { name?: string; address?: Record<string, string> }
            const a = j.address ?? {}
            const place = j.name || a.city || a.town || a.village || a.municipality || a.county || a.state
            if (place) label = a.country && a.country !== place ? `${place}, ${a.country}` : place
          }
        } catch {
          /* sin nombre: se usan las coordenadas */
        }
        pickFromSearch({ lat, lon }, label)
        setGeoMsg(es ? `Ubicación fijada: ${label}.` : `Location set: ${label}.`)
        setGeoBusy(false)
      },
      (err) => {
        setGeoBusy(false)
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? (es ? 'Permiso de ubicación denegado. Actívalo en el navegador o busca un lugar a mano.' : 'Location permission denied. Enable it in your browser or search for a place.')
            : err.code === err.TIMEOUT
              ? (es ? 'La ubicación tardó demasiado. Inténtalo de nuevo.' : 'Locating took too long. Try again.')
              : (es ? 'No se pudo obtener tu ubicación.' : 'Could not get your location.'),
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  function pickFromGlobe(lat: number, lon: number) {
    setSpin(false)
    onPickPlace({ lat, lon }, undefined, true)
  }

  const meta = data?.variables[layerVar]
  const pct = meta ? Math.round((100 * meta.fdr_significant) / Math.max(1, meta.cells)) : 0
  const scale = meta?.slope_p98 ?? 0
  const activeVarRaw = cat?.variables.find((v) => v.key === variable)
  const activeVar = activeVarRaw ? tVariable(activeVarRaw, lang) : null
  const layerName = meta ? shortVarName(layerVar, lang, meta.label) : ''
  const globeUnit = meta ? tUnit(meta.unit, lang) : ''
  const perDec = es ? '/década' : '/decade'
  const classes = meta ? legendClasses(layerVar, scale) : []
  const basemapLabel: Record<Basemap, string> = {
    light: es ? 'Mapa' : 'Map',
    streets: es ? 'Calles' : 'Streets',
    satellite: es ? 'Satélite' : 'Satellite',
    night: es ? 'Noche' : 'Night',
  }
  const nextBasemap = BASEMAPS[(BASEMAPS.indexOf(basemap) + 1) % BASEMAPS.length]

  return (
    <div className={`map-stage${wizardOpen ? ' wizard-open' : ''}`} data-basemap={basemap}>
      <div className="map-canvas">
        {data && (
          <Suspense fallback={<div className="map-loading">{es ? 'Inicializando el mapa…' : 'Starting the map…'}</div>}>
            <Globe3D
              data={data}
              variable={layerVar}
              onlySignificant={onlySig}
              basemap={basemap}
              flat={flat}
              showTeleconnections={teleconnections}
              lang={lang}
              onPick={pickFromGlobe}
              focus={spot}
              second={second}
              cameraCmd={camCmd}
              spinEnabled={spin}
            />
          </Suspense>
        )}
        {!data && !error && <div className="map-loading">{es ? 'Cargando el planeta…' : 'Loading the planet…'}</div>}
        {error && (
          <div className="map-loading">
            {es
              ? `El mapa aún no tiene datos (${error}). Genera la malla con scripts/build_globe.py.`
              : `The map has no data yet (${error}). Generate the grid with scripts/build_globe.py.`}
          </div>
        )}
      </div>

      {/* ---- arriba a la izquierda: qué mapa ver ---- */}
      {data && meta && (
        <div className="map-panel map-layer" ref={layerRef}>
          <button
            type="button" className="map-select" aria-haspopup="listbox" aria-expanded={layerOpen}
            onClick={() => setLayerOpen((v) => !v)}
          >
            <span className="map-select-label">
              <span className="eyebrow">{es ? 'Mapa de tendencias' : 'Trend map'}</span>
              <strong>{layerName}</strong>
            </span>
            <IChevron up={layerOpen} />
          </button>
          {layerOpen && (
            <ul className="map-options" role="listbox" aria-label={es ? 'Elegir mapa' : 'Choose a map'}>
              {Object.keys(data.variables).map((k) => (
                <li key={k} role="option" aria-selected={k === layerVar}>
                  <button type="button" className={k === layerVar ? 'on' : ''} onClick={() => selectLayer(k)}>
                    {shortVarName(k, lang, data.variables[k].label)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="map-stat">
            <strong className="num">{pct}%</strong>{' '}
            {es
              ? `de las celdas del mundo muestran un cambio confirmado (${data.period[0]}–${data.period[1]}).`
              : `of the world's cells show a confirmed change (${data.period[0]}–${data.period[1]}).`}
          </p>
          <p className="map-stat-sub num">
            n = {meta.cells.toLocaleString(es ? 'es' : 'en-US')} · FDR q = {fmtNum(data.fdr_q, lang, 2)}
          </p>
        </div>
      )}

      {/* ---- arriba a la derecha: buscar un lugar ---- */}
      {cat && (
        <div className="map-panel map-search">
          <div className="map-search-row">
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              onKeyDown={(e) => e.key === 'Enter' && search.length > 1 && onSearch()}
            />
            <button type="button" className="icon-btn" onClick={() => onSearch()} disabled={search.length < 2}
              aria-label={t.searchBtn} title={t.searchBtn}>
              <ISearch />
            </button>
            <button type="button" className="icon-btn" onClick={locateMe} disabled={geoBusy}
              aria-label={es ? 'Usar mi ubicación' : 'Use my location'}
              title={es ? 'Usar mi ubicación (se envía a OpenStreetMap solo para obtener el nombre del lugar)' : 'Use my location (sent to OpenStreetMap only to look up the place name)'}>
              <ILocate />
            </button>
          </div>
          {geoMsg && <p className="map-geo-msg" role="status">{geoMsg}</p>}
          {found.length > 0 && (
            <ul className="map-results">
              {found.map((p) => (
                <li key={`${p.lat},${p.lon}`}>
                  <button type="button"
                    onClick={() => pickFromSearch({ lat: p.lat, lon: p.lon }, `${p.name}${p.country ? `, ${p.country}` : ''}`)}>
                    <strong>{p.name}</strong>
                    <span>{[p.admin1, p.country].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="map-quick" aria-label={es ? 'Lugares de ejemplo' : 'Example places'}>
            {cat.regions.map((rawR) => {
              const r = tRegion(rawR, lang)
              const on = Math.abs(spot.lat - r.lat) < 0.05 && Math.abs(spot.lon - r.lon) < 0.05
              return (
                <button key={r.id} type="button" className={on ? 'on' : ''}
                  onClick={() => pickFromSearch({ lat: r.lat, lon: r.lon }, r.label)}>
                  {r.label.split(',')[0]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ---- herramientas a la derecha ---- */}
      {data && (
        <div className="map-tools" role="toolbar" aria-label={es ? 'Herramientas del mapa' : 'Map tools'}>
          <button type="button" onClick={() => setBasemap(nextBasemap)}
            title={`${es ? 'Fondo' : 'Basemap'}: ${basemapLabel[basemap]} → ${basemapLabel[nextBasemap]}`}
            aria-label={`${es ? 'Cambiar fondo' : 'Change basemap'}: ${basemapLabel[basemap]}`}>
            <ILayers />
          </button>
          <button type="button" className={onlySig ? 'on' : ''} aria-pressed={onlySig}
            onClick={() => setOnlySig((v) => !v)}
            title={es ? 'Mostrar solo cambios confirmados (FDR)' : 'Show only confirmed changes (FDR)'}
            aria-label={es ? 'Solo cambios confirmados' : 'Only confirmed changes'}>
            <ICheck />
          </button>
          <button type="button" className={teleconnections ? 'on' : ''} aria-pressed={teleconnections}
            onClick={() => setTeleconnections((v) => !v)}
            title={es ? 'Teleconexiones (hipótesis)' : 'Teleconnections (hypotheses)'}
            aria-label={es ? 'Teleconexiones' : 'Teleconnections'}>
            <ILink />
          </button>
          <button type="button" className={flat ? 'on' : ''} aria-pressed={flat} onClick={() => setFlat((v) => !v)}
            title={flat ? (es ? 'Ver como globo' : 'View as globe') : (es ? 'Ver plano' : 'View flat')}
            aria-label={flat ? (es ? 'Ver como globo' : 'View as globe') : (es ? 'Ver plano' : 'View flat')}>
            <IFlat />
          </button>
          <button type="button" onClick={() => fly('global')} title={t.globalBtn} aria-label={t.globalBtn}><IGlobe /></button>
          <button type="button" onClick={() => fly('zone')} title={t.zoomZoneBtn} aria-label={t.zoomZoneBtn}><ITarget /></button>
          <button type="button" onClick={() => fly('in')} title={es ? 'Acercar' : 'Zoom in'} aria-label={es ? 'Acercar' : 'Zoom in'}><IPlus /></button>
          <button type="button" onClick={() => fly('out')} title={es ? 'Alejar' : 'Zoom out'} aria-label={es ? 'Alejar' : 'Zoom out'}><IMinus /></button>
        </div>
      )}

      {/* ---- abajo a la izquierda: leyenda ---- */}
      {data && meta && (
        <div className={`map-panel map-legend ${legendOpen ? '' : 'closed'}`}>
          <button type="button" className="map-legend-head" aria-expanded={legendOpen} onClick={() => setLegendOpen((v) => !v)}>
            <span>
              <strong>{layerName}</strong>{' '}
              <span className="muted">· {globeUnit}{perDec}</span>
            </span>
            <IChevron up={legendOpen} />
          </button>
          {legendOpen && (
            <>
              <div className="legend-blocks" aria-hidden="true">
                {classes.map((c, i) => <span key={i} style={{ background: c.color }} />)}
              </div>
              <div className="legend-edges num" aria-hidden="true">
                {classes.slice(1).map((c, i) => (
                  <span key={i} style={{ left: `${((i + 1) * 100) / 7}%` }}>
                    {c.from !== null ? `${c.from > 0 ? '+' : ''}${fmtNum(c.from, lang, 2)}` : ''}
                  </span>
                ))}
              </div>
              <p className="legend-note">
                <span className="legend-faint" aria-hidden="true" />
                {es ? 'Tono apagado = el cambio no es estadísticamente seguro.' : 'Faint = the change is not statistically certain.'}
              </p>
              <p className="map-credit">NASA POWER · NASA GIBS · Esri · OpenStreetMap</p>
              <details className="legend-help">
                <summary>{es ? 'Cómo leer este mapa' : 'How to read this map'}</summary>
                <p>{t.legendHelp}</p>
              </details>
            </>
          )}
        </div>
      )}

      {/* ---- abajo a la derecha: el lugar elegido ---- */}
      <div className="map-panel map-place">
        <span className="eyebrow">{t.selectedBadge}</span>
        <h2 className="map-place-name"><IPin /> {spot.label}</h2>
        <p className="map-place-sub num">
          {spot.lat.toFixed(2)}°, {spot.lon.toFixed(2)}°
          {second && <span className="second-pill">vs {second.label}</span>}
        </p>
        {activeVar && (
          <p className="map-place-var">
            <span className="muted">{es ? 'Variable a analizar:' : 'Variable to analyse:'}</span> <strong>{activeVar.label}</strong>
          </p>
        )}
        <div className="map-place-actions">
          <button type="button" className="btn primary" onClick={onLaunchStudio} disabled={busy}>
            {busy ? t.busyBtn : t.openStudioNow}
          </button>
          {cityAvailable && onOpenCity && (
            <button type="button" className="btn ghost" onClick={onOpenCity} disabled={busy}>
              {es ? 'Ver la ciudad en 3D' : 'See the city in 3D'}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => setWizardOpen((v) => !v)} aria-expanded={wizardOpen}>
            {es ? 'Ayúdame a elegir' : 'Help me choose'} <IChevron up={wizardOpen} />
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={pickSecond} onChange={(e) => onPickSecondChange(e.target.checked)} />
          <span>{t.compareToggle}</span>
        </label>
      </div>

      {/* ---- cajón "ayúdame a elegir": pregunta libre, preocupación, tipo de lugar y variable ---- */}
      {cat && wizardOpen && (
        <aside className="map-panel map-wizard" aria-label={es ? 'Ayúdame a elegir la variable' : 'Help me choose the variable'}>
          <div className="map-wizard-head">
            <h3>{es ? 'Ayúdame a elegir' : 'Help me choose'}</h3>
            <button type="button" className="icon-btn" onClick={() => setWizardOpen(false)}
              aria-label={es ? 'Cerrar' : 'Close'}>×</button>
          </div>

          <span className="eyebrow">{es ? '1 · Cuéntame tu duda' : '1 · Tell me your question'}</span>
          <div className="map-search-row">
            <input
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              maxLength={500}
              placeholder={t.askPlaceholder}
              aria-label={t.askPlaceholder}
              onKeyDown={(e) => e.key === 'Enter' && question.length > 2 && onAsk()}
            />
            <button type="button" className="btn ghost" onClick={onAsk} disabled={question.length < 3}>{t.askBtn}</button>
          </div>
          {askInfo && <p className="muted small">{askInfo}</p>}

          <span className="eyebrow">{es ? '2 · O elige qué te preocupa' : '2 · Or pick what worries you'}</span>
          <div className="pills">
            {Object.entries(cat.concerns).map(([k, label]) => (
              <button key={k} type="button" className={k === concern ? 'on' : ''} aria-pressed={k === concern}
                onClick={() => onConcernChange(k)}>
                {lang === 'en' ? (CONCERNS_EN[k] ?? label) : label}
              </button>
            ))}
          </div>

          <span className="eyebrow">{t.placeTypeTitle}</span>
          <div className="pills">
            {Object.entries(cat.place_types).map(([k, label]) => (
              <button key={k} type="button" className={k === placeType ? 'on' : ''} aria-pressed={k === placeType}
                onClick={() => onPlaceTypeChange(k === placeType ? null : k)}>
                {lang === 'en' ? (PLACE_TYPES_EN[k] ?? label) : label}
              </button>
            ))}
          </div>

          <span className="eyebrow">{t.recTitle}</span>
          <div className="rec-list">
            {recommended.map((rawV) => {
              const v = tVariable(rawV, lang)
              return (
                <button key={v.key} type="button" className={v.key === variable ? 'on' : ''}
                  onClick={() => onVariableChange(v.key)}>
                  <strong>{v.label} <span className="muted">({v.unit})</span></strong>
                  <span>{v.definition}</span>
                </button>
              )
            })}
          </div>

          <div className="field-row">
            <label>
              {t.allVarsLabel}
              <select value={variable} onChange={(e) => onVariableChange(e.target.value)}>
                {cat.variables.map((rawV) => {
                  const v = tVariable(rawV, lang)
                  return <option key={v.key} value={v.key}>{v.label} ({v.unit})</option>
                })}
              </select>
            </label>
            <label>
              {t.startYearLabel}
              <select value={start} onChange={(e) => onStartChange(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          {activeVar && <p className="note">{activeVar.reliability}</p>}
        </aside>
      )}
    </div>
  )
}
