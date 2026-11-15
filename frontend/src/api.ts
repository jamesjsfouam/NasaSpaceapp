import { staticGet, staticPost } from './staticFallback'

// En producción, VITE_API_URL apunta al backend desplegado; en desarrollo se usa el proxy de Vite.
const BASE = import.meta.env.VITE_API_URL ?? ''

function preferStaticOnly(): boolean {
  return (
    !BASE &&
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('github.io')
  )
}

function shouldFallback(res: Response): boolean {
  if (BASE) return false
  const ct = res.headers.get('content-type') ?? ''
  return res.status === 404 || res.status === 405 || !ct.includes('application/json')
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().then((b) => b.detail).catch(() => null)
    throw new Error(typeof detail === 'string' ? detail : `Error ${res.status}`)
  }
  return (await res.json()) as T
}

export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (preferStaticOnly()) return staticGet<T>(path, signal)
  try {
    const res = await fetch(`${BASE}${path}`, { signal })
    if (shouldFallback(res)) return staticGet<T>(path, signal)
    return handle<T>(res)
  } catch (err) {
    if (!BASE && !(err instanceof DOMException && err.name === 'AbortError')) {
      return staticGet<T>(path, signal)
    }
    throw err
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (preferStaticOnly()) return staticPost<T>(path, body)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (shouldFallback(res)) return staticPost<T>(path, body)
    return handle<T>(res)
  } catch (err) {
    if (!BASE) return staticPost<T>(path, body)
    throw err
  }
}

export type Variable = {
  key: string
  label: string
  unit: string
  theme: string
  definition: string
  ratio_scale: boolean
  source: string
  reliability: string
}
export type Region = {
  id: string; label: string; biome: string; lat: number; lon: number; country: string | null
}
export type Indicator = {
  key: string; label: string; unit: string; definition: string; suggested_variable: string
}
export type Demo = { title: string; why: string; region: string; variable: string }

export type Catalog = {
  themes: Record<string, string>
  variables: Variable[]
  regions: Region[]
  demos: Demo[]
  first_year: number
  last_year: number
  data_note: string
  indicators: Indicator[]
  countries: Record<string, string>
  concerns: Record<string, string>
  place_types: Record<string, string>
  demography: DemographicIndicator[]
}

export type DemographicIndicator = {
  key: string; label: string; unit: string; definition: string; has_projection: boolean
}
export type Place = { name: string; admin1: string | null; country: string | null; iso3: string | null; lat: number; lon: number }
export type Location = {
  lat: number; lon: number; iso3: string | null; country: string | null; nearest_place: string | null
  admin1: string | null; distance_km: number | null
}
export type AnnualPoint = { year: number; mean: number }
export type ForecastPoint = { year: number; value: number; low: number; high: number }
export type Forecast = {
  method: string; base_first_year: number; base_last_year: number; n_points: number; to_year: number
  slope_per_year: number; points: ForecastPoint[]; warnings: string[]; text: string
}
export type EarthForecastResponse = { source: string; variable: Variable; history: AnnualPoint[]; forecast: Forecast }
export type DemographyResponse = {
  source: string; country: string; country_label: string; indicator: DemographicIndicator
  history: AnnualPoint[]; un_projection: AnnualPoint[]; trend: Trend | null; forecast: Forecast | null
  un_value_at_horizon: number | null
}
export type SatelliteImage = { year: number; date: string; collection: string; platform: string; cloud_cover: number; url: string }
export type LandCoverYear = { year: number; shares: Record<string, number>; built_km2: number }
export type LandCoverResponse = {
  land_cover: { area_km2: number; years: LandCoverYear[]; suggested_place_type: string | null; warnings: string[] }
  built_forecast: Forecast | null
}
export type AskResponse = {
  interpretation: { concern: string; place_type: string | null; place_query: string | null; source: string }
  variables: Variable[]
  places: Place[]
}

export type Verdict = 'significant' | 'not_yet' | 'no_trend'

export type Trend = {
  variable: string
  label: string
  unit: string
  first_year: number
  last_year: number
  n_years: number
  direction: 'up' | 'down' | 'flat'
  slope_per_decade: number
  ci_low_per_decade: number
  ci_high_per_decade: number
  total_change: number
  percent_change: number | null
  ols_slope_per_decade: number
  ols_ci_low_per_decade: number
  ols_ci_high_per_decade: number
  ols_p: number
  mk_tau: number
  mk_p: number
  p_adjusted: number | null
  step_year: number | null
  verdict: Verdict
  significant: boolean
  years_needed: number | null
  period_sensitive: boolean
  n_effective: number
  autocorrelation: number
  methods_agree: boolean
  warnings: string[]
  interpretation: string
  series: {
    annual: { year: number; mean: number }[]
    monthly: { date: string; anomaly: number }[]
    trend_line: { year: number; mean: number }[]
  } | null
}

export type TrendResponse = { source: string; lat: number; lon: number; result: Trend }
export type ScanResponse = { source: string; lat: number; lon: number; results: Trend[] }
export type RegionTrend = { region: Region; source: string; result: Trend | null; error: string | null }

export const VERDICT_LABEL: Record<Verdict, string> = {
  significant: 'Tendencia significativa',
  not_yet: 'Todavía no significativa',
  no_trend: 'Sin tendencia clara',
}

export const DIRECTION_ARROW = { up: '↑', down: '↓', flat: '→' } as const

export const fmt = (x: number, digits = 3) => {
  const s = x.toLocaleString('es', { maximumSignificantDigits: digits })
  return /^-0([,.]0*)?$/.test(s) ? '0' : s
}

/** Para ejes: 55.340.000 → "55 M", 12.500 → "12,5 mil". */
export const compact = (x: number) =>
  Math.abs(x) >= 10000
    ? x.toLocaleString('es', { notation: 'compact', maximumSignificantDigits: 3 })
    : fmt(x, 3)
export const fmtP = (p: number) => (p < 0.0001 ? '< 0,0001' : p.toFixed(4).replace('.', ','))
export const pText = (p: number) => (p < 0.0001 ? 'p < 0,0001' : `p = ${fmtP(p)}`)

export type RelationPoint = {
  year: number; earth: number; indicator: number; earth_detrended: number; indicator_detrended: number
}
export type Relation = {
  n_years: number
  first_year: number
  last_year: number
  raw_r: number
  raw_p: number
  detrended_r: number
  detrended_p: number
  detrended_rho: number
  detrended_rho_p: number
  strength: 'débil' | 'moderada' | 'fuerte'
  significant: boolean
  trend_driven: boolean
  lag_years?: number
  excluded_years?: number[]
  spatial_note?: string
  interpretation: string
  warnings: string[]
  points: RelationPoint[]
}
export type RelateResponse = {
  earth_source: string
  indicator_source: string
  country: string
  country_label: string
  indicator: Indicator
  indicator_trend: Trend | null
  relation: Relation
}
