import { useEffect, useState } from 'react'

/** Ciudades con escenario de crecimiento urbano precalculado (public/static-api/city). Todo estático. */
export type CityIndexEntry = { id: string; name: string; lat: number; lon: number; file: string }

export type CityPayload = {
  id: string
  name: string
  lat: number
  lon: number
  generated: string
  grid: { cols: number; rows: number; cell_m: number; west: number; south: number; east: number; north: number }
  base_year: number
  years: number[]
  density: string
  /** Escenario por defecto (integrado: clima + sociedad). */
  added: string
  /** Escenario solo con población urbana. */
  added_base?: string
  water: string
  new_cell_density: number
  scenarios?: { default: 'integrated' | 'population_only' } & Record<string, string>
  drivers?: CityDrivers
  stats: {
    built_km2: Record<string, number>
    built_km2_population_only?: Record<string, number>
    urban_population_million?: Record<string, number>
    beta: number
    beta_fitted: number
  }
  validation: {
    fit: string
    test: string
    new_cells: number
    auc: number
    figure_of_merit: number
    baseline_proximity: number
    baseline_random: number
  }
  coefficients: Record<string, number>
  sources: string[]
  method: string
  caveats: string[]
}

export type DriverRow = {
  urban_population_million: number
  gdp_per_capita_usd: number
  agricultural_employment_share: number
  delta_temperature_c: number
  delta_soil_wetness: number
  delta_rain_fraction: number
  heat_stress: number
  drought_stress: number
  climate_stress: number
  migration_push_multiplier: number
  built_km2_integrated: number
  built_km2_population_only: number
}

export type ClimateDriver = {
  label: string
  unit: string
  full_period: { start: number; verdict: 'significant' | 'not_yet' | 'no_trend'; slope_per_decade: number; mk_p: number }
  pettitt_p: number
  break_year: number | null
  break_detected: boolean
  used_period_start: number
  verdict: 'significant' | 'not_yet' | 'no_trend'
  slope_per_decade: number
  weight: number
}

export type CityDrivers = {
  table: Record<string, DriverRow>
  climate: Record<string, ClimateDriver>
  social: Record<string, number>
  assumptions: Record<string, number | Record<string, number>>
  sensitivity_built_km2_2050: Record<string, number>
}

export const MAX_CITY_KM = 30

let indexPromise: Promise<CityIndexEntry[]> | null = null
const cityCache = new Map<string, Promise<CityPayload>>()

export function loadCityIndex(): Promise<CityIndexEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch('./static-api/city/index.json')
      .then((r) => (r.ok ? (r.json() as Promise<CityIndexEntry[]>) : []))
      .catch(() => [])
  }
  return indexPromise
}

export function loadCity(entry: CityIndexEntry): Promise<CityPayload> {
  let p = cityCache.get(entry.id)
  if (!p) {
    p = fetch(`./static-api/${entry.file}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<CityPayload>
    })
    cityCache.set(entry.id, p)
  }
  return p
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Ciudad precalculada a menos de MAX_CITY_KM del punto, null si no hay (la pestaña "Ciudad 3D" solo aparece entonces). */
export function useNearestCity(lat: number | undefined, lon: number | undefined): CityIndexEntry | null | undefined {
  // undefined = todavía cargando el índice; null = no hay ciudad cerca
  const [found, setFound] = useState<CityIndexEntry | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    if (lat === undefined || lon === undefined) return
    loadCityIndex().then((list) => {
      if (!live) return
      let best: CityIndexEntry | null = null
      let bd = Infinity
      for (const c of list) {
        const d = distanceKm(lat, lon, c.lat, c.lon)
        if (d < bd) {
          bd = d
          best = c
        }
      }
      setFound(best && bd <= MAX_CITY_KM ? best : null)
    })
    return () => {
      live = false
    }
  }, [lat, lon])
  return lat === undefined || lon === undefined ? null : found
}
