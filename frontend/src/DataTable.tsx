import type { ReactNode } from 'react'

export type Column<R> = {
  id: string
  header: ReactNode
  /** Cabecera para el CSV (por defecto, el texto de `header` o el id). */
  csvHeader?: string
  align?: 'left' | 'right'
  cell: (row: R, index: number) => ReactNode
  /** Valor crudo para el CSV; si falta, la columna se omite del archivo. */
  csv?: (row: R) => string | number | null | undefined
}

type Props<R> = {
  columns: Column<R>[]
  rows: R[]
  rowKey: (row: R, index: number) => string
  ariaLabel: string
  /** Nombre del archivo CSV (sin extensión). Si falta, no hay botón. */
  csvName?: string
  csvLabel?: string
  /** Filas para el CSV si difieren de las visibles (p. ej. sin filas resumen). */
  csvRows?: R[]
  sticky?: boolean
  maxHeight?: number
  rowClass?: (row: R) => string | undefined
}

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : v
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function download<R>(name: string, columns: Column<R>[], rows: R[]) {
  const cols = columns.filter((c) => c.csv)
  const head = cols.map((c) => csvCell(c.csvHeader ?? (typeof c.header === 'string' ? c.header : c.id))).join(',')
  const body = rows.map((r) => cols.map((c) => csvCell(c.csv!(r))).join(','))
  const blob = new Blob(['﻿' + [head, ...body].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Tabla de datos del análisis: cifras alineadas, cabecera opcional pegajosa, desplazamiento horizontal y CSV. */
export function DataTable<R>({
  columns, rows, rowKey, ariaLabel, csvName, csvLabel, csvRows, sticky, maxHeight, rowClass,
}: Props<R>) {
  return (
    <div className="data-table-block">
      <div
        className={`table-wrap${sticky ? ' sticky' : ''}`}
        style={maxHeight ? { maxHeight } : undefined}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.id} scope="col" className={c.align === 'right' ? 'num' : undefined}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={rowKey(r, i)} className={rowClass?.(r)}>
                {columns.map((c) => (
                  <td key={c.id} className={c.align === 'right' ? 'num' : undefined}>{c.cell(r, i)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {csvName && (
        <div className="table-actions">
          <button type="button" className="link" onClick={() => download(csvName, columns, csvRows ?? rows)}>
            {csvLabel ?? 'CSV'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Encabezado de sección: píldora cian + línea. */
export function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="sec-block">
      <div className="sec-head">
        <h3 className="sec-pill">{title}</h3>
        <span className="sec-line" aria-hidden="true" />
      </div>
      {sub && <p className="muted small sec-sub">{sub}</p>}
    </div>
  )
}
