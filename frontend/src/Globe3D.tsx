import { useEffect, useMemo, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cellColor } from './globeColors'

export type GlobeVariable = {
  label: string; unit: string; cells: number; fdr_threshold: number; fdr_significant: number; slope_p98: number
}
// [pendiente por década, p de Mann-Kendall, veredicto 2/1/0, media, pasa FDR 1/0]
type CellValue = [number, number, number, number, number]
export type GlobeCell = { lat: number; lon: number } & Record<string, CellValue | number>
export type GlobeData = {
  generated: string; period: [number, number]; cell_deg: number; fdr_q: number
  variables: Record<string, GlobeVariable>; cells: GlobeCell[]
}

const VERDICT = ['Sin tendencia clara', 'Todavía no significativa', 'Tendencia significativa']
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

// El globo lo dibuja MapLibre: teselas reales que se piden según el zoom (NASA GIBS de lejos,
// Esri World Imagery de cerca) en vez de una textura fija, y la malla como una sola capa en GPU.
const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
  sources: {
    day: {
      type: 'raster', tileSize: 256, maxzoom: 8,
      tiles: [`${GIBS}/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`],
      attribution: 'NASA GIBS · Blue Marble',
    },
    detail: {
      type: 'raster', tileSize: 256, maxzoom: 18,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Esri World Imagery',
    },
    night: {
      type: 'raster', tileSize: 256, maxzoom: 8,
      tiles: [`${GIBS}/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`],
      attribution: 'NASA GIBS · VIIRS Black Marble',
    },
  },
  layers: [
    { id: 'day', type: 'raster', source: 'day' },
    {
      id: 'detail', type: 'raster', source: 'detail', minzoom: 4,
      paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 6, 1] },
    },
    { id: 'night', type: 'raster', source: 'night', layout: { visibility: 'none' } },
  ],
}

type Props = {
  data: GlobeData; variable: string; onlySignificant: boolean; night: boolean
  onPick: (lat: number, lon: number) => void; focus?: { lat: number; lon: number } | null
}

export function Globe3D({ data, variable, onlySignificant, night, onPick, focus }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // Lo que leen los manejadores del mapa, que se registran una sola vez.
  const live = useRef({ onPick, focus, meta: data.variables[variable], geojson: null as GeoJSON.FeatureCollection | null })
  useEffect(() => { Object.assign(live.current, { onPick, focus, meta: data.variables[variable] }) })

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
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
          type: 'Feature' as const, id: i,
          properties: {
            lat: c.lat, lon: c.lon, slope: v[0], verdict: v[2], fdr: v[4],
            // Cuanto más fuerte la tendencia, más se tapa el satélite; las débiles apenas tiñen.
            color: cellColor(variable, v[0], scale, v[4] ? 0.2 + 0.55 * Math.min(1, Math.abs(v[0] / scale)) : 0.06),
          },
          geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
        }]
      }),
    }
  }, [data, variable, onlySignificant])

  useEffect(() => {
    const map = new maplibregl.Map({
      container: wrapRef.current!, style: STYLE, center: [-60, 12], zoom: 1.9, maxZoom: 12,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'globe-popup', offset: 8 })
    const fmt = (x: number) => x.toLocaleString('es', { maximumSignificantDigits: 3 })

    // Giro lento mientras nadie toca el globo ni hay un punto enfocado.
    let interacting = false
    const spin = () => {
      if (interacting || live.current.focus || map.getZoom() > 3) return
      const c = map.getCenter()
      map.easeTo({ center: [c.lng - 4, c.lat], duration: 1000, easing: (t) => t })
    }
    const stop = () => { interacting = true; map.stop() }
    const resume = () => { interacting = false; spin() }
    map.on('mousedown', stop); map.on('touchstart', stop); map.on('wheel', stop)
    map.on('mouseup', resume); map.on('touchend', resume); map.on('dragend', resume)
    map.on('moveend', spin)

    let hovered: number | string | undefined
    map.on('load', () => {
      map.addSource('cells', { type: 'geojson', data: live.current.geojson ?? { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cells', type: 'fill', source: 'cells', paint: { 'fill-color': ['to-color', ['get', 'color']], 'fill-antialias': false } })
      map.addLayer({
        id: 'cells-hover', type: 'line', source: 'cells',
        paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0] },
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
      popup.setLngLat(e.lngLat).setHTML(`<div class="globe-tip"><b>${meta.label}</b><br/>
        ${p.lat.toFixed(1)}°, ${p.lon.toFixed(1)}°<br/>
        <span class="num">${p.slope > 0 ? '+' : ''}${fmt(p.slope)} ${meta.unit}/década</span><br/>
        ${VERDICT[p.verdict]}${p.fdr ? ' · pasa FDR' : ''}<br/>
        <i>Clic para investigar este punto</i></div>`).addTo(map)
    })
    map.on('mouseleave', 'cells', () => {
      map.getCanvas().style.cursor = ''
      if (hovered !== undefined) map.setFeatureState({ source: 'cells', id: hovered }, { hover: false })
      hovered = undefined
      popup.remove()
    })
    map.on('click', 'cells', (e) => {
      const p = e.features?.[0]?.properties as { lat: number; lon: number } | undefined
      if (p) live.current.onPick(p.lat, p.lon)
    })
    return () => { popup.remove(); map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    live.current.geojson = geojson
    ;(mapRef.current?.getSource('cells') as GeoJSONSource | undefined)?.setData(geojson)
  }, [geojson])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      map.setLayoutProperty('night', 'visibility', night ? 'visible' : 'none')
      for (const id of ['day', 'detail']) map.setLayoutProperty(id, 'visibility', night ? 'none' : 'visible')
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [night])

  useEffect(() => {
    const map = mapRef.current
    if (map && focus) map.flyTo({ center: [focus.lon, focus.lat], zoom: 3, duration: 1500 })
  }, [focus])

  return <div ref={wrapRef} className="globe-wrap" />
}
