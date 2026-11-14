// En producción, VITE_API_URL apunta al backend desplegado; en desarrollo se usa el proxy de Vite.
const BASE = import.meta.env.VITE_API_URL ?? ''

export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal })
  if (!res.ok) {
    const detail = await res.json().then((b) => b.detail).catch(() => null)
    throw new Error(typeof detail === 'string' ? detail : `Error ${res.status}`)
  }
  return (await res.json()) as T
}

export type Variable = {
  key: string
  label: string
  unit: string
  theme: string
  definition: string
  ratio_scale: boolean
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
}

export type Significance = 'very' | 'yes' | 'weak' | 'no'

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
  significance: Significance
  significant: boolean
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

export const SIGNIFICANCE_LABEL: Record<Significance, string> = {
  very: 'Muy significativa',
  yes: 'Significativa',
  weak: 'Indicio débil',
  no: 'No significativa',
}

export const DIRECTION_ARROW = { up: '↑', down: '↓', flat: '→' } as const

export const fmt = (x: number, digits = 3) =>
  x.toLocaleString('es', { maximumSignificantDigits: digits })
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
