import { useEffect, useState } from 'react'
import { api, type Catalog, type DemographyResponse } from './api'
import { ExplainPanel } from './Explain'
import {
  fmtNum, tDemography, translateWarning, tUnit, verdictLabel, type Lang,
} from './i18n'
import { SeriesChart } from './SeriesChart'

export function DemographyView({
  cat,
  country,
  start,
  lang,
}: {
  cat: Catalog
  country: string | null
  start: number
  lang: Lang
}) {
  const [iso3, setIso3] = useState(country ?? 'NIC')
  const [indicator, setIndicator] = useState('population')
  const [toYear, setToYear] = useState(2050)
  const [data, setData] = useState<DemographyResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      setBusy(true)
      setError(null)
      try {
        const d = await api<DemographyResponse>(
          `/api/demography?country=${iso3}&indicator=${indicator}&start=${start}&to_year=${toYear}`,
        )
        if (alive) setData(d)
      } catch (e) {
        if (alive) {
          setError((e as Error).message)
          setData(null)
        }
      } finally {
        if (alive) setBusy(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [iso3, indicator, start, toYear])

  const rawInd = cat.demography.find((d) => d.key === indicator)
  const ind = rawInd ? tDemography(rawInd, lang) : undefined
  const last = data?.history[data.history.length - 1]
  const scenario = data?.forecast?.points[data.forecast.points.length - 1]
  const unit = data ? tUnit(data.indicator.unit, lang) : ''

  const copy = lang === 'es'
    ? {
        country: 'País',
        indicator: 'Indicador ONU',
        horizon: 'Horizonte',
        loading: 'Consultando datos de la ONU…',
        latest: 'Último dato registrado',
        trendSince: `Ritmo desde ${start}`,
        perDec: '/ década',
        noData: 'Datos insuficientes',
        unProj: `Proyección oficial ONU (${toYear})`,
        unModel: 'Modelo demográfico por edades',
        unNA: 'No disponible',
        linearTitle: 'Si el ritmo reciente siguiera recto',
        range: 'rango',
        to: 'a',
        note: `La línea verde es la proyección oficial de la ONU (modela nacimientos, muertes y migración por edades): es la referencia científica. La línea morada solo ilustra qué pasaría si el ritmo de ${start}–${last?.year ?? ''} siguiera linealmente.`,
      }
    : {
        country: 'Country',
        indicator: 'UN Indicator',
        horizon: 'Horizon year',
        loading: 'Fetching UN demographic records…',
        latest: 'Latest observed figure',
        trendSince: `Pace since ${start}`,
        perDec: '/ decade',
        noData: 'Insufficient data',
        unProj: `Official UN Projection (${toYear})`,
        unModel: 'Cohort-component UN model',
        unNA: 'Not available',
        linearTitle: 'If linear pace continued flatly',
        range: 'range',
        to: 'to',
        note: `The green curve is the official UN World Population Prospects projection (modeling fertility, mortality, and migration by age). The purple line simply shows linear extrapolation from ${start}–${last?.year ?? ''} for contrast.`,
      }

  return (
    <div className="studio-block">
      <div className="controls">
        <label>
          {copy.country}
          <select value={iso3} onChange={(e) => setIso3(e.target.value)}>
            {Object.entries(cat.countries).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          {copy.indicator}
          <select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
            {cat.demography.map((raw) => {
              const d = tDemography(raw, lang)
              return <option key={d.key} value={d.key}>{d.label} ({d.unit})</option>
            })}
          </select>
        </label>
        <label>
          {copy.horizon}
          <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}>
            {[2030, 2040, 2050, 2075, 2100].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      {ind && <p className="definition">{ind.definition}</p>}
      {busy && <p className="muted">{copy.loading}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {data && last && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-kicker">{copy.latest}</span>
              <strong className="num kpi-val">{fmtNum(last.mean, lang, 4)} {unit}</strong>
              <em className="muted small">{last.year}</em>
            </div>
            <div className="kpi-card">
              <span className="kpi-kicker">{copy.trendSince}</span>
              <strong className="num kpi-val">
                {data.trend ? `${data.trend.slope_per_decade > 0 ? '+' : ''}${fmtNum(data.trend.slope_per_decade, lang)} ${copy.perDec}` : '—'}
              </strong>
              <em className="muted small">
                {data.trend ? verdictLabel(data.trend.verdict, lang) : copy.noData}
              </em>
            </div>
            <div className="kpi-card">
              <span className="kpi-kicker">{copy.unProj}</span>
              <strong className="num kpi-val" style={{ color: '#34d399' }}>
                {data.un_value_at_horizon !== null ? fmtNum(data.un_value_at_horizon, lang, 4) : copy.unNA}
              </strong>
              <em className="muted small">{copy.unModel}</em>
            </div>
            <div className="kpi-card">
              <span className="kpi-kicker">{copy.linearTitle}</span>
              <strong className="num kpi-val" style={{ color: 'var(--purple)' }}>
                {scenario ? fmtNum(scenario.value, lang, 4) : '—'}
              </strong>
              <em className="muted small">
                {scenario ? `${copy.range} ${fmtNum(scenario.low, lang, 3)} ${copy.to} ${fmtNum(scenario.high, lang, 3)}` : ''}
              </em>
            </div>
          </div>

          <div className="chart-card">
            <SeriesChart
              history={data.history.filter((p) => p.year >= 1950)}
              official={data.un_projection}
              forecast={data.forecast}
              unit={unit}
              lang={lang}
            />
            <p className="muted small" style={{ margin: '8px 0 0' }}>{copy.note}</p>
          </div>

          {data.forecast?.warnings.map((w) => (
            <p key={w} className="muted small">⚠ {translateWarning(w, lang)}</p>
          ))}
          <ExplainPanel request={{ kind: 'demography', country: iso3, indicator, start, to_year: toYear }} lang={lang} />
        </>
      )}
    </div>
  )
}
