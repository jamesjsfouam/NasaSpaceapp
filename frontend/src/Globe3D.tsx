import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
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

type Polygon = {
  lat: number; lon: number; value: CellValue
  geometry: { type: 'Polygon'; coordinates: number[][][] }
}

const VERDICT = ['Sin tendencia clara', 'Todavía no significativa', 'Tendencia significativa']

export function Globe3D({ data, variable, onlySignificant, night, onPick, focus }: {
  data: GlobeData; variable: string; onlySignificant: boolean; night: boolean
  onPick: (lat: number, lon: number) => void; focus?: { lat: number; lon: number } | null
}) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState<Polygon | null>(null)
  const meta = data.variables[variable]
  const half = data.cell_deg / 2

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const controls = g.controls()
    controls.autoRotate = !focus
    controls.autoRotateSpeed = 0.35
    if (focus) g.pointOfView({ lat: focus.lat, lng: focus.lon, altitude: 1.8 }, 1200)
  }, [focus])

  const polygons = useMemo<Polygon[]>(() => data.cells.flatMap((c) => {
    const v = c[variable] as CellValue | undefined
    if (!v || (onlySignificant && !v[4])) return []
    const [w, e, s, n] = [c.lon - half, c.lon + half, c.lat - half, c.lat + half]
    return [{
      lat: c.lat, lon: c.lon, value: v,
      // Sentido horario: la librería (d3-geo) toma el interior según el sentido del anillo;
      // en sentido antihorario pintaría todo el planeta menos la celda.
      geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [w, n], [e, n], [e, s], [w, s]]] },
    }]
  }), [data, variable, onlySignificant, half])

  const fmt = (x: number) => x.toLocaleString('es', { maximumSignificantDigits: 3 })

  return (
    <div ref={wrapRef} className="globe-wrap">
      <Globe
        ref={globeRef}
        width={width}
        height={Math.min(560, Math.max(360, Math.round(width * 0.62)))}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={night ? '/textures/black_marble.jpg' : '/textures/blue_marble.jpg'}
        atmosphereColor="#3fd0e6"
        atmosphereAltitude={0.16}
        polygonsData={polygons}
        polygonGeoJsonGeometry="geometry"
        polygonAltitude={(p) => ((p as Polygon) === hover ? 0.03 : 0.006)}
        polygonCapColor={(p) => {
          const { value } = p as Polygon
          return cellColor(variable, value[0], meta?.slope_p98 ?? 1, value[4] ? 0.82 : 0.1)
        }}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={() => false as unknown as string}
        polygonsTransitionDuration={250}
        polygonLabel={(p) => {
          const { lat, lon, value } = p as Polygon
          return `<div class="globe-tip"><b>${meta.label}</b><br/>
            ${lat.toFixed(1)}°, ${lon.toFixed(1)}°<br/>
            <span class="num">${value[0] > 0 ? '+' : ''}${fmt(value[0])} ${meta.unit}/década</span><br/>
            ${VERDICT[value[2]]}${value[4] ? ' · pasa FDR' : ''}<br/>
            <i>Clic para investigar este punto</i></div>`
        }}
        onPolygonHover={(p) => setHover(p as Polygon | null)}
        onPolygonClick={(p) => { const { lat, lon } = p as Polygon; onPick(lat, lon) }}
        onGlobeReady={() => {
          const g = globeRef.current
          if (!g) return
          g.pointOfView({ lat: 12, lng: -60, altitude: 1.9 })
          const c = g.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.35
        }}
      />
    </div>
  )
}
