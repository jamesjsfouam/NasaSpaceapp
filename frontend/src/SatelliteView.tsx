import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type LandCoverResponse, type SatelliteImage } from './api'
import { ExplainPanel } from './Explain'
import { fmtNum, formatForecastText, LANDCOVER_LABEL, translateWarning, type Lang } from './i18n'
import { SeriesChart } from './SeriesChart'

const CLASS_COLORS: Record<string, string> = {
  'Zona construida': '#f59e42',
  Cultivos: '#facc15',
  'Árboles': '#34d399',
  Agua: '#3fd0e6',
  'Pastizal y matorral': '#a3e635',
  'Suelo desnudo': '#c8a27a',
  'Vegetación inundada': '#5eead4',
  'Nieve y hielo': '#9aa5b8',
}

export function SatelliteView({
  lat,
  lon,
  label,
  lang,
}: {
  lat: number
  lon: number
  label: string
  lang: Lang
}) {
  const [toYear, setToYear] = useState(2035)
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
    return () => {
      alive = false
    }
  }, [lat, lon])

  useEffect(() => {
    let alive = true
    const key = `${lat},${lon}`
    api<LandCoverResponse>(`/api/satellite/landcover?lat=${lat}&lon=${lon}&to_year=${toYear}`)
      .then((d) => alive && setCoverRes({ key: `${key},${toYear}`, cover: d }))
      .catch((e: Error) => alive && setErrorList((x) => [...x, { spot: key, message: e.message }]))
    return () => {
      alive = false
    }
  }, [lat, lon, toYear])

  const img = images?.[selected]
  const lc = cover?.land_cover
  const classes = lc
    ? Object.keys(lc.years[0]?.shares ?? {}).filter((k) => lc.years.some((y) => y.shares[k] >= 1))
    : []
  const latestShares = lc?.years[lc.years.length - 1]?.shares ?? null

  const copy = lang === 'es'
    ? {
        intro: 'Vista espacial real año a año alrededor de',
        introSize: '(cuadro de 16 × 16 km). Desliza el año para observar cambios físicos en el terreno.',
        loadingImgs: 'Buscando las escenas satelitales más despejadas por año…',
        noImgs: 'No se encontraron escenas sin nubes para estas coordenadas.',
        clouds: '% nubes',
        sensorNote: 'Landsat (30 m) hasta 2015 y Sentinel-2 (10 m) desde 2016 · Microsoft Planetary Computer.',
        lcTitle: 'Uso del suelo: ¿cuánto ha cambiado el paisaje?',
        loadingLc: 'Calculando composición anual del suelo…',
        lcNote: 'Porcentaje de cobertura por tipo de terreno en',
        horizon: 'Escenario urbano hasta',
        builtUnit: '% construido',
        builtLabel: 'Zona construida',
      }
    : {
        intro: 'Real multi-decade orbital timelapse around',
        introSize: '(16 × 16 km square). Drag the slider to see physical changes on the ground.',
        loadingImgs: 'Finding the clearest cloud-free satellite scenes per year…',
        noImgs: 'No cloud-free satellite scenes were found for these coordinates.',
        clouds: '% cloud cover',
        sensorNote: 'Landsat (30 m) through 2015 and Sentinel-2 (10 m) from 2016 · Microsoft Planetary Computer.',
        lcTitle: 'Land Cover: how has the landscape transformed?',
        loadingLc: 'Measuring annual land-cover breakdown…',
        lcNote: 'Percentage share of the',
        horizon: 'Urban built-up scenario to',
        builtUnit: '% built-up',
        builtLabel: 'Built-up area',
      }

  return (
    <div className="studio-block">
      <p style={{ marginTop: 0 }}>
        {copy.intro} <strong>{label}</strong> {copy.introSize}
      </p>
      {errors.map((e) => (
        <p key={e} className="error" role="alert">{e}</p>
      ))}
      {!images && <p className="muted">{copy.loadingImgs}</p>}
      {images && images.length === 0 && <p className="muted">{copy.noImgs}</p>}

      {images && img && (
        <div className="sat">
          <img
            src={img.url}
            alt={`${label} (${img.year})`}
            width={640}
            height={640}
          />
          <div className="sat-controls">
            <div className="sat-meta-badge">
              <strong className="num" style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>{img.year}</strong>
              <span className="muted small">{img.platform} · {img.date} · {fmtNum(img.cloud_cover, lang, 2)}{copy.clouds}</span>
            </div>
            <input
              type="range"
              min={0}
              max={images.length - 1}
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              aria-label="Year"
            />
            <div className="years">
              {images.map((im, i) => (
                <button
                  key={im.year}
                  className={`chip ${i === selected ? 'on' : ''}`}
                  onClick={() => setSelected(i)}
                >
                  {im.year}
                </button>
              ))}
            </div>
            <p className="muted small">{copy.sensorNote}</p>

            {latestShares && (
              <div className="lc-bars">
                {classes.slice(0, 5).map((k) => {
                  const pct = latestShares[k] ?? 0
                  const name = LANDCOVER_LABEL[lang][k] ?? k
                  return (
                    <div key={k} className="lc-bar-row">
                      <div className="row small">
                        <span>{name}</span>
                        <strong className="num">{fmtNum(pct, lang, 3)}%</strong>
                      </div>
                      <div className="meter-track">
                        <div
                          className="meter-fill"
                          style={{ width: `${Math.min(100, pct)}%`, background: CLASS_COLORS[k] ?? 'var(--accent)' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <h3 className="spaced">{copy.lcTitle}</h3>
      {!cover && <p className="muted">{copy.loadingLc}</p>}
      {lc && lc.years.length > 0 && (
        <>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={lc.years.map((y) => ({ year: y.year, ...y.shares }))}
                margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="year" />
                <YAxis width={42} unit="%" />
                <Tooltip formatter={(v) => (typeof v === 'number' ? `${fmtNum(v, lang, 3)}%` : v)} />
                <Legend />
                {classes.map((k) => (
                  <Line
                    key={k}
                    name={LANDCOVER_LABEL[lang][k] ?? k}
                    dataKey={k}
                    stroke={CLASS_COLORS[k] ?? '#666'}
                    strokeWidth={k === 'Zona construida' ? 3 : 1.7}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              {copy.lcNote} {fmtNum(lc.area_km2, lang, 3)} km² (Impact Observatory / Esri, 10 m).{' '}
              {lc.warnings.map((w) => translateWarning(w, lang)).join(' ')}
            </p>
          </div>

          {cover?.built_forecast && (
            <div className="chart-card" style={{ marginTop: 14 }}>
              <div className="scenario-pills">
                <span className="small muted">{copy.horizon}:</span>
                {[2030, 2035, 2040, 2050].map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`chip ${toYear === y ? 'on' : ''}`}
                    onClick={() => setToYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <SeriesChart
                history={lc.years.map((y) => ({ year: y.year, mean: y.shares['Zona construida'] }))}
                forecast={cover.built_forecast}
                unit={copy.builtUnit}
                lang={lang}
              />
              <p className="small" style={{ marginBottom: 4 }}>
                {formatForecastText(cover.built_forecast, copy.builtLabel, copy.builtUnit, lang)}
              </p>
              {cover.built_forecast.warnings.map((w) => (
                <p key={w} className="muted small" style={{ margin: '2px 0' }}>
                  ⚠ {translateWarning(w, lang)}
                </p>
              ))}
            </div>
          )}
          <ExplainPanel request={{ kind: 'landcover', lat, lon, place: label, to_year: toYear }} lang={lang} />
        </>
      )}
    </div>
  )
}
