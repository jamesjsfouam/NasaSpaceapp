import type {
  Demo, DemographicIndicator, Forecast, Indicator, Region, Relation, Trend, Variable, Verdict,
} from './api'

export type Lang = 'es' | 'en'
export type AudienceMode = 'student' | 'researcher'
export type Phase = 'briefing' | 'planet' | 'studio'

// --- Number formatting -----------------------------------------------------------------------

export function localeOf(lang: Lang): string {
  return lang === 'es' ? 'es' : 'en-US'
}

export function fmtNum(x: number, lang: Lang, digits = 3): string {
  const s = x.toLocaleString(localeOf(lang), { maximumSignificantDigits: digits })
  return /^-0([,.]0*)?$/.test(s) ? '0' : s
}

export function compactNum(x: number, lang: Lang): string {
  return Math.abs(x) >= 10000
    ? x.toLocaleString(localeOf(lang), { notation: 'compact', maximumSignificantDigits: 3 })
    : fmtNum(x, lang, 3)
}

export function fmtProb(p: number, lang: Lang): string {
  const sep = lang === 'es' ? ',' : '.'
  if (p < 0.0001) return `< 0${sep}0001`
  return p.toFixed(4).replace('.', sep)
}

export function pTextLang(p: number, lang: Lang): string {
  const sep = lang === 'es' ? ',' : '.'
  return p < 0.0001 ? `p < 0${sep}0001` : `p = ${fmtProb(p, lang)}`
}

// --- Catalog & Backend Value Dictionaries ----------------------------------------------------

type VarTranslation = { label: string; unit?: string; definition: string; reliability: string }

const VAR_EN: Record<string, VarTranslation> = {
  T2M: {
    label: 'Air temperature (mean)',
    definition: 'Average air temperature at 2 meters above the ground — what we feel day to day.',
    reliability: 'Reliable for long-term trends; represents a ~50 km grid cell, not a single weather station. Can be cross-checked with AIRS.',
  },
  T2M_MAX: {
    label: 'Daily maximum temperature',
    definition: 'Average daily peak temperature. Rises during heatwaves and hot afternoons.',
    reliability: 'Daily extremes from reanalysis are slightly less certain than long-term mean temperature.',
  },
  T2M_MIN: {
    label: 'Daily minimum temperature',
    definition: 'Average daily lowest temperature (nighttime warmth). Often reveals urban heat islands.',
    reliability: 'Daily extremes from reanalysis are slightly less certain than long-term mean temperature.',
  },
  TS: {
    label: 'Surface skin temperature',
    definition: 'Temperature of the ground or sea surface itself, rather than the air above it.',
    reliability: 'Modeled surface temperature; MODIS observes it directly since 2000 (clear skies only).',
  },
  PRECTOTCORR: {
    label: 'Precipitation',
    unit: 'mm/day',
    definition: 'Average daily rainfall (and snow). 1 mm equals 1 liter of water per square meter.',
    reliability: 'Reanalysis rainfall can show artificial jumps or trends when satellite sensors change (known shift around 1987). Best cross-checked with GPM IMERG.',
  },
  EVLAND: {
    label: 'Land evaporation',
    unit: 'mm/day',
    definition: 'Water moving from soil and vegetation into the air per day. Driven by heat and moisture availability.',
    reliability: 'Modeled variable depending on reanalysis rainfall; inherits any assimilation jumps.',
  },
  GWETROOT: {
    label: 'Root-zone soil moisture',
    unit: '0–1',
    definition: 'How wet the soil is at root depth: 0 = completely dry, 1 = saturated. Crucial for crops and forests.',
    reliability: 'Modeled soil moisture; GLDAS or SMOS/SMAP satellite sensors serve as independent cross-checks.',
  },
  GWETTOP: {
    label: 'Surface soil moisture',
    unit: '0–1',
    definition: 'How wet the top few centimeters of soil are: 0 = dry, 1 = saturated.',
    reliability: 'Modeled surface moisture; SMOS/SMAP measure it directly from space since 2010/2015.',
  },
  RH2M: {
    label: 'Relative humidity',
    definition: 'How much water vapor the air holds compared to the maximum possible at that temperature.',
    reliability: 'Reanalysis humidity is sensitive to changes in assimilated satellite sounders.',
  },
  T2MDEW: {
    label: 'Dew point temperature',
    definition: 'Temperature at which water vapor condenses. Higher values mean muggier, heavier air.',
    reliability: 'Reanalysis humidity is sensitive to changes in assimilated satellite sounders.',
  },
  CLOUD_AMT: {
    label: 'Cloud cover',
    definition: 'Percentage of the sky covered by clouds.',
    reliability: 'Cloud cover is difficult to measure homogeneously across multi-decade satellite transitions.',
  },
  ALLSKY_SFC_SW_DWN: {
    label: 'Surface solar radiation',
    unit: 'MJ/m²/day',
    definition: 'Solar energy reaching the ground each day — fuels solar panels and plant photosynthesis.',
    reliability: 'Long satellite-based radiation record (CERES); well-suited for trend analysis.',
  },
  WS2M: {
    label: 'Wind speed',
    definition: 'Average wind speed at 2 meters above the surface.',
    reliability: 'Near-surface wind depends strongly on local terrain and roughness.',
  },
  PS: {
    label: 'Surface pressure',
    definition: 'Weight of the air column above the ground. Tracks air masses and storm systems.',
    reliability: 'Very stable and well-observed atmospheric variable.',
  },
}

const SHORT_VAR_LABEL: Record<Lang, Record<string, string>> = {
  es: {
    T2M: 'Temperatura',
    PRECTOTCORR: 'Lluvia',
    GWETROOT: 'Humedad del suelo',
    RH2M: 'Humedad del aire',
    WS2M: 'Viento',
  },
  en: {
    T2M: 'Temperature',
    PRECTOTCORR: 'Rainfall',
    GWETROOT: 'Soil Moisture',
    RH2M: 'Air Humidity',
    WS2M: 'Wind Speed',
  },
}

export function shortVarName(key: string, lang: Lang, fallback: string): string {
  return SHORT_VAR_LABEL[lang][key] ?? fallback
}

export function tVariable(v: Variable, lang: Lang): Variable {
  if (lang === 'es') return v
  const tr = VAR_EN[v.key]
  if (!tr) return v
  return {
    ...v,
    label: tr.label,
    unit: tr.unit ?? v.unit,
    definition: tr.definition,
    reliability: tr.reliability,
  }
}

export function tUnit(unit: string, lang: Lang): string {
  if (lang === 'es') return unit
  return unit
    .replace('mm/día', 'mm/day')
    .replace('MJ/m²/día', 'MJ/m²/day')
    .replace('habitantes', 'people')
    .replace('% anual', '% / yr')
    .replace('hijos por mujer', 'births/woman')
    .replace('por 1000 habitantes', 'per 1,000')
    .replace('% de la población', '% of population')
    .replace('% del PIB', '% of GDP')
    .replace('% del empleo', '% of jobs')
    .replace('US$ constantes', 'constant US$')
    .replace('años', 'years')
    .replace('índice', 'index')
}

export const CONCERNS_EN: Record<string, string> = {
  heat: 'Heat & warming',
  water: 'Rain & water',
  drought: 'Drought & crops',
  sun: 'Sun & energy',
  wind: 'Wind & storms',
}

export const PLACE_TYPES_EN: Record<string, string> = {
  city: 'A city',
  farmland: 'Farmland',
  forest: 'Forest or jungle',
  coast: 'Coastal zone',
  dry: 'Dryland or desert',
  cold: 'Mountain or cold zone',
}

export const THEMES_EN: Record<string, string> = {
  temperature: 'Temperature',
  water: 'Rain & water',
  soil: 'Soil & agriculture',
  humidity: 'Humidity & clouds',
  sun: 'Solar energy',
  wind: 'Wind & pressure',
}

const REGIONS_EN: Record<string, { label: string; biome: string }> = {
  managua: { label: 'Managua, Nicaragua', biome: 'Tropical city' },
  corredor_seco: { label: 'Dry Corridor (Somoto), Nicaragua', biome: 'Tropical dry forest' },
  bluefields: { label: 'Bluefields, Caribbean Nicaragua', biome: 'Humid coastal rainforest' },
  amazonas: { label: 'Central Amazon (Manaus), Brazil', biome: 'Tropical rainforest' },
  sahara: { label: 'Central Sahara, Algeria', biome: 'Desert' },
  artico: { label: 'Svalbard, Arctic', biome: 'Arctic tundra' },
  cdmx: { label: 'Mexico City, Mexico', biome: 'High-altitude megacity' },
}

export function tRegion(r: Region, lang: Lang): Region {
  if (lang === 'es') return r
  const tr = REGIONS_EN[r.id]
  return tr ? { ...r, ...tr } : r
}

const DEMOS_EN: Record<string, { title: string; why: string }> = {
  'managua:T2M': {
    title: 'Is Managua getting warmer?',
    why: 'Mean air temperature is the clearest baseline — and reveals why autocorrelation matters.',
  },
  'corredor_seco:GWETROOT': {
    title: 'Is the Dry Corridor soil drying out?',
    why: 'Root-zone moisture directly governs local crops and drought stress.',
  },
  'amazonas:PRECTOTCORR': {
    title: 'Is rainfall changing in the Amazon?',
    why: 'Rainfall fluctuates wildly year to year — a classic test for false trends.',
  },
  'artico:T2M': {
    title: 'Does the Arctic warm faster than the tropics?',
    why: 'Compare Svalbard with Managua: the same variable tells opposite stories.',
  },
}

export function tDemo(d: Demo, lang: Lang): Demo {
  if (lang === 'es') return d
  const tr = DEMOS_EN[`${d.region}:${d.variable}`]
  return tr ? { ...d, ...tr } : d
}

const DEMOGRAPHY_EN: Record<string, { label: string; unit: string; definition: string }> = {
  population: { label: 'Population', unit: 'people', definition: 'Total number of inhabitants in the country.' },
  growth: { label: 'Population growth', unit: '% / yr', definition: 'Annual percentage change in population (births + immigration minus deaths + emigration).' },
  fertility: { label: 'Fertility rate', unit: 'births/woman', definition: 'Average children born per woman. Around 2.1 maintains long-term population stability.' },
  birth_rate: { label: 'Birth rate', unit: 'per 1,000', definition: 'Live births per 1,000 inhabitants per year.' },
  death_rate: { label: 'Death rate', unit: 'per 1,000', definition: 'Deaths per 1,000 inhabitants per year.' },
  urban: { label: 'Urban population', unit: '% of population', definition: 'Share of people living in cities and towns.' },
  life_expectancy: { label: 'Life expectancy', unit: 'years', definition: 'Expected lifespan of a newborn under current mortality conditions.' },
}

export function tDemography(d: DemographicIndicator, lang: Lang): DemographicIndicator {
  if (lang === 'es') return d
  const tr = DEMOGRAPHY_EN[d.key]
  return tr ? { ...d, ...tr } : d
}

const INDICATORS_EN: Record<string, { label: string; unit: string; definition: string }> = {
  'AG.YLD.CREL.KG': { label: 'Cereal yield', unit: 'kg/ha', definition: 'Kilograms of cereal (corn, rice, wheat, sorghum) harvested per hectare.' },
  'AG.PRD.CROP.XD': { label: 'Crop production index', unit: 'index', definition: 'Total crop output compared to a baseline period (= 100).' },
  'AG.PRD.FOOD.XD': { label: 'Food production index', unit: 'index', definition: 'Food crop and livestock output compared to baseline (= 100).' },
  'NV.AGR.TOTL.ZS': { label: 'Agriculture share of GDP', unit: '% of GDP', definition: 'Share of national economic output from farming, forestry, and fishing.' },
  'SL.AGR.EMPL.ZS': { label: 'Agricultural employment', unit: '% of jobs', definition: 'Share of total workers employed in agriculture (ILO modeled estimate).' },
  'SN.ITK.DEFC.ZS': { label: 'Undernourishment', unit: '% of population', definition: 'Share of the population with habitual insufficient caloric intake.' },
  'SP.RUR.TOTL.ZS': { label: 'Rural population', unit: '% of population', definition: 'Share of the population living outside urban areas.' },
  'NY.GDP.PCAP.KD': { label: 'GDP per capita', unit: 'constant US$', definition: 'Inflation-adjusted economic output per person.' },
  'EG.ELC.ACCS.ZS': { label: 'Electricity access', unit: '% of population', definition: 'Share of households with access to electricity.' },
  'SP.POP.TOTL': { label: 'Population', unit: 'people', definition: 'Total national population.' },
}

export function tIndicator(i: Indicator, lang: Lang): Indicator {
  if (lang === 'es') return i
  const tr = INDICATORS_EN[i.key]
  return tr ? { ...i, ...tr } : i
}

export const LANDCOVER_LABEL: Record<Lang, Record<string, string>> = {
  es: {
    'Zona construida': 'Zona construida',
    Cultivos: 'Cultivos',
    'Árboles': 'Árboles',
    Agua: 'Agua',
    'Pastizal y matorral': 'Pastizal y matorral',
    'Suelo desnudo': 'Suelo desnudo',
    'Vegetación inundada': 'Vegetación inundada',
    'Nieve y hielo': 'Nieve y hielo',
  },
  en: {
    'Zona construida': 'Built-up area',
    Cultivos: 'Crops',
    'Árboles': 'Trees',
    Agua: 'Water',
    'Pastizal y matorral': 'Grassland & scrub',
    'Suelo desnudo': 'Bare ground',
    'Vegetación inundada': 'Flooded vegetation',
    'Nieve y hielo': 'Snow & ice',
  },
}

// --- Statistical Simplification & Human-Friendly Explanations --------------------------------

export function verdictLabel(verdict: Verdict, lang: Lang, mode: AudienceMode): string {
  if (lang === 'es') {
    if (mode === 'student') {
      return {
        significant: 'Cambio Confirmado',
        not_yet: 'En Observación (Todavía no)',
        no_trend: 'Estable / Variación Natural',
      }[verdict]
    }
    return {
      significant: 'Tendencia significativa',
      not_yet: 'Todavía no significativa',
      no_trend: 'Sin tendencia clara',
    }[verdict]
  }
  if (mode === 'student') {
    return {
      significant: 'Confirmed Change',
      not_yet: 'Under Observation (Not Yet)',
      no_trend: 'Stable / Natural Swings',
    }[verdict]
  }
  return {
    significant: 'Statistically significant',
    not_yet: 'Not yet significant',
    no_trend: 'No clear trend',
  }[verdict]
}

export function certaintyInfo(mkP: number, verdict: Verdict, lang: Lang): {
  pct: number
  headline: string
  detail: string
  tone: 'high' | 'mid' | 'low'
} {
  const pct = Math.max(5, Math.min(99.9, (1 - mkP) * 100))
  const pctStr = fmtNum(pct, lang, 3)
  if (verdict === 'significant') {
    return {
      pct,
      tone: 'high',
      headline: lang === 'es' ? `${pctStr} % de certeza` : `${pctStr}% certainty`,
      detail: lang === 'es'
        ? 'Muy improbable que sea pura suerte o ruido del clima.'
        : 'Very unlikely to be random luck or natural climate noise.',
    }
  }
  if (verdict === 'not_yet') {
    return {
      pct,
      tone: 'mid',
      headline: lang === 'es' ? `${pctStr} % de certeza (en prueba)` : `${pctStr}% certainty (testing)`,
      detail: lang === 'es'
        ? 'Hay una señal visible, pero aún no alcanza el 95 % de rigor tras corregir la memoria climática.'
        : 'There is a visible signal, but it does not yet pass the 95% threshold after autocorrelation filtering.',
    }
  }
  return {
    pct: Math.min(pct, 79),
    tone: 'low',
    headline: lang === 'es' ? 'Señal compatible con azar' : 'Matches normal background noise',
    detail: lang === 'es'
      ? 'Las subidas y bajadas entran dentro de lo normal en este periodo.'
      : 'Year-to-year swings stay within normal natural variability for this window.',
  }
}

export function humanVerdictSummary(
  t: Trend,
  where: string,
  varLabel: string,
  lang: Lang,
  mode: AudienceMode,
): string {
  const unit = tUnit(t.unit, lang)
  const sign = t.slope_per_decade > 0 ? '+' : ''
  const totSign = t.total_change > 0 ? '+' : ''
  const rate = `${sign}${fmtNum(t.slope_per_decade, lang)} ${unit}`
  const tot = `${totSign}${fmtNum(t.total_change, lang)} ${unit}`
  const pctPart = t.percent_change !== null
    ? ` (${t.percent_change > 0 ? '+' : ''}${t.percent_change.toFixed(1)}%)`
    : ''
  const period = `${t.first_year}–${t.last_year}`

  if (lang === 'es') {
    const dirWord = t.direction === 'up' ? 'está subiendo' : t.direction === 'down' ? 'está bajando' : 'se mantiene sin cambio claro'
    if (t.verdict === 'significant') {
      if (mode === 'student') {
        return `${varLabel} en ${where} ${dirWord} de forma real y sostenida (${rate} cada década entre ${period}, un cambio acumulado de ${tot}${pctPart}). Ambas pruebas anti-falsas-alarmas coinciden: esto no parece casualidad.`
      }
      return `${varLabel} en ${where} presenta una tendencia significativa (${rate}/década; total ${tot}${pctPart} en ${period}). Mann-Kendall preblanqueado (${pTextLang(t.mk_p, 'es')}) y regresión con n efectivo (${fmtNum(t.n_effective, 'es', 3)} años equiv.) rechazan H₀.`
    }
    if (t.verdict === 'not_yet') {
      const needPart = t.years_needed
        ? (t.years_needed > t.n_years
          ? `Con este nivel de variación natural harían falta ~${t.years_needed} años de registro para confirmarlo (actualmente tenemos ${t.n_years}).`
          : `Aunque hay ${t.n_years} años, las dos pruebas estadísticas no coinciden todavía, por eso el veredicto es prudente.`)
        : ''
      if (mode === 'student') {
        return `Aunque la línea parece moverse (${rate} por década en ${period}), todavía NO podemos afirmarlo con seguridad: el clima varía mucho año con año. ${needPart}`
      }
      return `Tendencia aún no concluyente para ${varLabel.toLowerCase()} en ${where} (${rate}/década; MK ${pTextLang(t.mk_p, 'es')}). ${needPart}`
    }
    if (mode === 'student') {
      const extra = t.years_needed
        ? ` Si existiera un cambio de este tamaño (${rate}/década), necesitaríamos unos ${t.years_needed} años de datos para distinguirlo del ruido.`
        : ''
      return `En ${period}, ${varLabel.toLowerCase()} en ${where} no muestra una tendencia clara: los altibajos son compatibles con la variación natural normal.${extra}`
    }
    return `Sin tendencia significativa en ${where} para ${period} (pendiente Theil–Sen ${rate}/década, MK ${pTextLang(t.mk_p, 'es')}). Compatible con ruido estacionario o AR(1).`
  }

  // English
  const dirWord = t.direction === 'up' ? 'rising' : t.direction === 'down' ? 'falling' : 'flat'
  if (t.verdict === 'significant') {
    if (mode === 'student') {
      return `${varLabel} in ${where} is ${dirWord} steadily (${rate} per decade across ${period}, totaling ${tot}${pctPart}). Both false-alarm-resistant statistical tests agree: this shift is very unlikely to be luck.`
    }
    return `${varLabel} in ${where} shows a statistically significant trend (${rate}/decade; cumulative ${tot}${pctPart} over ${period}). Both prewhitened Mann-Kendall (${pTextLang(t.mk_p, 'en')}) and effective-N OLS (${fmtNum(t.n_effective, 'en', 3)} equiv. years) reject H₀.`
  }
  if (t.verdict === 'not_yet') {
    const needPart = t.years_needed
      ? (t.years_needed > t.n_years
        ? `At this pace and noise level, ~${t.years_needed} years of data are needed to confirm it (we currently have ${t.n_years}).`
        : `We have ${t.n_years} years, but the two independent tests disagree, so VERDICT stays cautious.`)
      : ''
    if (mode === 'student') {
      return `The chart tilts (${rate} per decade in ${period}), but it is NOT YET confirmed: natural year-to-year climate swings are still large enough to mimic this slope. ${needPart}`
    }
    return `Trend not yet confirmed for ${varLabel.toLowerCase()} in ${where} (${rate}/decade; MK ${pTextLang(t.mk_p, 'en')}). ${needPart}`
  }
  if (mode === 'student') {
    const extra = t.years_needed
      ? ` If a shift this size (${rate}/decade) were actually happening, we would need ~${t.years_needed} years of data to spot it clearly.`
      : ''
    return `Across ${period}, ${varLabel.toLowerCase()} in ${where} shows no clear trend: year-to-year ups and downs look like normal natural variability.${extra}`
  }
  return `No clear trend detected in ${where} over ${period} (Theil–Sen ${rate}/decade, MK ${pTextLang(t.mk_p, 'en')}). Indistinguishable from natural AR(1) variability.`
}

export function translateWarning(w: string, lang: Lang, mode: AudienceMode): string {
  if (lang === 'es' && mode === 'researcher') return w

  // High autocorrelation
  if (w.startsWith('Autocorrelación alta')) {
    const m = w.match(/\(([^)]+)\)/)
    const rVal = m ? m[1] : ''
    if (lang === 'es') {
      return `El clima aquí tiene "memoria fuerte" entre años seguidos (${rVal}): un año cálido o seco suele seguir a otro igual, lo que hace más fácil confundir rachas con cambios reales.`
    }
    return mode === 'student'
      ? `Strong year-to-year climate "memory" (${rVal}): warm or dry years tend to cluster together, making natural streaks look like long-term trends.`
      : `High lag-1 autocorrelation (${rVal}): even after correction, false-positive risk is elevated.`
  }
  // Methods disagree
  if (w.startsWith('Las dos pruebas')) {
    if (lang === 'es') return 'Nuestros dos detectores matemáticos no se ponen de acuerdo todavía: por seguridad marcamos el resultado como "En observación".'
    return mode === 'student'
      ? 'Our two statistical detectors disagree on this time series, so we conservatively mark it as "Not Yet Confirmed".'
      : 'Prewhitened Mann-Kendall and effective-N OLS disagree; verdict remains conservative.'
  }
  // Period sensitivity
  if (w.startsWith('El veredicto cambia')) {
    if (lang === 'es') return 'Cuidado: si movemos el año de inicio o fin por apenas 1 a 3 años, la conclusión cambia. Depende bastante del tramo elegido.'
    return mode === 'student'
      ? 'Heads up: shifting the start or end date by just 1–3 years changes the verdict. The result is sensitive to the chosen time window.'
      : 'Period-sensitive: shifting start/end boundaries by ±3 years changes the verdict.'
  }
  // Abrupt step change (Pettitt)
  if (w.startsWith('Parece un salto brusco')) {
    const yearMatch = w.match(/hacia (\d{4})/)
    const pMatch = w.match(/Pettitt, ([^)]+)\)/)
    const yr = yearMatch ? yearMatch[1] : ''
    const pStr = pMatch ? pMatch[1].replace(',', lang === 'en' ? '.' : ',') : ''
    if (lang === 'es') {
      return `¡Ojo! Los datos saltaron de golpe alrededor de ${yr} en lugar de cambiar poco a poco. Esto suele pasar cuando cambian los satélites de la NASA, no por el clima real.`
    }
    return mode === 'student'
      ? `Watch out! The data jumped abruptly around ${yr} rather than changing gradually. This often signals a satellite sensor upgrade rather than real climate change.`
      : `Possible abrupt step change around ${yr} (Pettitt ${pStr}) rather than a gradual linear trend; likely a reanalysis assimilation shift. Cross-check with an independent source.`
  }
  // Forecast warnings
  if (w.startsWith('La previsión mira')) {
    const nums = w.match(/\d+/g) ?? []
    if (lang === 'es') return `El escenario mira ${nums[0] ?? ''} años al futuro usando solo ${nums[1] ?? ''} años de historia: úsalo como una referencia visual, no como predicción exacta.`
    return `This scenario projects ${nums[0] ?? ''} years ahead from ${nums[1] ?? ''} years of history: use it as a "what-if" scenario, never as a deterministic forecast.`
  }
  if (w.startsWith('Los años consecutivos')) {
    if (lang === 'es') return 'Como años cercanos se parecen entre sí, el margen real del futuro podría ser más ancho que la banda morada.'
    return 'Consecutive years are correlated: the true future uncertainty band is likely wider than shown.'
  }
  if (w.startsWith('La tendencia de base no es significativa')) {
    if (lang === 'es') return 'Como la tendencia actual aún no está confirmada, la línea central vale casi igual que el promedio actual; mira sobre todo la banda ancha.'
    return 'Baseline trend is not statistically significant: focus on the wide uncertainty band rather than the center line.'
  }
  if (w.startsWith('La recta llega a un límite físico')) {
    if (lang === 'es') return 'La recta matemática choca con un límite físico imposible (ej. 0 % o 100 %); en la realidad se frenaría antes.'
    return 'The linear path hits a physical boundary (e.g. 0% or 100%); real-world change would saturate earlier.'
  }
  // Land cover warnings
  if (w.includes('clasificador') || w.includes('modelo automático')) {
    if (lang === 'es') return w
    return 'Land cover is classified automatically at 10 m resolution. A sharp 1-year jump usually reflects classifier calibration rather than real terrain change.'
  }
  if (w.includes('salto de más de 5 puntos')) {
    if (lang === 'es') return w
    return 'Built-up or cover share jumps by >5 percentage points in a single year here: interpret cautiously.'
  }
  // Relation warnings
  if (w.startsWith('Se compara un punto')) {
    const parts = w.match(/\(([^,]+), celda.*?\(([^)]+)\)/)
    const pl = parts?.[1] ?? 'this point'
    const co = parts?.[2] ?? 'country'
    if (lang === 'es') return w
    return `Compares one ~50 × 60 km grid cell (${pl}) against a national indicator for ${co}. Local anomalies may not represent the entire country.`
  }
  if (w.startsWith('Pocos años en común')) {
    if (lang === 'es') return w
    return 'Few overlapping years: a real correlation may fail to reach significance.'
  }
  if (w.startsWith('Pearson y Spearman')) {
    if (lang === 'es') return w
    return 'Pearson and Spearman disagree: one or two extreme outlier years may dominate the correlation.'
  }
  return w
}

export function formatForecastText(fc: Forecast, varLabel: string, unit: string, lang: Lang): string {
  const u = tUnit(unit, lang)
  const end = fc.points[fc.points.length - 1]
  if (!end) return fc.text
  const rate = fc.slope_per_year * 10
  const sign = rate > 0 ? '+' : ''
  if (lang === 'es') {
    return `Si el ritmo de ${fc.base_first_year}–${fc.base_last_year} continuara (${sign}${fmtNum(rate, 'es')} ${u}/década), en ${fc.to_year} ${varLabel.toLowerCase()} rondaría ${fmtNum(end.value, 'es')} ${u} (rango del 95 %: ${fmtNum(end.low, 'es')} a ${fmtNum(end.high, 'es')}).`
  }
  return `If the ${fc.base_first_year}–${fc.base_last_year} pace continued (${sign}${fmtNum(rate, 'en')} ${u}/decade), by ${fc.to_year} ${varLabel.toLowerCase()} would be around ${fmtNum(end.value, 'en')} ${u} (95% interval: ${fmtNum(end.low, 'en')} to ${fmtNum(end.high, 'en')}). Remember: this is a linear scenario, not a climate prediction.`
}

export function formatRelationText(
  rel: Relation,
  varLabel: string,
  indLabel: string,
  place: string,
  country: string,
  lang: Lang,
  mode: AudienceMode,
): string {
  if (lang === 'es' && mode === 'researcher') return rel.interpretation
  const strengthMap = {
    es: { débil: 'débil', moderada: 'moderada', fuerte: 'fuerte' },
    en: { débil: 'weak', moderada: 'moderate', fuerte: 'strong' },
  }
  const str = strengthMap[lang][rel.strength] ?? rel.strength
  if (lang === 'es') {
    const base = rel.significant
      ? `Cuando ${varLabel.toLowerCase()} en ${place} sube por encima de su tendencia en un año cualquiera, ${indLabel.toLowerCase()} en ${country} suele moverse ${rel.detrended_r > 0 ? 'en la misma dirección' : 'en dirección contraria'} (relación ${str}, r = ${fmtNum(rel.detrended_r, 'es', 2)}).`
      : `Al quitar las tendencias de largo plazo, no hay una conexión clara año a año entre ${varLabel.toLowerCase()} en ${place} y ${indLabel.toLowerCase()} en ${country} (r = ${fmtNum(rel.detrended_r, 'es', 2)}).`
    const trap = rel.trend_driven
      ? ` ¡Cuidado con la trampa estadística! Sin filtrar las tendencias parecía haber relación (r = ${fmtNum(rel.raw_r, 'es', 2)}), pero solo era coincidencia porque ambas cambian con el tiempo.`
      : ''
    return `${base}${trap} Recuerda: coincidir en el tiempo no demuestra causa directa.`
  }
  const base = rel.significant
    ? `Year-to-year, whenever ${varLabel.toLowerCase()} in ${place} deviates from its trend, ${indLabel.toLowerCase()} in ${country} tends to move in the ${rel.detrended_r > 0 ? 'same' : 'opposite'} direction (${str} link, r = ${fmtNum(rel.detrended_r, 'en', 2)}, ${pTextLang(rel.detrended_p, 'en')}).`
    : `Once long-term trends are removed, no clear year-to-year link appears between ${varLabel.toLowerCase()} in ${place} and ${indLabel.toLowerCase()} in ${country} (r = ${fmtNum(rel.detrended_r, 'en', 2)}, ${pTextLang(rel.detrended_p, 'en')}).`
  const trap = rel.trend_driven
    ? ` Beware the trend trap: raw values looked correlated (r = ${fmtNum(rel.raw_r, 'en', 2)}), only because both series drift over time independently.`
    : ''
  return `${base}${trap} Correlation shows association, not proof of causation.`
}

// --- Static UI Text Dictionary ---------------------------------------------------------------

export const UI = {
  es: {
    brandSub: 'Detective de Tendencias del Sistema Tierra',
    phases: {
      briefing: { num: '01', label: 'Guía y Misión' },
      planet: { num: '02', label: 'Planeta 3D' },
      studio: { num: '03', label: 'Paneles Estadísticos' },
    },
    modeLabel: {
      student: '🎓 Estudiante',
      researcher: '🔬 Investigador',
    },
    modeTip: {
      student: 'Modo Estudiante: cifras simples, barras visuales y gráficas limpias',
      researcher: 'Modo Investigador: valores p, τ de Kendall, n efectivo y tablas de rigor',
    },
    phase1: {
      kicker: 'NASA Space Apps Challenge 2026 · Equipo Laboratorio Boreal',
      headline: 'Investiga si el clima de cualquier lugar del mundo está cambiando — sin caer en falsas alarmas.',
      sub: 'VERDICT transforma más de 40 años de satélites de la NASA en tres pasos simples: comprende el reto, haz zoom a cualquier punto sobre nuestro globo 3D unificado y obtén un veredicto estadístico honesto.',
      ctaPlanet: 'Explorar el Planeta 3D →',
      ctaCases: 'Ver Casos Guiados',
      stats: {
        vars: 'Variables NASA',
        varsSub: 'MERRA-2 y CERES',
        years: 'Años de historia',
        yearsSub: 'Desde 1981',
        cells: 'Celdas globales',
        cellsSub: 'Malla 5° con filtro FDR',
        countries: 'Países integrados',
        countriesSub: 'ONU + Banco Mundial',
      },
      qTitle: 'Las 4 preguntas que todo detective del clima debe responder',
      questions: [
        { icon: '🌡️', q: '¿Qué está cambiando?', desc: 'Convierte tu duda cotidiana (calor, sequía, lluvias, energía solar o viento) en la variable satelital exacta.' },
        { icon: '🌍', q: '¿Dónde ocurre?', desc: 'Sin mapas duplicados: gira la Tierra en 3D, haz zoom a tu ciudad o bosque y marca el punto directamente.' },
        { icon: '📏', q: '¿Cuánto cambia?', desc: 'Calculamos el ritmo por década (pendiente Theil–Sen, inmune a años extremos) y el cambio acumulado.' },
        { icon: '🛡️', q: '¿Es real o casualidad?', desc: 'El corazón de VERDICT: distingue el cambio real de las rachas naturales gracias a pruebas resistentes a la memoria climática.' },
      ],
      trapTitle: '¿Por qué las gráficas normales engañan? El filtro anti-falsas-alarmas',
      trapDesc: 'Los datos de la Tierra "tienen memoria": un año caliente suele arrastrar al siguiente. Si aplicas una línea de tendencia común sin corregir eso, declaras alarmas falsas casi la mitad de las veces cuando no pasa nada.',
      trapTableTitle: 'Validación por simulación Monte Carlo (30 años sin tendencia real)',
      trapCols: ['Memoria del clima (φ)', 'Regresión común (Falsas alarmas)', 'VERDICT (Ambas pruebas + corrección)', 'Mejora'],
      trapNote: 'Con φ = 0,8, la regresión común se equivoca en el 49 % de los casos. VERDICT lo mantiene controlado en 8,2 %.',
      semaforoTitle: 'Cómo leer el Veredicto Honesto',
      semaforo: [
        { tone: 'significant', badge: 'Confirmado', title: 'Tendencia Significativa', desc: 'Supera dos pruebas independientes (Mann-Kendall preblanqueado y regresión con tamaño efectivo). Muy improbable que sea azar.' },
        { tone: 'not_yet', badge: 'En observación', title: 'Todavía NO Significativa', desc: 'La gráfica parece moverse, pero la variación natural aún es fuerte. Te decimos exactamente cuántos años de datos faltan para confirmarlo.' },
        { tone: 'no_trend', badge: 'Estable', title: 'Sin Tendencia Clara', desc: 'Los altibajos observados entran dentro del comportamiento normal de la naturaleza en ese periodo.' },
      ],
      demosTitle: 'Empieza en 1 clic con un caso real del mundo',
      demosSub: 'Haz clic en cualquiera de estos casos diseñados para mostrar contrastes reales (incluyendo por qué "todavía no" también es ciencia).',
      demoBtn: 'Abrir en Paneles →',
      demoGlobeBtn: 'Ver en Planeta',
    },
    phase2: {
      title: 'Planeta Interactivo Unificado · Macro a Micro',
      sub: 'Gira la Tierra para ver las 2.592 celdas globales con filtro FDR. Acércate (zoom) o busca una ciudad para ver el relieve satelital real y marcar cualquier punto del mundo.',
      globalBtn: '🌍 Vista Global',
      zoomZoneBtn: '🔍 Zoom a la Zona',
      centerBtn: '📍 Centrar Punto',
      nightToggle: 'Vista nocturna (VIIRS Black Marble)',
      fdrToggle: 'Solo tendencias confirmadas (FDR)',
      legendHelp: 'Opaco = tendencia confirmada que pasa el control global FDR (q = 0,10). Al hacer zoom hacia tu ciudad, la capa se vuelve transparente para mostrarte la imagen satelital real.',
      dockStep1: '1 · Ubica o haz zoom a tu zona',
      dockStep2: '2 · ¿Qué quieres investigar?',
      dockStep3: '3 · Abrir Estudio Estadístico',
      searchPlaceholder: 'Busca ciudad, pueblo o región (ej. Managua, Madrid, Lima…)',
      searchBtn: 'Buscar',
      compareToggle: 'El próximo clic en el planeta marca un 2.º lugar para comparar',
      askPlaceholder: 'Pregunta libre: "¿se está secando el suelo en Somoto?"',
      askBtn: 'Interpretar',
      concernTitle: '¿Qué te preocupa?',
      placeTypeTitle: '¿Qué tipo de lugar es?',
      recTitle: 'Variables recomendadas para tu caso',
      allVarsLabel: 'O elige cualquiera de las 14 variables NASA',
      startYearLabel: 'Año inicial del análisis',
      launchBtn: 'Analizar Zona y Ver Paneles →',
      busyBtn: 'Calculando veredicto…',
      selectedBadge: 'Zona activa en el planeta',
      openStudioNow: 'Ir a Paneles Estadísticos →',
      secondSpotLabel: '2.º punto para comparar',
    },
    phase3: {
      backToPlanet: '🌍 Volver al Planeta 3D (Cambiar zona)',
      compareShortcut: '⚖️ Comparar con otra zona',
      tabs: {
        trend: '🎯 Veredicto y Futuro',
        scan: '🧭 Radar 14 Variables',
        compare: '⚖️ Comparar 2 Zonas',
        satellite: '🛰️ Satélite (1984–2025)',
        population: '👥 Población (ONU)',
        relate: '🌾 Clima y Sociedad',
      },
      kpi: {
        what: '¿Qué cambia y dirección?',
        pace: 'Ritmo de cambio',
        certainty: 'Certeza estadística',
        data: 'Suficiencia de datos',
        yearsHave: 'años analizados',
        yearsNeed: 'años necesarios (~90 % detección)',
        enoughData: 'Registro suficiente para concluir',
        missingYearsPrefix: 'Faltan aprox.',
        missingYearsSuffix: 'años más a este ritmo',
        plausibleRange: 'Rango razonable (95 %):',
        perDecade: '/ década',
        totalOver: 'acumulado en',
        yearsWord: 'años',
      },
      chart: {
        title: 'Evolución Histórica y Tendencia',
        simpleBtn: 'Vista Simple (Anual)',
        fullBtn: 'Vista Completa (+ Meses)',
        guideSimple: 'Cada punto cian es el promedio anual respecto a la media histórica. La línea naranja marca el ritmo sostenido (Theil–Sen).',
        guideFull: 'Incluye en gris oscuro las anomalías mensuales desestacionalizadas para ver el ruido de corto plazo junto al promedio anual.',
        yAxis: 'Anomalía',
        monthlyName: 'Meses (sin estación)',
        annualName: 'Promedio anual',
        trendName: 'Tendencia (Theil–Sen)',
        bandName: 'Escenario: rango 95 %',
        scenarioName: 'Escenario si el ritmo sigue',
        todayLabel: 'hoy',
      },
      scenario: {
        title: 'Proyección de Escenario ("¿Qué pasaría si el ritmo continúa?")',
        note: 'Etiquetado como escenario lineal hipotético, no como predicción climática.',
        btnPrefix: 'Calcular escenario al año',
      },
      rigor: {
        summaryStudent: '🔬 Ver detalles técnicos y validación estadística (Para investigadores)',
        summaryResearcher: '🔬 Motor Estadístico Dual y Validación Monte Carlo',
        methodTitle: 'Comparativa de los 2 métodos independientes',
        cols: ['Método', 'Pendiente / década', 'IC 95 %', 'Valor p / Estadístico'],
        row1: 'Theil–Sen + Mann-Kendall (preblanqueado)',
        row2: 'Regresión OLS (n efectivo) + t-test',
        agreeYes: 'Ambos métodos coinciden en la conclusión.',
        agreeNo: 'Los métodos no coinciden: el veredicto se mantiene prudente.',
        sourceLive: 'Fuente: NASA POWER en vivo (MERRA-2 / CERES).',
        sourceLocal: 'Fuente: muestra local verificada de NASA POWER (modo sin conexión).',
      },
      scan: {
        title: 'Radar completo en',
        sub: 'Las 14 variables satelitales ordenadas de evidencia más fuerte a más débil. Haz clic en cualquier variable para abrir su Veredicto.',
        bonferroniNote: 'Al probar múltiples variables a la vez, algunas pueden parecer significativas por azar. El p ajustado (Bonferroni) protege contra falsos descubrimientos.',
        regionsTitle: 'Misma variable en las 7 regiones de referencia mundial',
        regionsSub: 'Demuestra que un mismo indicador puede subir fuertemente en un bioma y bajar o mantenerse estable en otro.',
        colsScan: ['Variable', 'Dir.', 'Ritmo / década', 'Certeza / p', 'Veredicto'],
        colsReg: ['Región y Bioma', 'Dir.', 'Ritmo / década', 'p', 'Veredicto'],
      },
    },
  },
  en: {
    brandSub: 'Earth System Trend Detective',
    phases: {
      briefing: { num: '01', label: 'Briefing & Method' },
      planet: { num: '02', label: '3D Planet' },
      studio: { num: '03', label: 'Analytics Studio' },
    },
    modeLabel: {
      student: '🎓 Student',
      researcher: '🔬 Researcher',
    },
    modeTip: {
      student: 'Student Mode: plain-language verdicts, visual certainty meters, and clean charts',
      researcher: 'Researcher Mode: exact p-values, Kendall τ, effective N, and Monte Carlo rigor',
    },
    phase1: {
      kicker: 'NASA Space Apps Challenge 2026 · Team Laboratorio Boreal',
      headline: 'Investigate if Earth is really changing anywhere on the planet — without falling for false alarms.',
      sub: 'VERDICT turns 40+ years of NASA satellite & reanalysis records into three intuitive phases: learn how real trends differ from noise, zoom directly into any zone on our unified 3D globe, and explore an honest statistical verdict.',
      ctaPlanet: 'Explore 3D Planet →',
      ctaCases: 'Jump to Guided Cases',
      stats: {
        vars: 'NASA Variables',
        varsSub: 'MERRA-2 & CERES',
        years: 'Years of Record',
        yearsSub: 'Since 1981',
        cells: 'Global Grid Cells',
        cellsSub: '5° mesh with FDR control',
        countries: 'Countries Linked',
        countriesSub: 'UN + World Bank',
      },
      qTitle: 'The 4 detective questions VERDICT answers',
      questions: [
        { icon: '🌡️', q: 'What is changing?', desc: 'Turns plain questions about heat, drought, rainfall, solar energy, or wind into the right NASA variables.' },
        { icon: '🌍', q: 'Where on Earth?', desc: 'No duplicate maps: spin the 3D Earth, zoom smoothly into your city or watershed, and click any coordinate.' },
        { icon: '📏', q: 'How fast & how much?', desc: 'Measures decadal pace with outlier-resistant Theil–Sen slopes plus total cumulative change.' },
        { icon: '🛡️', q: 'Real shift or lucky streak?', desc: 'The core of VERDICT: defeats climate "memory" (autocorrelation) so natural cycles do not trigger false alarms.' },
      ],
      trapTitle: 'Why ordinary trend lines lie: our Anti-False-Alarm Filter',
      trapDesc: 'Environmental data has "memory": a hot or dry year tends to follow another. Standard trend tests ignore this and raise false alarms up to 49% of the time when nothing is actually changing.',
      trapTableTitle: 'Monte Carlo Simulation Benchmark (30-year series with zero real trend)',
      trapCols: ['Climate Memory (φ)', 'Ordinary Regression (False Alarms)', 'VERDICT (Dual Test + Bias Fix)', 'Protection'],
      trapNote: 'At high memory (φ = 0.8), naive regression fails 49% of the time. VERDICT suppresses false positives down to 8.2%.',
      semaforoTitle: 'How to read an Honest Verdict',
      semaforo: [
        { tone: 'significant', badge: 'Confirmed', title: 'Statistically Significant', desc: 'Passes two independent tests (prewhitened Mann-Kendall & effective-N regression). Very unlikely to be luck.' },
        { tone: 'not_yet', badge: 'Watching', title: 'Not Yet Significant', desc: 'A slope appears, but natural swings are still too loud. We estimate exactly how many years of data are needed.' },
        { tone: 'no_trend', badge: 'Stable', title: 'No Clear Trend', desc: 'Observed fluctuations fall well inside normal natural variability over this period.' },
      ],
      demosTitle: 'Start in 1 click with a real-world case study',
      demosSub: 'Each guided case highlights a real scientific insight — including why "Not Yet" is an honest scientific answer.',
      demoBtn: 'Open in Studio →',
      demoGlobeBtn: 'View on Globe',
    },
    phase2: {
      title: 'Unified Interactive Planet · Macro to Local Zoom',
      sub: 'Spin the 3D globe to inspect 2,592 FDR-checked cells worldwide. Zoom right into your city or search by name to reveal crisp satellite terrain and pick any point.',
      globalBtn: '🌍 Global View',
      zoomZoneBtn: '🔍 Zoom to Zone',
      centerBtn: '📍 Center Spot',
      nightToggle: 'Night lights (VIIRS Black Marble)',
      fdrToggle: 'Confirmed only (FDR filter)',
      legendHelp: 'Opaque = confirmed trend passing global FDR control (q = 0.10). As you zoom into a region, cell shading fades so real satellite imagery shines through.',
      dockStep1: '1 · Locate or zoom to a zone',
      dockStep2: '2 · Choose what to investigate',
      dockStep3: '3 · Launch Analytics Studio',
      searchPlaceholder: 'Search any city, town, or region (e.g. Managua, Tokyo, Nairobi…)',
      searchBtn: 'Search',
      compareToggle: 'Next click on globe picks a 2nd place to compare',
      askPlaceholder: 'Ask freely: "is soil drying out in Somoto?"',
      askBtn: 'Interpret',
      concernTitle: 'What is your concern?',
      placeTypeTitle: 'What kind of place is this?',
      recTitle: 'Recommended variables for your case',
      allVarsLabel: 'Or pick any of the 14 NASA variables',
      startYearLabel: 'Analysis start year',
      launchBtn: 'Analyze Zone & Open Studio →',
      busyBtn: 'Computing verdict…',
      selectedBadge: 'Active Zone on Globe',
      openStudioNow: 'Open Analytics Studio →',
      secondSpotLabel: '2nd comparison spot',
    },
    phase3: {
      backToPlanet: '🌍 Back to 3D Planet (Change Zone)',
      compareShortcut: '⚖️ Compare with 2nd Zone',
      tabs: {
        trend: '🎯 Verdict & Future',
        scan: '🧭 14-Variable Radar',
        compare: '⚖️ Compare 2 Zones',
        satellite: '🛰️ Satellite (1984–2025)',
        population: '👥 UN Population',
        relate: '🌾 Climate & Society',
      },
      kpi: {
        what: 'What & Direction',
        pace: 'Pace of Change',
        certainty: 'Statistical Certainty',
        data: 'Data Sufficiency',
        yearsHave: 'years observed',
        yearsNeed: 'years needed (~90% detection)',
        enoughData: 'Enough record length to conclude',
        missingYearsPrefix: 'Approx.',
        missingYearsSuffix: 'more years needed at this pace',
        plausibleRange: 'Plausible 95% range:',
        perDecade: '/ decade',
        totalOver: 'total over',
        yearsWord: 'years',
      },
      chart: {
        title: 'Historical Series & Trend',
        simpleBtn: 'Simple View (Annual)',
        fullBtn: 'Full View (+ Monthly)',
        guideSimple: 'Cyan dots show annual averages relative to the period mean. The orange dashed line is the outlier-resistant Theil–Sen trend.',
        guideFull: 'Adds deseasonalized monthly anomalies in dark slate so you can inspect short-term noise around the annual trend.',
        yAxis: 'Anomaly',
        monthlyName: 'Monthly (deseasonalized)',
        annualName: 'Annual mean',
        trendName: 'Trend (Theil–Sen)',
        bandName: 'Scenario: 95% range',
        scenarioName: 'Scenario if pace continues',
        todayLabel: 'today',
      },
      scenario: {
        title: 'Future Scenario Explorer ("What if today\'s pace continues?")',
        note: 'Explicitly labeled as a linear scenario — not a climate forecast.',
        btnPrefix: 'Project scenario to',
      },
      rigor: {
        summaryStudent: '🔬 View full statistical test details & validation (For Researchers)',
        summaryResearcher: '🔬 Dual Statistical Engine & Monte Carlo Rigor',
        methodTitle: 'Side-by-side results from both independent tests',
        cols: ['Method', 'Slope / decade', '95% CI', 'p-value / Statistic'],
        row1: 'Theil–Sen + Prewhitened Mann-Kendall',
        row2: 'Effective-N OLS Regression + t-test',
        agreeYes: 'Both statistical engines agree on the conclusion.',
        agreeNo: 'The two engines disagree: verdict remains conservative.',
        sourceLive: 'Source: Live NASA POWER API (MERRA-2 / CERES).',
        sourceLocal: 'Source: Verified offline NASA POWER sample.',
      },
      scan: {
        title: 'Full 14-variable radar at',
        sub: 'All NASA POWER variables ranked from strongest to weakest evidence. Click any row to open its full Verdict.',
        bonferroniNote: 'Testing 14 variables simultaneously increases random hits. Adjusted p (Bonferroni) guards against false discoveries.',
        regionsTitle: 'Same variable across 7 global reference biomes',
        regionsSub: 'Shows how the exact same Earth variable can climb rapidly in one region while staying flat or dropping elsewhere.',
        colsScan: ['Variable', 'Dir.', 'Pace / decade', 'Certainty / p', 'Verdict'],
        colsReg: ['Region & Biome', 'Dir.', 'Pace / decade', 'p', 'Verdict'],
      },
    },
  },
} as const
