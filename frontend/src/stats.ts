/** Estadística básica en el cliente (solo con datos que ya devuelve la API). */

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

/** Desviación estándar muestral (n − 1). */
export function sd(xs: number[]): number {
  if (xs.length < 2) return NaN
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

/** erf de Abramowitz–Stegun 7.1.26 (error < 1,5e-7). */
function erf(x: number): number {
  const s = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}

export const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))

/** p bilateral de un estadístico z. */
export const pFromZ = (z: number) => 2 * (1 - normCdf(Math.abs(z)))

export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return NaN
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN
}

/** p bilateral de r por la transformación de Fisher (aproximación normal; n > 3). */
export function pFromPearson(r: number, n: number): number {
  if (!Number.isFinite(r) || n <= 3) return NaN
  const rr = Math.max(-0.999999, Math.min(0.999999, r))
  return pFromZ(Math.atanh(rr) * Math.sqrt(n - 3))
}

/** Error estándar aproximado a partir de un IC del 95 % simétrico. */
export const seFromCI = (low: number, high: number) => (high - low) / (2 * 1.96)

/** Años en común de dos series anuales, en el mismo orden. */
export function commonYears(
  a: { year: number; mean: number }[],
  b: { year: number; mean: number }[],
): { years: number[]; xs: number[]; ys: number[] } {
  const mb = new Map(b.map((p) => [p.year, p.mean]))
  const years: number[] = []
  const xs: number[] = []
  const ys: number[] = []
  for (const p of a) {
    const v = mb.get(p.year)
    if (v !== undefined) {
      years.push(p.year)
      xs.push(p.mean)
      ys.push(v)
    }
  }
  return { years, xs, ys }
}

export const diffs = (xs: number[]) => xs.slice(1).map((v, i) => v - xs[i])
