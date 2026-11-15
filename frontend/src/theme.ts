/** Colores para gráficos y mapa (SVG/WebGL no leen siempre las variables CSS: se centralizan aquí).
 *  Deben coincidir con los tokens de styles/theme en index.css. */
export const COLOR = {
  ink: '#00023d',
  plum: '#00023d',
  paper: '#ffffff',
  sage: '#56e1e8',
  rule: '#bfeaee',
  observed: '#00023d', // serie principal (promedios anuales)
  trend: '#d4006a', // recta de tendencia
  monthly: '#8fcfd6', // anomalías mensuales (fondo)
  scenario: '#7a4cd1', // escenario y explicación con IA
  official: '#00897b', // proyección oficial (ONU)
  spotA: '#d4006a', // lugar principal
  spotB: '#00023d', // segundo lugar (comparar)
} as const

export const LANDCOVER_COLOR: Record<string, string> = {
  'Zona construida': '#d4006a',
  Cultivos: '#e0a100',
  'Árboles': '#00897b',
  Agua: '#0b6bbd',
  'Pastizal y matorral': '#8aa629',
  'Suelo desnudo': '#9a7b5f',
  'Vegetación inundada': '#2aa6a6',
  'Nieve y hielo': '#8e9aaf',
}
