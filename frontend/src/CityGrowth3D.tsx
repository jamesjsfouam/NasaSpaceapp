import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type FilterSpecification, type GeoJSONSourceSpecification, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadCity, type CityIndexEntry, type CityPayload } from './cities'
import { CITY, fmtNum, type Lang } from './i18n'

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    base: {
      type: 'raster', tileSize: 256, maxzoom: 16,
      tiles: [`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
      attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors · Impact Observatory/Esri LULC · Copernicus DEM',
    },
    labels: {
      type: 'raster', tileSize: 256, maxzoom: 16,
      tiles: [`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
    },
  },
  layers: [
    { id: 'base', type: 'raster', source: 'base' },
    { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.85 } },
  ],
}

const BASE_COLOR = '#14206b' // azul marino con algo de luz para que se lea el relieve
const PROJ_NEAR = '#56e1e8'
const PROJ_FAR = '#a6f1f5'

function decode(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Variación determinista por celda (0–1) para que las alturas no se vean planas. */
function jitter(r: number, c: number): number {
  const x = Math.sin(r * 127.1 + c * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function heightOf(density: number, r: number, c: number): number {
  return 6 + 54 * Math.pow(density / 100, 1.3) + jitter(r, c) * 6
}

/** Una celda = un polígono. k=0: construido en el año base; k=1: añadido por el escenario (y = año). */
type CellFeature = {
  type: 'Feature'
  properties: { k: number; y: number; h: number }
  geometry: { type: 'Polygon'; coordinates: number[][][] }
}
type CellCollection = { type: 'FeatureCollection'; features: CellFeature[] }

function buildFeatures(city: CityPayload): CellCollection {
  const { cols, rows, west, south, east, north } = city.grid
  const dlon = (east - west) / cols
  const dlat = (north - south) / rows
  const dens = decode(city.density)
  const added = decode(city.added)
  const water = decode(city.water)
  const inset = 0.05
  const feats: CellFeature[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const d = dens[i]
      const a = added[i]
      if (d === 0 && a === 0) continue
      if (water[i] && a === 0) continue
      const w = west + (c + inset) * dlon
      const e = west + (c + 1 - inset) * dlon
      const n = north - (r + inset) * dlat
      const s = north - (r + 1 - inset) * dlat
      const projected = d === 0 && a > 0
      feats.push({
        type: 'Feature',
        properties: {
          k: projected ? 1 : 0,
          y: projected ? city.years[a] : city.base_year,
          h: projected ? heightOf(city.new_cell_density * 100, r, c) : heightOf(d, r, c),
        },
        geometry: { type: 'Polygon', coordinates: [[[w, n], [e, n], [e, s], [w, s], [w, n]]] },
      })
    }
  }
  return { type: 'FeatureCollection', features: feats }
}

export function CityGrowth3D({ entry, lang }: { entry: CityIndexEntry; lang: Lang }) {
  const T = CITY[lang]
  const [city, setCity] = useState<CityPayload | null>(null)
  const [error, setError] = useState(false)
  const [yearIdx, setYearIdx] = useState(0)
  const [onlyProjected, setOnlyProjected] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [visible, setVisible] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const readyRef = useRef(false)
  const live = useRef({ yearIdx: 0, onlyProjected: false })

  useEffect(() => {
    let alive = true
    setCity(null)
    setError(false)
    setYearIdx(0)
    setPlaying(false)
    loadCity(entry).then((c) => alive && setCity(c)).catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [entry])

  const features = useMemo(() => (city ? buildFeatures(city) : null), [city])
  const years = city?.years ?? []
  const year = years[yearIdx] ?? 0

  function applyState(map: maplibregl.Map) {
    if (!city) return
    const y = city.years[live.current.yearIdx]
    if (map.getLayer('city-proj')) {
      map.setFilter('city-proj', ['all', ['==', ['get', 'k'], 1], ['<=', ['get', 'y'], y]] as FilterSpecification)
    }
    if (map.getLayer('city-base')) {
      map.setPaintProperty('city-base', 'fill-extrusion-opacity', live.current.onlyProjected ? 0.1 : 0.92)
    }
  }

  // El mapa se crea una vez por ciudad; el GeoJSON se construye una vez y los años solo cambian el filtro.
  useEffect(() => {
    if (!city || !features || !wrapRef.current) return
    readyRef.current = false
    const map = new maplibregl.Map({
      container: wrapRef.current,
      style: STYLE,
      center: [city.lon, city.lat],
      zoom: 11.3,
      pitch: 58,
      bearing: -18,
      maxPitch: 80,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true }), 'top-right')
    map.on('load', () => {
      map.addSource('city', { type: 'geojson', data: features as unknown as GeoJSONSourceSpecification['data'] })
      map.addLayer({
        id: 'city-base', type: 'fill-extrusion', source: 'city',
        filter: ['==', ['get', 'k'], 0],
        paint: {
          'fill-extrusion-color': BASE_COLOR,
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.92,
        },
      })
      map.addLayer({
        id: 'city-proj', type: 'fill-extrusion', source: 'city',
        filter: ['all', ['==', ['get', 'k'], 1], ['<=', ['get', 'y'], city.base_year]] as FilterSpecification,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'y'],
            city.years[1] ?? 2030, PROJ_NEAR, city.years[city.years.length - 1] ?? 2050, PROJ_FAR,
          ],
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
        },
      })
      readyRef.current = true
      applyState(map)
    })
    return () => {
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, features])

  useEffect(() => {
    live.current = { yearIdx, onlyProjected }
    const map = mapRef.current
    if (map && readyRef.current) applyState(map)
    // conteo de celdas visibles (también sirve como comprobación en pruebas)
    if (features && city) {
      let n = 0
      for (const f of features.features) {
        const p = f.properties
        if (p.k === 0 ? !onlyProjected : p.y <= (years[yearIdx] ?? 0)) n++
      }
      setVisible(n)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearIdx, onlyProjected, city, features])

  useEffect(() => {
    if (!playing || !city) return
    const id = window.setInterval(() => {
      setYearIdx((i) => {
        if (i >= city.years.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 1100)
    return () => window.clearInterval(id)
  }, [playing, city])

  if (error) return <p className="error" role="alert">{T.error}</p>
  if (!city) return <p className="muted">{T.loading}</p>

  const key = String(year)
  const km2 = city.stats.built_km2[key]
  const base = city.stats.built_km2[String(city.base_year)]
  const pct = km2 !== undefined && base ? (km2 / base - 1) * 100 : 0
  const pctText = `${pct >= 0 ? '+' : '−'}${fmtNum(Math.abs(pct), lang, 2)} %`
  const urb = city.stats.urban_population_million?.[key]
  const v = city.validation
  const times = v.baseline_random ? v.figure_of_merit / v.baseline_random : 0
  const vsNear = v.baseline_proximity ? v.figure_of_merit / v.baseline_proximity : 0

  return (
    <section className="city3d" aria-label={T.title}>
      <div className="city3d-head">
        <h3 className="city3d-title">{T.title} · {city.name}</h3>
        <span className="city3d-badge">{T.badge}</span>
      </div>
      <p className="muted small city3d-intro">{T.intro}</p>

      <div className="city3d-map-wrap">
        <div ref={wrapRef} className="city3d-map" role="img" aria-label={T.mapLabel} />
        <div className="city3d-legend" aria-hidden="true">
          <span><i className="sw sw-base" />{T.legendBase} {city.base_year}</span>
          <span><i className="sw sw-proj" />{T.legendProjected}</span>
        </div>
      </div>

      <div className="city3d-controls">
        <button
          type="button" className="secondary city3d-play" aria-pressed={playing}
          onClick={() => {
            if (!playing && yearIdx >= years.length - 1) setYearIdx(0)
            setPlaying((p) => !p)
          }}
        >
          {playing ? T.pause : T.play}
        </button>
        <div className="city3d-slider">
          <input
            type="range" min={0} max={years.length - 1} step={1} value={yearIdx}
            aria-label={T.yearAria} aria-valuetext={String(year)}
            onChange={(e) => { setPlaying(false); setYearIdx(Number(e.target.value)) }}
          />
          <div className="city3d-ticks" aria-hidden="true">
            {years.map((y, i) => (
              <button type="button" key={y} tabIndex={-1} className={i === yearIdx ? 'on' : ''}
                onClick={() => { setPlaying(false); setYearIdx(i) }}>{y}</button>
            ))}
          </div>
        </div>
        <label className="check-inline city3d-only">
          <input type="checkbox" checked={onlyProjected} onChange={(e) => setOnlyProjected(e.target.checked)} />
          <span>{T.onlyProjected}</span>
        </label>
      </div>

      <div className="city3d-kpis">
        <div className="kpi-card">
          <span className="kpi-kicker">{T.built}</span>
          <span className="kpi-val num">{km2 !== undefined ? `${fmtNum(km2, lang, 4)} km²` : '—'}</span>
          <em>{year === city.base_year ? `${T.year} ${year}` : `${pctText} ${T.change} ${city.base_year}`}</em>
        </div>
        {urb !== undefined && (
          <div className="kpi-card">
            <span className="kpi-kicker">{T.urbanPop}</span>
            <span className="kpi-val num">{fmtNum(urb, lang, 3)} {T.urbanPopUnit}</span>
            <em>{T.year} {year}</em>
          </div>
        )}
        <div className="kpi-card">
          <span className="kpi-kicker">{T.year}</span>
          <span className="kpi-val num">{year}</span>
          <em>{visible !== null ? `${visible.toLocaleString(lang === 'es' ? 'es' : 'en-US')} ${lang === 'es' ? 'celdas visibles' : 'visible cells'}` : ''}</em>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{km2 !== undefined ? T.summary(year, fmtNum(km2, lang, 4), pctText, city.base_year) : ''}</p>

      <details className="city3d-how">
        <summary>{T.how}</summary>
        <h4 className="stat-sub-title">{T.methodTitle}</h4>
        <p className="small">{T.method}</p>
        <h4 className="stat-sub-title">{T.reliabilityTitle}</h4>
        <p className="small">
          {T.reliability(v.fit, v.test, fmtNum(v.auc, lang, 3), fmtNum(times, lang, 2), fmtNum(vsNear, lang, 2))}
        </p>
        <h4 className="stat-sub-title">{T.caveatsTitle}</h4>
        <ul className="small">{T.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
        <h4 className="stat-sub-title">{T.sources}</h4>
        <ul className="small">{city.sources.map((s) => <li key={s}>{s}</li>)}</ul>
      </details>
    </section>
  )
}

