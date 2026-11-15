import { LOGO_PATHS, LOGO_VIEWBOX, WORDMARK_PATHS, WORDMARK_VIEWBOX } from './logoPaths'

/** Marca gráfica (la "D" con la estrella), tal cual el manual: un solo color, sin trazos ni opacidad. */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      width={size}
      height={(size * 99) / 92}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {LOGO_PATHS.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

/** Logotipo completo DATEX (la D con la estrella + ATEX), tal cual el manual. */
export function Wordmark({ height = 26, title = 'DATEX' }: { height?: number; title?: string }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} height={height} width={(height * 437) / 99} fill="currentColor" role="img" aria-label={title} focusable="false">
      {WORDMARK_PATHS.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}
