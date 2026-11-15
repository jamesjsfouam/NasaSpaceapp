import { useCallback, useState, type KeyboardEvent, type ReactNode } from 'react'
import { VIEW, type Lang } from './i18n'

export type ViewMode = 'chart' | 'table'

const STORE = 'datex.view.'

function readMode(key: string): ViewMode {
  try {
    return sessionStorage.getItem(STORE + key) === 'table' ? 'table' : 'chart'
  } catch {
    return 'chart'
  }
}

/** Modo de visualización de una sección. Por defecto, gráfica; se recuerda durante la sesión. */
export function useViewMode(key: string): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => readMode(key))
  const set = useCallback((m: ViewMode) => {
    setMode(m)
    try {
      sessionStorage.setItem(STORE + key, m)
    } catch {
      /* sin almacenamiento: el modo vive solo en memoria */
    }
  }, [key])
  return [mode, set]
}

/** Interruptor deslizante Gráfica | Tabla. aria-checked = true cuando se ve la tabla. */
export function ViewSwitch({ mode, onChange, lang, name }: { mode: ViewMode; onChange: (m: ViewMode) => void; lang: Lang; name?: string }) {
  const v = VIEW[lang]
  const isTable = mode === 'table'
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange('chart') }
    else if (e.key === 'ArrowRight') { e.preventDefault(); onChange('table') }
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isTable}
      aria-label={name ? `${v.switchLabel}: ${name}` : v.switchLabel}
      className={`view-switch${isTable ? ' is-table' : ''}`}
      onClick={() => onChange(isTable ? 'chart' : 'table')}
      onKeyDown={onKey}
    >
      <span className="view-switch-thumb" aria-hidden="true" />
      <span className="view-switch-opt" aria-hidden="true">{v.chart}</span>
      <span className="view-switch-opt" aria-hidden="true">{v.table}</span>
    </button>
  )
}

/** Sección con encabezado (píldora + línea + interruptor) y una sola vista montada: gráfica o tabla. */
export function SectionView({
  id, lang, title, sub, chart, table, level = 'section',
}: {
  id: string
  lang: Lang
  title: string
  sub?: string
  chart: ReactNode
  table: ReactNode
  level?: 'section' | 'sub'
}) {
  const [mode, setMode] = useViewMode(id)
  return (
    <section className={`view-section view-${level}`} aria-label={title}>
      <div className="view-head">
        {level === 'section' ? <h3 className="sec-pill">{title}</h3> : <h4 className="stat-sub-title">{title}</h4>}
        <span className="sec-line" aria-hidden="true" />
        <ViewSwitch mode={mode} onChange={setMode} lang={lang} name={title} />
      </div>
      {sub && <p className="muted small sec-sub">{sub}</p>}
      <div className="view-body" key={mode} data-mode={mode}>
        {mode === 'chart' ? chart : table}
      </div>
    </section>
  )
}
