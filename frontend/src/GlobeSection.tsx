import { lazy, Suspense, useEffect, useState } from 'react'
import { api, type Catalog, type Place, type Variable } from './api'
import type { CameraCmd, GlobeData } from './Globe3D'
import { legendGradient } from './globeColors'
import {
  CONCERNS_EN, fmtNum, PLACE_TYPES_EN, shortVarName, tRegion, tUnit, tVariable, UI,
  type AudienceMode, type Lang,
} from './i18n'

const Globe3D = lazy(() => import('./Globe3D').then((m) => ({ default: m.Globe3D })))

export type Spot = { lat: number; lon: number; label: string; iso3: string | null; country: string | null }
export type SecondSpot = { lat: number; lon: number; label: string }

type Props = {
  cat: Catalog | null
  lang: Lang
  mode: AudienceMode
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
}

/** Phase 2: Unified 3D Planet Explorer (macro 5° global cells + local satellite zoom) + Control Dock. */
export function GlobeSection(props: Props) {
  const {
    cat, lang, mode, spot, second, pickSecond, onPickSecondChange,
    search, onSearchChange, found, onSearch, onPickPlace,
    question, onQuestionChange, askInfo, onAsk,
    concern, onConcernChange, placeType, onPlaceTypeChange,
    recommended, variable, onVariableChange,
    start, onStartChange, years, busy, onLaunchStudio,
  } = props

  const t = UI[lang].phase2
  const [data, setData] = useState<GlobeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [layerVar, setLayerVar] = useState('T2M')
  const [onlySig, setOnlySig] = useState(false)
  const [night, setNight] = useState(false)
  const [spin, setSpin] = useState(true)
  const [camSeq, setCamSeq] = useState(0)
  const [camCmd, setCamCmd] = useState<CameraCmd | null>(null)

  useEffect(() => {
    api<GlobeData>('/api/globe').then(setData).catch((e: Error) => setError(e.message))
  }, [])

  function fly(kind: CameraCmd['kind']) {
    const seq = camSeq + 1
    setCamSeq(seq)
    setCamCmd({ kind, seq })
    setSpin(kind === 'global')
  }

  function handleSelectGlobeLayer(k: string) {
    setLayerVar(k)
    onVariableChange(k)
  }

  function handlePickFromDock(p: { lat: number; lon: number }, label?: string) {
    onPickPlace(p, label, false)
    setTimeout(() => fly('zone'), 40)
  }

  function handlePickFromGlobe(lat: number, lon: number) {
    setSpin(false)
    onPickPlace({ lat, lon }, undefined, true)
  }

  const meta = data?.variables[layerVar]
  const pct = meta ? Math.round((100 * meta.fdr_significant) / Math.max(1, meta.cells)) : 0
  const scale = meta?.slope_p98 ?? 0
  const activeVarRaw = cat?.variables.find((v) => v.key === variable)
  const activeVar = activeVarRaw ? tVariable(activeVarRaw, lang) : null
  const globeUnit = meta ? tUnit(meta.unit, lang) : ''
  const perDec = lang === 'es' ? '/década' : '/decade'

  return (
    <div className="planet-workspace">
      {/* Left/Main Column: Unified 3D Globe */}
      <section className="globe-stage">
        <div className="globe-head">
          <div>
            <h2 className="panel-title"><span>{t.title}</span></h2>
            <p className="muted small" style={{ margin: '4px 0 8px', maxWidth: 680 }}>{t.sub}</p>
          </div>
          {data && (
            <div className="chips">
              {Object.keys(data.variables).map((k) => (
                <button
                  key={k}
                  className={`chip ${k === layerVar ? 'on' : ''}`}
                  aria-pressed={k === layerVar}
                  onClick={() => handleSelectGlobeLayer(k)}
                >
                  {shortVarName(k, lang, data.variables[k].label)}
                </button>
              ))}
            </div>
          )}
        </div>

        {data && meta && (
          <div className="globe-telemetry-strip">
            <span>
              <strong className="num">{pct}%</strong>{' '}
              {lang === 'es'
                ? `de celdas con cambio confirmado en ${shortVarName(layerVar, 'es', meta.label).toLowerCase()} (${data.period[0]}–${data.period[1]})`
                : `of global cells show confirmed change in ${shortVarName(layerVar, 'en', meta.label).toLowerCase()} (${data.period[0]}–${data.period[1]})`}
            </span>
            {mode === 'researcher' && (
              <span className="muted num">
                n = {meta.cells.toLocaleString(lang === 'es' ? 'es' : 'en-US')} · BH FDR q = {fmtNum(data.fdr_q, lang, 2)}
              </span>
            )}
          </div>
        )}

        {error && (
          <p className="muted small">
            {lang === 'es'
              ? `El globo aún no tiene datos (${error}). Genera la malla con scripts/build_globe.py.`
              : `Globe grid unavailable (${error}). Generate it with scripts/build_globe.py.`}
          </p>
        )}
        {!data && !error && (
          <p className="muted">{lang === 'es' ? 'Cargando el planeta 3D…' : 'Loading 3D planet…'}</p>
        )}

        {data && (
          <div className="globe-viewport-box">
            <Suspense fallback={<div className="globe-loading">{lang === 'es' ? 'Inicializando WebGL…' : 'Initializing WebGL…'}</div>}>
              <Globe3D
                data={data}
                variable={layerVar}
                onlySignificant={onlySig}
                night={night}
                lang={lang}
                onPick={handlePickFromGlobe}
                focus={spot}
                second={second}
                cameraCmd={camCmd}
                spinEnabled={spin}
              />
            </Suspense>

            {/* Floating Camera & Layer HUD */}
            <div className="globe-hud">
              <button type="button" className="hud-btn" onClick={() => fly('global')}>{t.globalBtn}</button>
              <button type="button" className="hud-btn accent" onClick={() => fly('zone')}>{t.zoomZoneBtn}</button>
              <button type="button" className={`hud-btn ${night ? 'on' : ''}`} onClick={() => setNight((v) => !v)}>
                🌙 {lang === 'es' ? 'Nocturna' : 'Night'}
              </button>
              <button type="button" className={`hud-btn ${onlySig ? 'on' : ''}`} onClick={() => setOnlySig((v) => !v)}>
                ✓ {lang === 'es' ? 'Solo FDR' : 'FDR Only'}
              </button>
            </div>
          </div>
        )}

        {meta && (
          <div className="globe-footer-bar">
            <div className="legend-compact">
              <span className="small"><strong>{shortVarName(layerVar, lang, meta.label)}</strong> ({globeUnit}{perDec})</span>
              <div className="legend-bar" style={{ background: legendGradient(layerVar) }} />
              <div className="legend-scale num">
                <span>−{fmtNum(scale, lang, 2)}</span>
                <span>0</span>
                <span>+{fmtNum(scale, lang, 2)}</span>
              </div>
            </div>
            <p className="muted small" style={{ margin: 0 }}>{t.legendHelp}</p>
          </div>
        )}

        {/* Active Zone Preview & Quick Launch */}
        <div className="zone-preview-bar">
          <div className="zone-preview-info">
            <span className="zone-tag">{t.selectedBadge}</span>
            <div className="zone-coords">
              <strong>📍 {spot.label}</strong>
              <span className="num muted small">{spot.lat.toFixed(2)}°, {spot.lon.toFixed(2)}°</span>
              {second && (
                <span className="second-pill">
                  vs {second.label} ({second.lat.toFixed(2)}°, {second.lon.toFixed(2)}°)
                </span>
              )}
            </div>
          </div>
          <div className="zone-preview-actions">
            <button type="button" className="secondary" onClick={() => fly('zone')}>
              {t.zoomZoneBtn}
            </button>
            <button type="button" className="primary" onClick={onLaunchStudio} disabled={busy}>
              {busy ? t.busyBtn : t.openStudioNow}
            </button>
          </div>
        </div>
      </section>

      {/* Right Column: Mission Control Side Dock */}
      {cat && (
        <aside className="control-dock">
          {/* Step 1: Locate / Zoom */}
          <section className="dock-card">
            <h3 className="dock-title">{t.dockStep1}</h3>
            <div className="search">
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t.searchPlaceholder}
                onKeyDown={(e) => e.key === 'Enter' && search.length > 1 && onSearch()}
              />
              <button className="secondary" onClick={() => onSearch()} disabled={search.length < 2}>
                {t.searchBtn}
              </button>
            </div>
            {found.length > 0 && (
              <ul className="results">
                {found.map((p) => (
                  <li key={`${p.lat},${p.lon}`}>
                    <button
                      className="link"
                      onClick={() => handlePickFromDock({ lat: p.lat, lon: p.lon }, `${p.name}${p.country ? `, ${p.country}` : ''}`)}
                    >
                      {p.name}{p.admin1 ? `, ${p.admin1}` : ''}{p.country ? ` (${p.country})` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="chips" style={{ marginTop: 8 }}>
              {cat.regions.map((rawR) => {
                const r = tRegion(rawR, lang)
                const isSelected = Math.abs(spot.lat - r.lat) < 0.05 && Math.abs(spot.lon - r.lon) < 0.05
                return (
                  <button
                    key={r.id}
                    className={`chip ${isSelected ? 'on' : ''}`}
                    onClick={() => handlePickFromDock({ lat: r.lat, lon: r.lon }, r.label)}
                  >
                    {r.label.split(',')[0]}
                  </button>
                )
              })}
            </div>

            <label className="inline compare-check">
              <input
                type="checkbox"
                checked={pickSecond}
                onChange={(e) => onPickSecondChange(e.target.checked)}
              />
              <span>{t.compareToggle}</span>
            </label>
          </section>

          {/* Step 2: Question & Variables */}
          <section className="dock-card">
            <h3 className="dock-title">{t.dockStep2}</h3>
            <div className="ask">
              <input
                value={question}
                onChange={(e) => onQuestionChange(e.target.value)}
                maxLength={500}
                placeholder={t.askPlaceholder}
                onKeyDown={(e) => e.key === 'Enter' && question.length > 2 && onAsk()}
              />
              <button className="secondary" onClick={onAsk} disabled={question.length < 3}>
                {t.askBtn}
              </button>
            </div>
            {askInfo && <p className="muted small" style={{ margin: '0 0 8px' }}>{askInfo}</p>}

            <span className="dock-sub">{t.concernTitle}</span>
            <div className="chips">
              {Object.entries(cat.concerns).map(([k, label]) => (
                <button
                  key={k}
                  className={`chip ${k === concern ? 'on' : ''}`}
                  aria-pressed={k === concern}
                  onClick={() => onConcernChange(k)}
                >
                  {lang === 'en' ? (CONCERNS_EN[k] ?? label) : label}
                </button>
              ))}
            </div>

            <span className="dock-sub">{t.placeTypeTitle}</span>
            <div className="chips">
              {Object.entries(cat.place_types).map(([k, label]) => (
                <button
                  key={k}
                  className={`chip ${k === placeType ? 'on' : ''}`}
                  aria-pressed={k === placeType}
                  onClick={() => onPlaceTypeChange(k === placeType ? null : k)}
                >
                  {lang === 'en' ? (PLACE_TYPES_EN[k] ?? label) : label}
                </button>
              ))}
            </div>

            <span className="dock-sub">{t.recTitle}</span>
            <div className="recs-list">
              {recommended.map((rawV) => {
                const v = tVariable(rawV, lang)
                return (
                  <button
                    key={v.key}
                    className={`rec ${v.key === variable ? 'on' : ''}`}
                    onClick={() => onVariableChange(v.key)}
                  >
                    <strong>{v.label} <span className="muted small">({v.unit})</span></strong>
                    <span className="small">{v.definition}</span>
                  </button>
                )
              })}
            </div>

            <div className="dock-selects">
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

            {activeVar && <p className="definition">⚠ {activeVar.reliability}</p>}
          </section>

          {/* Step 3: Launch Studio */}
          <section className="dock-card launch-card">
            <h3 className="dock-title">{t.dockStep3}</h3>
            <button className="primary big-launch" onClick={onLaunchStudio} disabled={busy}>
              {busy ? t.busyBtn : t.launchBtn}
            </button>
          </section>
        </aside>
      )}
    </div>
  )
}
