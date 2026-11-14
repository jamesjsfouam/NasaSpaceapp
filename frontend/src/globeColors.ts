/** Colores de la malla del globo (separado para no cargar three.js en el paquete principal). */

// Paletas divergentes: el color dice hacia dónde va, no si es "bueno" o "malo".
const PALETTES: Record<string, [string, string]> = {
  T2M: ['#4f8cff', '#ff5a4f'], // enfría ← → calienta
  PRECTOTCORR: ['#c8843c', '#2fc7b5'], // más seco ← → más húmedo
  GWETROOT: ['#c8843c', '#2fc7b5'],
  RH2M: ['#c8843c', '#2fc7b5'],
  WS2M: ['#8f7cf6', '#f2b84b'],
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function cellColor(key: string, slope: number, scale: number, alpha: number): string {
  const [neg, pos] = PALETTES[key] ?? PALETTES.T2M
  const t = Math.max(-1, Math.min(1, scale ? slope / scale : 0))
  const target = hexToRgb(t < 0 ? neg : pos)
  const mix = (c: number) => Math.round(235 + (c - 235) * Math.abs(t)) // de blanco al color
  return `rgba(${target.map(mix).join(',')},${alpha})`
}

export function legendGradient(key: string): string {
  const [neg, pos] = PALETTES[key] ?? PALETTES.T2M
  return `linear-gradient(90deg, ${neg}, #ebebeb, ${pos})`
}
