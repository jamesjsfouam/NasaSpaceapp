import { useEffect, useMemo, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cellColor } from './globeColors'
import { COLOR } from './theme'
import { fmtNum, shortVarName, tUnit, type Lang } from './i18n'

export type GlobeVariable = {
  label: string
  unit: string
  cells: number
  fdr_threshold: number
  fdr_significant: number
  slope_p98: number
}
// [slope per decade, Mann-Kendall p, verdict 2/1/0, mean, passes FDR 1/0]
type CellValue = [number, number, number, number, number]
export type GlobeCell = { lat: number; lon: number } & Record<string, CellValue | number>
export type GlobeData = {
  generated: string
  period: [number, number]
  cell_deg: number
  fdr_q: number
  variables: Record<string, GlobeVariable>
  cells: GlobeCell[]
}

export type Basemap = 'light' | 'satellite' | 'night'
export type CameraCmd = { kind: 'global' | 'center' | 'zone' | 'in' | 'out'; seq: number }

const VERDICT_TIP: Record<Lang, [string, string, string]> = {
  es: ['Sin tendencia clara', 'Todavía no significativa', 'Tendencia significativa'],
  en: ['No clear trend', 'Not yet significant', 'Confirmed trend'],
}

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

// Mapa único: base clara de Esri (por defecto, como un atlas), imagen satelital de la NASA (Blue Marble
// de lejos, Esri World Imagery de cerca) y la vista nocturna VIIRS Black Marble. El planeta es el mismo
// en todas: se gira, se acerca hasta una zona y la malla de tendencias queda encima.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sky: { 'atmosphere-blend': 0 },
  sources: {
    light: {
      type: 'raster', tileSize: 256, maxzoom: 16,
      tiles: [`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
      attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors',
    },
    lightLabels: {
      type: 'raster', tileSize: 256, maxzoom: 16,
      tiles: [`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
    },
    day: {
      type: 'raster', tileSize: 256, maxzoom: 8,
      tiles: [`${GIBS}/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`],
      attribution: 'NASA GIBS · Blue Marble',
    },
    detail: {
      type: 'raster', tileSize: 256, maxzoom: 18,
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      attribution: 'Esri World Imagery',
    },
    satLabels: {
      type: 'raster', tileSize: 256, maxzoom: 16,
      tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
    },
    night: {
      type: 'raster', tileSize: 256, maxzoom: 8,
      tiles: [`${GIBS}/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`],
      attribution: 'NASA GIBS · VIIRS Black Marble',
    },
  },
  layers: [
    { id: 'light', type: 'raster', source: 'light' },
    { id: 'day', type: 'raster', source: 'day', layout: { visibility: 'none' } },
    {
      id: 'detail', type: 'raster', source: 'detail', minzoom: 3.5, layout: { visibility: 'none' },
      paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3.5, 0, 5.8, 1] },
    },
    { id: 'night', type: 'raster', source: 'night', layout: { visibility: 'none' } },
  ],
}
// Las etiquetas van por encima de la malla de tendencias para que los nombres sigan legibles.
const LABEL_LAYERS: { id: string; source: string; minzoom: number; basemap: Basemap }[] = [
  { id: 'light-labels', source: 'lightLabels', minzoom: 2, basemap: 'light' },
  { id: 'sat-labels', source: 'satLabels', minzoom: 3, basemap: 'satellite' },
]
const BASE_LAYERS: Record<Basemap, string[]> = {
  light: ['light', 'light-labels'],
  satellite: ['day', 'detail', 'sat-labels'],
  night: ['night'],
}

type SpotPin = { lat: number; lon: number; label?: string }
type GeoFeatureCollection = Extract<Parameters<GeoJSONSource['setData']>[0], { type: 'FeatureCollection' }>
type GeoFeature = GeoFeatureCollection['features'][number]

const TELECONNECTIONS: GeoFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    // Niño 3.4 (-140, 0) -> Corredor Seco (-86.6, 13.5)
    { type: 'Feature', properties: { name: 'ENSO → Corredor Seco' }, geometry: { type: 'LineString', coordinates: [[-140, 0], [-112, 8], [-86.6, 13.5]] } },
    // Niño 3.4 -> Amazonía (-60, -3.1)
    { type: 'Feature', properties: { name: 'ENSO → Amazonía' }, geometry: { type: 'LineString', coordinates: [[-140, 0], [-100, -4], [-60, -3.1]] } },
    // Niño 3.4 -> Sudeste Asiático (110, 1)
    { type: 'Feature', properties: { name: 'ENSO → Sudeste Asiático' }, geometry: { type: 'LineString', coordinates: [[-140, 0], [-178, 2], [150, 2], [110, 1]] } },
    // Atlántico / Sahel -> Caribe / Centroamérica
    { type: 'Feature', properties: { name: 'Sahel / Atlántico → Caribe' }, geometry: { type: 'LineString', coordinates: [[10, 15], [-35, 16], [-83.8, 12]] } },
    // Amplificación Ártica (Svalbard 15.6, 78.2) -> Europa / Norteamérica
    { type: 'Feature', properties: { name: 'Ártico → Latitudes medias' }, geometry: { type: 'LineString', coordinates: [[15.6, 78.2], [-20, 62], [-75, 42]] } },
  ],
}

type Props = {
  data: GlobeData
  variable: string
  onlySignificant: boolean
  basemap: Basemap
  flat?: boolean
  showTeleconnections?: boolean
  lang: Lang
  onPick: (lat: number, lon: number) => void
  focus?: SpotPin | null
  second?: SpotPin | null
  cameraCmd?: CameraCmd | null
  spinEnabled?: boolean
}

export function Globe3D({
  data,
  variable,
  onlySignificant,
  basemap,
  flat = false,
  showTeleconnections = false,
  lang,
  onPick,
  focus,
  second,
  cameraCmd,
  spinEnabled = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const spotsGeojson = useMemo<GeoFeatureCollection>(() => {
    const features: GeoFeature[] = []
    if (focus) {
      features.push({
        type: 'Feature',
        id: 'spot-a',
        properties: { color: COLOR.spotA, role: 'A' },
        geometry: { type: 'Point', coordinates: [focus.lon, focus.lat] },
      })
    }
    if (second) {
      features.push({
        type: 'Feature',
        id: 'spot-b',
        properties: { color: COLOR.spotB, role: 'B' },
        geometry: { type: 'Point', coordinates: [second.lon, second.lat] },
      })
    }
    return { type: 'FeatureCollection', features }
  }, [focus, second])

  const geojson = useMemo<GeoFeatureCollection>(() => {
    const half = data.cell_deg / 2
    const scale = data.variables[variable]?.slope_p98 ?? 1
    const clampLat = (x: number) => Math.max(-85, Math.min(85, x))
    return {
      type: 'FeatureCollection',
      features: data.cells.flatMap((c, i) => {
        const v = c[variable] as CellValue | undefined
        if (!v || (onlySignificant && !v[4])) return []
        const [w, e, s, n] = [c.lon - half, c.lon + half, clampLat(c.lat - half), clampLat(c.lat + half)]
        return [{
          type: 'Feature' as const,
          id: i,
          properties: {
            lat: c.lat,
            lon: c.lon,
            slope: v[0],
            verdict: v[2],
            fdr: v[4],
            color: cellColor(variable, v[0], scale, v[4] ? 0.86 : 0.1),
          },
          geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
        }]
      }),
    }
  }, [data, variable, onlySignificant])

  const live = useRef({
    onPick,
    spinEnabled,
    flat,
    lang,
    variable,
    meta: data.variables[variable],
    geojson,
    spotsGeojson,
  })
  useEffect(() => {
    Object.assign(live.current, {
      onPick,
      spinEnabled,
      flat,
      lang,
      variable,
      meta: data.variables[variable],
      geojson,
      spotsGeojson,
    })
  })

  useEffect(() => {
    const map = new maplibregl.Map({
      container: wrapRef.current!,
      style: STYLE,
      center: [focus?.lon ?? -60, focus?.lat ?? 12],
      zoom: flat ? 1.6 : 2.3,
      maxZoom: 12,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'globe-popup',
      offset: 10,
    })

    let interacting = false
    const spin = () => {
      if (interacting || !live.current.spinEnabled || live.current.flat || map.getZoom() > 2.6) return
      const c = map.getCenter()
      map.easeTo({ center: [c.lng - 3.2, c.lat], duration: 1000, easing: (t) => t })
    }
    const stop = () => {
      interacting = true
      map.stop()
    }
    const resume = () => {
      interacting = false
      spin()
    }
    map.on('mousedown', stop)
    map.on('touchstart', stop)
    map.on('wheel', stop)
    map.on('mouseup', resume)
    map.on('touchend', resume)
    map.on('dragend', resume)
    map.on('moveend', spin)

    let hovered: number | string | undefined
    map.on('load', () => {
      map.addSource('cells', { type: 'geojson', data: live.current.geojson })
      map.addLayer({
        id: 'cells',
        type: 'fill',
        source: 'cells',
        paint: {
          'fill-color': ['to-color', ['get', 'color']],
          'fill-antialias': false,
          // Smoothly reveal underlying satellite terrain as the user zooms into a region
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 2, 1, 5, 0.92, 7, 0.6, 9, 0.38],
        },
      })
      map.addLayer({
        id: 'cells-grid',
        type: 'line',
        source: 'cells',
        paint: {
          'line-color': 'rgba(28,16,30,0.14)',
          'line-width': 0.5,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 5.5, 0.7, 9, 0.3],
        },
      })
      map.addLayer({
        id: 'cells-hover',
        type: 'line',
        source: 'cells',
        paint: {
          'line-color': '#1c101e',
          'line-width': 2,
          'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
        },
      })

      for (const l of LABEL_LAYERS) {
        map.addLayer({
          id: l.id, type: 'raster', source: l.source, minzoom: l.minzoom,
          layout: { visibility: l.basemap === 'light' ? 'visible' : 'none' },
        })
      }

      map.addSource('teleconnections', { type: 'geojson', data: TELECONNECTIONS })
      map.addLayer({
        id: 'teleconnections',
        type: 'line',
        source: 'teleconnections',
        layout: { visibility: showTeleconnections ? 'visible' : 'none' },
        paint: {
          'line-color': '#7a4cd1',
          'line-width': 2.2,
          'line-dasharray': [2, 2],
          'line-opacity': 0.85,
        },
      })

      map.addSource('selected-spots', { type: 'geojson', data: live.current.spotsGeojson })
      map.addLayer({
        id: 'spot-halo',
        type: 'circle',
        source: 'selected-spots',
        paint: {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.22,
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'color'],
        },
      })
      map.addLayer({
        id: 'spot-dot',
        type: 'circle',
        source: 'selected-spots',
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      spin()
    })

    map.on('mousemove', 'cells', (e) => {
      const f = e.features?.[0]
      if (!f) return
      map.getCanvas().style.cursor = 'pointer'
      if (hovered !== undefined) map.setFeatureState({ source: 'cells', id: hovered }, { hover: false })
      hovered = f.id
      map.setFeatureState({ source: 'cells', id: hovered! }, { hover: true })
      const p = f.properties as { lat: number; lon: number; slope: number; verdict: number; fdr: number }
      const meta = live.current.meta
      const curLang = live.current.lang
      const vName = shortVarName(live.current.variable, curLang, meta.label)
      const unitLabel = tUnit(meta.unit, curLang)
      const perDec = curLang === 'es' ? '/década' : '/decade'
      const fdrLabel = p.fdr ? (curLang === 'es' ? ' · pasa FDR' : ' · passes FDR') : ''
      const tipHint = curLang === 'es'
        ? 'Clic para marcar esta zona'
        : 'Click to select this spot'
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="globe-tip"><b>${vName}</b><br/>` +
          `${p.lat.toFixed(1)}°, ${p.lon.toFixed(1)}°<br/>` +
          `<span class="num">${p.slope > 0 ? '+' : ''}${fmtNum(p.slope, curLang)} ${unitLabel}${perDec}</span><br/>` +
          `${VERDICT_TIP[curLang][p.verdict]}${fdrLabel}<br/>` +
          `<i>${tipHint}</i></div>`,
        )
        .addTo(map)
    })

    map.on('mouseleave', 'cells', () => {
      map.getCanvas().style.cursor = 'crosshair'
      if (hovered !== undefined) map.setFeatureState({ source: 'cells', id: hovered }, { hover: false })
      hovered = undefined
      popup.remove()
    })

    // Unified click anywhere on the planet (cell centers at orbit zoom, exact coordinates when zoomed in)
    map.on('click', (e) => {
      const z = map.getZoom()
      if (z < 3.6) {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['cells'] })[0]
        const props = hit?.properties as { lat?: number; lon?: number } | undefined
        if (props?.lat !== undefined && props?.lon !== undefined) {
          live.current.onPick(props.lat, props.lon)
          return
        }
      }
      const normLon = ((e.lngLat.lng + 540) % 360) - 180
      live.current.onPick(+e.lngLat.lat.toFixed(4), +normLon.toFixed(4))
    })

    return () => {
      popup.remove()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    live.current.geojson = geojson
    ;(mapRef.current?.getSource('cells') as GeoJSONSource | undefined)?.setData(geojson)
  }, [geojson])

  useEffect(() => {
    live.current.spotsGeojson = spotsGeojson
    ;(mapRef.current?.getSource('selected-spots') as GeoJSONSource | undefined)?.setData(spotsGeojson)
  }, [spotsGeojson])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const visible = new Set(BASE_LAYERS[basemap])
      for (const id of Object.values(BASE_LAYERS).flat()) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible.has(id) ? 'visible' : 'none')
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [basemap])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => map.setProjection({ type: flat ? 'mercator' : 'globe' })
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [flat])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      if (map.getLayer('teleconnections')) {
        map.setLayoutProperty('teleconnections', 'visibility', showTeleconnections ? 'visible' : 'none')
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [showTeleconnections])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !cameraCmd) return
    if (cameraCmd.kind === 'global') {
      map.flyTo({ center: [focus?.lon ?? -60, focus?.lat ?? 12], zoom: flat ? 1.6 : 2.3, duration: 1100 })
    } else if (cameraCmd.kind === 'zone' && focus) {
      map.flyTo({ center: [focus.lon, focus.lat], zoom: 6.8, duration: 1300 })
    } else if (cameraCmd.kind === 'in') {
      map.zoomTo(Math.min(12, map.getZoom() + 1), { duration: 400 })
    } else if (cameraCmd.kind === 'out') {
      map.zoomTo(Math.max(1, map.getZoom() - 1), { duration: 400 })
    } else if (cameraCmd.kind === 'center' && focus) {
      map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 4.2), duration: 1000 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraCmd?.seq])

  return <div ref={wrapRef} className="globe-wrap" />
}
