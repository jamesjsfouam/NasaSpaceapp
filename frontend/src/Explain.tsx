import { Fragment, useState, type ReactNode } from 'react'
import { apiPost } from './api'

export type ExplainRequest = {
  kind: 'trend' | 'demography' | 'landcover' | 'relate'
  variable?: string
  indicator?: string
  country?: string | null
  lat?: number
  lon?: number
  place?: string
  start?: number
  to_year?: number
}
type Explanation = { text: string; source: 'claude' | 'plantilla'; note: string | null }

/** Convierte **negrita** y párrafos en elementos React (sin insertar HTML). */
function renderText(text: string): ReactNode {
  return text.split(/\n{2,}/).map((para, i) => (
    <p key={i}>
      {para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
        chunk.startsWith('**') && chunk.endsWith('**')
          ? <strong key={j}>{chunk.slice(2, -2)}</strong>
          : <Fragment key={j}>{chunk}</Fragment>,
      )}
    </p>
  ))
}

/** Botón "Explicar": la IA (o la plantilla) explica el resultado con las cifras del motor. */
export function ExplainPanel({ request }: { request: ExplainRequest }) {
  const [data, setData] = useState<Explanation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true); setError(null)
    try {
      setData(await apiPost<Explanation>('/api/explain', request))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="explain">
      {!data && (
        <button className="secondary" onClick={run} disabled={busy}>
          {busy ? 'Pensando…' : '✨ Explicar: ¿por qué y cómo se verá en el futuro?'}
        </button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {data && (
        <div className={`explain-box ${data.source}`}>
          <div className="row">
            <strong>{data.source === 'claude' ? 'Explicación con IA' : 'Explicación automática'}</strong>
            <button className="link" onClick={() => setData(null)}>cerrar</button>
          </div>
          {renderText(data.text)}
          {data.note && <p className="muted small">{data.note}</p>}
        </div>
      )}
    </div>
  )
}
