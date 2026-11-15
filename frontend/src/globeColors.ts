/** Colores de la malla del mapa. Siete clases discretas por variable (como la leyenda de bloques
 *  de un atlas climático): tres hacia cada lado del "sin cambio". El color dice hacia dónde va,
 *  nunca si es "bueno" o "malo". Archivo aparte para no cargar MapLibre en el paquete principal. */

type Ramp = { neg: [string, string, string]; neutral: string; pos: [string, string, string] }

// neg: de más fuerte a más débil · pos: de más débil a más fuerte
const WARMING: Ramp = { neg: ['#1b4f9c', '#4a8fd0', '#9cc6ea'], neutral: '#e6e1d8', pos: ['#f4b942', '#e8622c', '#a8124f'] }
const WATER: Ramp = { neg: ['#8a4b12', '#c9812f', '#e6bb7a'], neutral: '#e6e1d8', pos: ['#8fd9cc', '#26a69a', '#00695c'] }
const WIND: Ramp = { neg: ['#4a2c8f', '#7e63c4', '#b9a8e6'], neutral: '#e6e1d8', pos: ['#f2d36b', '#e0a800', '#a87200'] }

const RAMPS: Record<string, Ramp> = {
  T2M: WARMING, T2M_MAX: WARMING, T2M_MIN: WARMING, TS: WARMING, T2MDEW: WARMING,
  PRECTOTCORR: WATER, GWETROOT: WATER, GWETTOP: WATER, RH2M: WATER, EVLAND: WATER,
  WS2M: WIND, PS: WIND,
}

// Bordes de clase como fracción de la escala (percentil 98 de |pendiente|)
const EDGES = [-0.7, -0.4, -0.15, 0.15, 0.4, 0.7]

function ramp(key: string): Ramp {
  return RAMPS[key] ?? WARMING
}

export function classIndex(slope: number, scale: number): number {
  const t = scale ? slope / scale : 0
  let i = 0
  while (i < EDGES.length && t >= EDGES[i]) i++
  return i // 0..6
}

export function classColor(key: string, idx: number): string {
  const r = ramp(key)
  return idx < 3 ? r.neg[idx] : idx === 3 ? r.neutral : r.pos[idx - 4]
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function cellColor(key: string, slope: number, scale: number, alpha: number): string {
  return rgba(classColor(key, classIndex(slope, scale)), alpha)
}

/** Bloques de la leyenda, de negativo a positivo, con sus límites numéricos. */
export function legendClasses(key: string, scale: number): { color: string; from: number | null; to: number | null }[] {
  const bounds = [-Infinity, ...EDGES.map((e) => e * scale), Infinity]
  return Array.from({ length: 7 }, (_, i) => ({
    color: classColor(key, i),
    from: Number.isFinite(bounds[i]) ? bounds[i] : null,
    to: Number.isFinite(bounds[i + 1]) ? bounds[i + 1] : null,
  }))
}
