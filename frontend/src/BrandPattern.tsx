/** Patrón de la marca: mosaico de cuartos de círculo, medios círculos y círculos en azul marino y cian.
 *  Determinista (misma semilla = mismo dibujo) para que no cambie entre cargas. */
const NAVY = '#00023d'
const CYAN = '#56e1e8'

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function BrandPattern({ cols = 8, rows = 6, seed = 7, className }: { cols?: number; rows?: number; seed?: number; className?: string }) {
  const S = 100
  const r = rng(seed)
  const tiles: { x: number; y: number; bg: string; fg: string; d: string }[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const flip = r() < 0.5
      const bg = flip ? NAVY : CYAN
      const fg = flip ? CYAN : NAVY
      const kind = Math.floor(r() * 6)
      const c = Math.floor(r() * 4) // esquina / lado
      let d = ''
      const h = S / 2
      if (kind === 0) d = `M ${S / 2 - h} ${S / 2} a ${h} ${h} 0 1 0 ${S} 0 a ${h} ${h} 0 1 0 ${-S} 0` // círculo
      else if (kind === 1 || kind === 2) {
        // cuarto de círculo de radio S con centro en una esquina
        const p = [
          `M 0 0 L ${S} 0 A ${S} ${S} 0 0 1 0 ${S} Z`,
          `M ${S} 0 L ${S} ${S} A ${S} ${S} 0 0 1 0 0 Z`,
          `M ${S} ${S} L 0 ${S} A ${S} ${S} 0 0 1 ${S} 0 Z`,
          `M 0 ${S} L 0 0 A ${S} ${S} 0 0 1 ${S} ${S} Z`,
        ]
        d = p[c]
      } else if (kind === 3) {
        // semicírculo apoyado en un lado
        const p = [
          `M 0 0 A ${h} ${h} 0 0 0 ${S} 0 Z`,
          `M ${S} 0 A ${h} ${h} 0 0 0 ${S} ${S} Z`,
          `M ${S} ${S} A ${h} ${h} 0 0 0 0 ${S} Z`,
          `M 0 ${S} A ${h} ${h} 0 0 0 0 0 Z`,
        ]
        d = p[c]
      } else if (kind === 4) d = `M 0 0 H ${S} V ${S} H 0 Z` // sólido
      tiles.push({ x: i * S, y: j * S, bg, fg, d })
    }
  }
  return (
    <svg className={className} viewBox={`0 0 ${cols * S} ${rows * S}`} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      {tiles.map((t, k) => (
        <g key={k} transform={`translate(${t.x} ${t.y})`}>
          <rect width={S} height={S} fill={t.bg} />
          {t.d && <path d={t.d} fill={t.fg} />}
        </g>
      ))}
    </svg>
  )
}
