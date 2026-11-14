import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, fmt, type LandCoverResponse, type SatelliteImage } from './api'
import { ExplainPanel } from './Explain'
import { SeriesChart } from './SeriesChart'

const CLASS_COLORS: Record<string, string> = {
  'Zona construida': '#f59e42', Cultivos: '#facc15', 'Árboles': '#34d399', Agua: '#3fd0e6',
  'Pastizal y matorral': '#a3e635', 'Suelo desnudo': '#c8a27a', 'Vegetación inundada': '#5eead4', 'Nieve y hielo': '#9aa5b8',
}

export function SatelliteView({ lat, lon, label }: { lat: number; lon: number; label: string }) {
  const [toYear, setToYear] = useState(2035)
  // Cada resultado guarda para qué punto se pidió: al cambiar de lugar se descarta solo, sin
  // tener que vaciar el estado dentro del efecto.
  const spot = `${lat},${lon}`
  const coverKey = `${spot},${toYear}`
  const [timeline, setTimeline] = useState<{ spot: string; images: SatelliteImage[] } | null>(null)
  const [coverRes, setCoverRes] = useState<{ key: string; cover: LandCoverResponse } | null>(null)
  const [pick, setPick] = useState<{ spot: string; i: number } | null>(null)
  const [errorList, setErrorList] = useState<{ spot: string; message: string }[]>([])

  const images = timeline?.spot === spot ? timeline.images : null
  const cover = coverRes?.key === coverKey ? coverRes.cover : null
  const selected = pick?.spot === spot ? pick.i : Math.max(0, (images?.length ?? 1) - 1)
  const setSelected = (i: number) => setPick({ spot, i })
  const errors = errorList.filter((e) => e.spot === spot).map((e) => e.message)

  useEffect(() => {
    let alive = true
    const key = `${lat},${lon}`
    api<SatelliteImage[]>(`/api/satellite/timeline?lat=${lat}&lon=${lon}`)
      .then((d) => alive && setTimeline({ spot: key, images: d }))
      .catch((e: Error) => alive && setErrorList((x) => [...x, { spot: key, message: e.message }]))
    return () => { alive = false }
  }, [lat, lon])

  useEffect(() => {
    let alive = true
    const key = `${lat},${lon}`
    api<LandCoverResponse>(`/api/satellite/landcover?lat=${lat}&lon=${lon}&to_year=${toYear}`)
      .then((d) => alive && setCoverRes({ key: `${key},${toYear}`, cover: d }))
      .catch((e: Error) => alive && setErrorList((x) => [...x, { spot: key, message: e.message }]))
    return () => { alive = false }
  }, [lat, lon, toYear])

  const img = images?.[selected]
  const lc = cover?.land_cover
  const classes = lc ? Object.keys(lc.years[0]?.shares ?? {}).filter((k) => lc.years.some((y) => y.shares[k] >= 1)) : []

  return (
    <div>
      <p>
        Cómo se ve <strong>{label}</strong> desde el espacio, año a año (cuadro de unos 16 × 16 km). Mueve la barra
        para comparar.
      </p>
      {errors.map((e) => <p key={e} className="error" role="alert">{e}</p>)}
      {!images && <p className="muted">Buscando las imágenes con menos nubes de cada año…</p>}
      {images && images.length === 0 && <p className="muted">No hay imágenes sin nubes para este lugar.</p>}
      {images && img && (
        <div className="sat">
          <img src={img.url} alt={`Imagen de satélite de ${label} en ${img.year}`} width={640} height={640} />
          <div>
            <input type="range" min={0} max={images.length - 1} value={selected}
              onChange={(e) => setSelected(Number(e.target.value))} aria-label="Año de la imagen" />
            <div className="years">
              {images.map((im, i) => (
                <button key={im.year} className={`chip ${i === selected ? 'on' : ''}`} onClick={() => setSelected(i)}>{im.year}</button>
              ))}
            </div>
            <p className="muted small">
              {img.platform} · {img.date} · {fmt(img.cloud_cover, 2)} % de nubes en la escena. Landsat (30 m) hasta 2015 y
              Sentinel-2 (10 m) desde 2016, vía Microsoft Planetary Computer.
            </p>
          </div>
        </div>
      )}

      <h3 className="spaced">¿Cuánto ha crecido la zona construida?</h3>
      {!cover && <p className="muted">Midiendo la cobertura del suelo de cada año…</p>}
      {lc && lc.years.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lc.years.map((y) => ({ year: y.year, ...y.shares }))} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="year" />
              <YAxis width={40} unit="%" />
              <Tooltip formatter={(v) => (typeof v === 'number' ? `${fmt(v, 3)} %` : v)} />
              <Legend />
              {classes.map((k) => (
                <Line key={k} dataKey={k} stroke={CLASS_COLORS[k] ?? '#666'} strokeWidth={k === 'Zona construida' ? 3 : 1.5}
                  dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="muted small">
            Porcentaje del cuadro ({fmt(lc.area_km2, 3)} km²) por tipo de cobertura, clasificado por satélite
            (Impact Observatory/Esri, 10 m). {lc.warnings.join(' ')}
          </p>
          {cover?.built_forecast && (
            <>
              <div className="controls">
                <label>Escenario hasta
                  <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}>
                    {[2030, 2035, 2040, 2050].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
              </div>
              <SeriesChart history={lc.years.map((y) => ({ year: y.year, mean: y.shares['Zona construida'] }))}
                forecast={cover.built_forecast} unit="% construido" />
              <p className="small">{cover.built_forecast.text}</p>
              {cover.built_forecast.warnings.map((w) => <p key={w} className="muted small">⚠ {w}</p>)}
            </>
          )}
          <ExplainPanel request={{ kind: 'landcover', lat, lon, place: label, to_year: toYear }} />
        </>
      )}
    </div>
  )
}
