import { useEffect, useState } from 'react'
import { api, fmt, VERDICT_LABEL, type Catalog, type DemographyResponse } from './api'
import { ExplainPanel } from './Explain'
import { SeriesChart } from './SeriesChart'

export function DemographyView({ cat, country, start }: { cat: Catalog; country: string | null; start: number }) {
  const [iso3, setIso3] = useState(country ?? 'NIC')
  const [indicator, setIndicator] = useState('population')
  const [toYear, setToYear] = useState(2050)
  const [data, setData] = useState<DemographyResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      setBusy(true); setError(null)
      try {
        const d = await api<DemographyResponse>(`/api/demography?country=${iso3}&indicator=${indicator}&start=${start}&to_year=${toYear}`)
        if (alive) setData(d)
      } catch (e) {
        if (alive) { setError((e as Error).message); setData(null) }
      } finally {
        if (alive) setBusy(false)
      }
    }
    load()
    return () => { alive = false }
  }, [iso3, indicator, start, toYear])

  const ind = cat.demography.find((d) => d.key === indicator)
  const last = data?.history[data.history.length - 1]
  const scenario = data?.forecast?.points[data.forecast.points.length - 1]

  return (
    <div>
      <div className="controls">
        <label>País
          <select value={iso3} onChange={(e) => setIso3(e.target.value)}>
            {Object.entries(cat.countries).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Indicador
          <select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            {cat.demography.map((d) => <option key={d.key} value={d.key}>{d.label} ({d.unit})</option>)}
          </select>
        </label>
        <label>Mirar hasta
          <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}>
            {[2030, 2040, 2050, 2075, 2100].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      {ind && <p className="definition">{ind.definition}</p>}
      {busy && <p className="muted">Consultando datos de la ONU…</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {data && last && (
        <>
          <div className="facts">
            <div><span>Último dato</span><strong className="num">{fmt(last.mean, 4)} {data.indicator.unit}</strong><em>{last.year}</em></div>
            <div>
              <span>Tendencia desde {start}</span>
              <strong className="num">{data.trend ? `${fmt(data.trend.slope_per_decade)} / década` : '—'}</strong>
              <em>{data.trend ? VERDICT_LABEL[data.trend.verdict] : 'Datos insuficientes'}</em>
            </div>
            <div>
              <span>Proyección ONU {toYear}</span>
              <strong className="num">{data.un_value_at_horizon !== null ? `${fmt(data.un_value_at_horizon, 4)}` : 'No disponible'}</strong>
              <em>Modelo demográfico oficial</em>
            </div>
            <div>
              <span>Si el ritmo siguiera igual</span>
              <strong className="num">{scenario ? fmt(scenario.value, 4) : '—'}</strong>
              <em>{scenario ? `rango ${fmt(scenario.low, 3)} a ${fmt(scenario.high, 3)}` : ''}</em>
            </div>
          </div>
          <SeriesChart history={data.history.filter((p) => p.year >= 1950)} official={data.un_projection}
            forecast={data.forecast} unit={data.indicator.unit} />
          <p className="muted small">
            La línea verde es la proyección oficial de la ONU, que modela nacimientos, muertes y migración por
            edades: es mucho más fiable que alargar una recta. El escenario morado solo muestra qué pasaría si el
            ritmo de {start}–{last.year} no cambiara. Fuente: ONU, World Population Prospects (vía Our World in
            Data){data.source === 'muestra-local' ? ', muestra local' : ''}.
          </p>
          {data.forecast?.warnings.map((w) => <p key={w} className="muted small">⚠ {w}</p>)}
          <ExplainPanel request={{ kind: 'demography', country: iso3, indicator, start, to_year: toYear }} />
        </>
      )}
    </div>
  )
}
