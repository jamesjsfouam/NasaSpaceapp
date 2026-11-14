import { lazy, Suspense, useEffect, useState } from 'react'
import { api } from './api'
import type { GlobeData } from './Globe3D'
import { legendGradient } from './globeColors'

const Globe3D = lazy(() => import('./Globe3D').then((m) => ({ default: m.Globe3D })))

const SHORT: Record<string, string> = {
  T2M: 'Temperatura', PRECTOTCORR: 'Lluvia', GWETROOT: 'Humedad del suelo', RH2M: 'Humedad del aire', WS2M: 'Viento',
}

/** Portada: el mundo entero de un vistazo. Cada celda de 5° se colorea con su tendencia. */
export function GlobeSection({ onPick, focus }: {
  onPick: (lat: number, lon: number, variable: string) => void; focus?: { lat: number; lon: number } | null
}) {
  const [data, setData] = useState<GlobeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [variable, setVariable] = useState('T2M')
  const [onlySig, setOnlySig] = useState(false)
  const [night, setNight] = useState(false)

  useEffect(() => {
    api<GlobeData>('/api/globe').then(setData).catch((e: Error) => setError(e.message))
  }, [])

  const meta = data?.variables[variable]
  const pct = meta ? Math.round((100 * meta.fdr_significant) / Math.max(1, meta.cells)) : 0
  const scale = meta?.slope_p98 ?? 0

  return (
    <section className="globe-section">
      <div className="globe-head">
        <div>
          <h2 className="panel-title"><span>El mundo de un vistazo</span></h2>
          {data && meta && (
            <p className="globe-stat">
              <strong className="num">{pct} %</strong> de las celdas con tendencia significativa en {SHORT[variable]?.toLowerCase()} ({data.period[0]}–{data.period[1]}),
              tras corregir por {meta.cells.toLocaleString('es')} pruebas (FDR, q = {String(data.fdr_q).replace('.', ',')}).
            </p>
          )}
        </div>
        <div className="chips">
          {data && Object.keys(data.variables).map((k) => (
            <button key={k} className={`chip ${k === variable ? 'on' : ''}`} aria-pressed={k === variable} onClick={() => setVariable(k)}>
              {SHORT[k] ?? data.variables[k].label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="muted small">El globo aún no tiene datos ({error}). Genera la malla con <code>scripts/build_globe.py</code>.</p>}
      {!data && !error && <p className="muted">Cargando el globo…</p>}
      {data && (
        <div className="globe-layout">
          <Suspense fallback={<p className="muted">Cargando el globo 3D…</p>}>
            <Globe3D data={data} variable={variable} onlySignificant={onlySig} night={night}
              onPick={(lat, lon) => onPick(lat, lon, variable)} focus={focus} />
          </Suspense>
          {meta && (
            <aside className="globe-legend">
              <span className="legend-title">{meta.label} · {meta.unit}/década</span>
              <div className="legend-bar" style={{ background: legendGradient(variable) }} />
              <div className="legend-scale num">
                <span>−{scale.toLocaleString('es', { maximumSignificantDigits: 2 })}</span><span>0</span>
                <span>+{scale.toLocaleString('es', { maximumSignificantDigits: 2 })}</span>
              </div>
              <label className="inline"><input type="checkbox" checked={onlySig} onChange={(e) => setOnlySig(e.target.checked)} /> Solo significativas (FDR)</label>
              <label className="inline"><input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} /> Vista nocturna (luces de ciudades)</label>
              <p className="muted small">
                Más opaco = tendencia significativa con el veredicto completo <b>y</b> tras el control de falsos
                descubrimientos. Semitransparente = no alcanza. Arrastra para girar; clic en una celda para abrir su
                veredicto. Fuente: NASA POWER, centro de cada celda de {data.cell_deg}°; imagen: NASA Blue/Black Marble.
              </p>
            </aside>
          )}
        </div>
      )}
    </section>
  )
}
